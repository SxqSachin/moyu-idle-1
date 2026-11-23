// ...existing code...
import type { MsgQueuePayload } from '~/shared/types/msgQueue.js';
import { redisClient } from '../redis';
import { Emitter } from '@socket.io/redis-emitter';
import type { GameSocketUserInfo } from '~/shared/types/socket';
import pako from 'pako';
import { deflate as zlibDeflate } from 'zlib';
import { promisify } from 'util';
const deflateAsync = promisify(zlibDeflate);
import crypto from 'crypto';
// 移除文件审计日志依赖，保留控制台日志
import { getBattleInfoFromRedis, getBattlePlayerUuidsFromRedis, getBattleRoomById } from './battle';
import { getInventoryInfoPreferCache } from './characterInventory';
import { getBuildingInfo } from './building';
import { memoryCache } from '../memoryCache';
import type { FullBattleAction } from '~/shared/types/battle';
// for outcome batch enqueue
import type { BattleInfo } from '~/shared/types/battle';
import type { BattleRoom } from '~/shared/types/battleRoom';

// 使用专用 pub 客户端 + emitter，避免与主客户端命令队列争用
const pub = redisClient.duplicate();
pub.on("error", (err) => console.log("Redis Pub Client Error", err));
await pub.connect();
const emitter = new Emitter(pub);
type DeflateOpt = { level: 0 | 2 | 4 | 6; memLevel: 4 | 6 };
function getDeflateOptions(ev: string, payloadLen: number): DeflateOpt {
  const isBattle = ev.startsWith('battle:');
  if (isBattle) return { level: 2, memLevel: 4 };
  if (payloadLen <= 128) return { level: 0, memLevel: 4 };
  return { level: 4, memLevel: 6 };
}

// Compression cache to avoid repeated deflate work for identical payloads
const COMPRESSION_CACHE_TTL = 3_000; // 3s
const COMPRESSION_CACHE_MAX = 2000;
const compressionCache = new Map<string, { buf: Buffer | Uint8Array; ts: number }>();

const SMALL_MESSAGE_NO_COMPRESSION_THRESHOLD = 128 + 64; // bytes: send raw JSON for tiny messages

function getCachedCompressed(key: string) {
  const e = compressionCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > COMPRESSION_CACHE_TTL) {
    compressionCache.delete(key);
    return null;
  }
  return e.buf;
}

function setCachedCompressed(key: string, buf: Buffer | Uint8Array) {
  compressionCache.set(key, { buf, ts: Date.now() });
  if (compressionCache.size > COMPRESSION_CACHE_MAX) {
    const firstKey = compressionCache.keys().next().value;
    if (firstKey) compressionCache.delete(firstKey);
  }
}

async function compressStringWithCache(ev: string, s: string) {
  // If very small, return raw string (no compression)
  if (s.length <= SMALL_MESSAGE_NO_COMPRESSION_THRESHOLD) {
    return { payload: s, compressed: false, rawLen: s.length } as const;
  }

  const cacheKey = ev + '|' + s;
  const cached = getCachedCompressed(cacheKey);
  if (cached) return { payload: cached, compressed: true, rawLen: s.length } as const;

  const options = getDeflateOptions(ev, s.length);
  // map our simple levels directly to zlib levels (they share 0..9 range)
  const zOptions: any = { level: options.level };
  // use async zlib deflate to avoid blocking event loop
  const buf = await deflateAsync(Buffer.from(s), zOptions);
  setCachedCompressed(cacheKey, buf);
  return { payload: buf, compressed: true, rawLen: s.length } as const;
}

// 轻量级背压窗口：当底层 Redis 报队列已满时，短暂跳过后续发送，避免雪崩
let BACKPRESSURE_UNTIL = 0;
let BACKPRESSURE_WINDOW_MS = 200; // 初始 200ms，指数退避
const MAX_BUCKET_QUEUE = 1000; // 每个 battleUuid 缓存的最大消息条数


function logEmitError(ctx: {
  phase: 'emitEventToUser' | 'emitEventToUsers' | 'BattleFlush';
  ev?: string;
  userUuid?: string;
  roomId?: string;
  error: any;
  payloadPreviewLen?: number;
  battleUuid?: string;
  roomUuid?: string;
  msgType?: string;
  // 额外覆盖信息（可选）：压缩后长度、原始长度等
  compressedLen?: number;
  rawLen?: number;
  msg: any;
}) {
  try {
    const base = {
      phase: ctx.phase,
      ev: ctx.ev,
      userUuid: ctx.userUuid,
      roomId: ctx.roomId,
      battleUuid: ctx.battleUuid,
      roomUuid: ctx.roomUuid,
      msgType: ctx.msgType,
      payloadPreviewLen: ctx.payloadPreviewLen,
      compressedLen: ctx.compressedLen,
      rawLen: ctx.rawLen,
      err: ctx.error?.message || String(ctx.error),
      msg: ctx.msg,
      at: Date.now(),
    };
    console.error('[MsgQueueEmitError]', base);
  } catch (e) {
    console.error('[MsgQueueEmitError] log failed', e);
  }
}

// 本地在线状态缓存与面板打开缓存（使用 shared memoryCache 实例）
const ONLINE_CACHE_TTL_MS = 3_000; // 3s
const BATTLE_PANEL_CACHE_TTL_MS = 1_000; // 1s, reduce redis lookups
const BATTLE_PANEL_SET_KEY = 'battle-panel-users';

// helper cache keys
function onlineCacheKey(userUuid: string) { return `online:${userUuid}`; }
function battlePanelCacheKey(userUuid: string) { return `battle_panel:${userUuid}`; }


async function shouldSendBattleEvent(userUuid: string): Promise<boolean> {
  try {
    const cached = memoryCache.get<boolean>(battlePanelCacheKey(userUuid));
    if (typeof cached === 'boolean') return cached;
    const ok = await redisClient.sIsMember(BATTLE_PANEL_SET_KEY, userUuid);
    const v = !!ok;
    memoryCache.set(battlePanelCacheKey(userUuid), v, BATTLE_PANEL_CACHE_TTL_MS);
    return v;
  } catch {
    return true; // 失败时默认发送，避免误伤
  }
}

function isRedisAvailable() {
  return !!redisClient?.isOpen;
}

function inBackpressureWindow() {
  return Date.now() < BACKPRESSURE_UNTIL;
}

function scheduleBackpressureOnQueueFull() {
  BACKPRESSURE_WINDOW_MS = Math.min(BACKPRESSURE_WINDOW_MS * 2, 30_000);
  BACKPRESSURE_UNTIL = Date.now() + BACKPRESSURE_WINDOW_MS;
}

async function isUserOnline(userUuid: string): Promise<boolean> {
  const cached = memoryCache.get<boolean>(onlineCacheKey(userUuid));
  if (typeof cached === 'boolean') return cached;
  try {
    const sismember = await redisClient.sIsMember('online-users', userUuid);
    const isOnline = !!sismember;
    memoryCache.set(onlineCacheKey(userUuid), isOnline, ONLINE_CACHE_TTL_MS);
    return isOnline;
  } catch (e) {
    // If redis check fails, assume online to avoid missing messages
    return true;
  }
}

async function sendCompressedToRoom(roomId: string, ev: string, payload: Buffer | Uint8Array | string, rawLen?: number) {
  try {
    // emitter supports sending Buffer (binary) or string. Preserve type.
    emitter.to(roomId).emit(ev, payload as any);
  } catch (err) {
    const msg = (err as any)?.message || '';
    if (typeof msg === 'string' && msg.includes('queue is full')) {
      scheduleBackpressureOnQueueFull();
    }
    const compressedLen = Buffer.isBuffer(payload) ? (payload as Buffer).length : (typeof payload === 'string' ? (payload as string).length : (payload as Uint8Array).length);
    logEmitError({ phase: 'emitEventToUsers', ev, roomId, error: err, payloadPreviewLen: rawLen, compressedLen, rawLen, msg: '' });
  }
}

// 公共发送函数：检查在线并使用 emitter 发消息（压缩 payload）
export async function emitEventToUser<T>(userInfo: GameSocketUserInfo | string, ev: string, data?: T) {
  const userUuid = typeof userInfo === 'string' ? userInfo : userInfo.uuid;
  const roomId = 'room-' + userUuid;

  if (!isRedisAvailable()) return;
  if (inBackpressureWindow()) return;

  try {
    if (ev.startsWith('battle:')) {
      const open = await shouldSendBattleEvent(userUuid);
      if (!open) return;
    }

    const isOnline = await isUserOnline(userUuid);
    if (!isOnline) return;

    // sanitize userInfo copy
    const userCopy = typeof userInfo === 'string' ? { uuid: userInfo } : { ...userInfo } as any;
    delete userCopy.firstResetPassword;
    delete userCopy.pwd;
    if (!userCopy.isGm) delete userCopy.isGm;

    const payload = { user: userCopy, data: data ?? null };
    const s = JSON.stringify(payload);
    // early backpressure check before expensive compression
    if (inBackpressureWindow()) return;
    const compressedRes = await compressStringWithCache(ev, s);
    try {
      await sendCompressedToRoom(roomId, ev, compressedRes.payload, compressedRes.rawLen);
    } catch (err) {
      logEmitError({ phase: 'emitEventToUser', ev, userUuid, roomId, error: err, payloadPreviewLen: s.length, rawLen: s.length, compressedLen: Buffer.isBuffer(compressedRes.payload) ? (compressedRes.payload as Buffer).length : undefined, msg: s });
    }
  } catch (err) {
    logEmitError({ phase: 'emitEventToUser', ev, userUuid, roomId, error: err, msg: JSON.stringify(data) });
  }
}

// 预压缩并批量发送，避免对同一数据重复 JSON.stringify/deflate
export async function emitEventToUsers<T>(userUuids: (GameSocketUserInfo | string)[], ev: string, data?: T) {
  if (!userUuids || userUuids.length === 0) return;
  if (!isRedisAvailable()) return;
  if (inBackpressureWindow()) return;

  const payload = { user: null, data: data ?? null } as any;
  const sBase = JSON.stringify(payload);
  // early backpressure check
  if (inBackpressureWindow()) return;

  const compressedRes = await compressStringWithCache(ev, sBase);

  for (const u of userUuids) {
    const userUuid = typeof u === 'string' ? u : u.uuid;
    const roomId = 'room-' + userUuid;

    try {
      if (ev.startsWith('battle:')) {
        const open = await shouldSendBattleEvent(userUuid);
        if (!open) continue;
      } else {
        const isOnline = await isUserOnline(userUuid);
        if (!isOnline) continue;
      }

      try {
        await sendCompressedToRoom(roomId, ev, compressedRes.payload as any, compressedRes.rawLen);
      } catch (err) {
        logEmitError({ phase: 'emitEventToUsers', ev, userUuid, roomId, error: err, payloadPreviewLen: compressedRes.rawLen, rawLen: compressedRes.rawLen, compressedLen: Buffer.isBuffer(compressedRes.payload) ? (compressedRes.payload as Buffer).length : undefined, msg: sBase });
      }
    } catch (err) {
      logEmitError({ phase: 'emitEventToUsers', ev, userUuid, roomId, error: err, msg: sBase });
    }
  }
}

/**
 * publishBattleInfo: 立即处理并发送非战斗/即时消息
 * （保留原有的各种分支，尽量不改变业务行为）
 */
const BATTLE_CHANNEL = 'BATTLE_INFO_CHANNEL';
export function publishBattleInfo(msg: MsgQueuePayload) {
  try {
    switch (msg.type) {
      case "give_battle_resource_reward":
        emitEventToUsers(msg.playerUuid, "battle:giveResourceReward:success", msg.info);
        return;
      case "give_battle_exp_reward":
        emitEventToUsers(msg.playerUuid, "battle:giveExpReward:success", msg.info);
        return;
      case "battle_info_detail":
        emitEventToUsers(msg.playerUuid, "battle:battleInfoDetail:success", msg.info);
        return;
      case "use_resource":
        emitEventToUser(msg.userUuid, "resourceUsed", msg.info);
        return;
      case "need_reset_current_action_progress":
        emitEventToUser(msg.userUuid, "needResetCurrentActionProgress");
        return;
      case "dispatch_task_queue_to_client":
        emitEventToUser(msg.userUuid, "dispatchTaskQueueToClient", msg.info);
        return;
      case "task_updated":
        emitEventToUser(msg.userUuid, "taskUpdated", msg.firstTask);
        return;
      case "task_done":
        emitEventToUser(msg.userUuid, "taskDone", msg.info);
        return;
      case "status_info":
      case "status_upgrade":
        emitEventToUser(msg.userUuid, "dispatchCharacterStatusInfo", msg.info);
        return;
      case "inventory_updated":
        getInventoryInfoPreferCache(msg.userUuid).then(inventoryInfo => {
          emitEventToUser(msg.userUuid, "inventoryUpdated", inventoryInfo);
        }).catch(e => console.error('[publishBattleInfo] inventory error', e));
        return;
      case "inventory_modify":
        emitEventToUser(msg.userUuid, "inventoryModify", msg.info);
        return;
      case "building_info":
        getBuildingInfo(msg.userUuid).then(info => {
          emitEventToUser(msg.userUuid, "dispatchCharacterBuildingInfo", info);
        }).catch(e => console.error('[publishBattleInfo] building error', e));
        return;
      case "quest_update":
        emitEventToUser(msg.userUuid, "quest:updated", msg.info);
        return;
      case "dispatch_resource_increase":
        emitEventToUser(msg.userUuid, "inventory:increase:success", msg.info);
        return;
      case "battle_start":
        emitEventToUser(msg.userUuid, "battleRoom:startBattle:success", msg.battleRoom);
        return;
      case "dispatch_kitty_task_queue":
        emitEventToUser(msg.userUuid, "kitty:getAllTask:success", {
          kittyUuid: msg.kittyUuid,
          taskQueue: msg.taskQueue,
        });
        return;
      case "dispatch_battle_info_to_client":
        getBattleRoomById(msg.roomUuid).then(room => {
          if (!room) return;
          emitEventToUsers(room.memberIds, "battle:fullInfo:success", {
            battleInfo: msg.battleInfo,
            // thisRoundAction: msg.thisRoundAction,
          });
        }).catch(e => console.error('[publishBattleInfo] dispatch_battle_info_to_client error', e));
        return;
      case "dispatch_battle_end":
        getBattleRoomById(msg.roomUuid).then(battleRoom => {
          if (!battleRoom) return;
          emitEventToUsers(battleRoom.memberIds, "battle:end:success");
        }).catch(e => console.error('[publishBattleInfo] dispatch_battle_end error', e));
        return;
      case "notify_all_room_members_to_update_room":
        getBattleRoomById(msg.roomUuid).then(room => {
          if (!room) return;
          emitEventToUsers(room.memberIds, "battleRoom:update", room);
        }).catch(e => console.error('[publishBattleInfo] notify_all_room_members_to_update_room error', e));
        return;
      case "dispatch_latest_battle_info":
        {
          const battleRoom = msg.battleRoom;
          if (!battleRoom) return;
          if (!battleRoom.battleUuid) {
            emitEventToUsers(battleRoom.memberIds, "battle:update:error", { message: "房间未开始战斗" });
            return;
          }
          const battleInfo = msg.latestBattleInfo;
          if (!battleInfo) {
            emitEventToUsers(battleRoom.memberIds, "battle:update:error", { message: "未找到战斗信息" });
            return;
          }
          emitEventToUsers(battleRoom.memberIds, "battle:update:success", battleInfo);
        }
        return;
      case "worldBoss:hp_update":
        emitEventToUsers(msg.playerUuid, "worldBoss:hpUpdate:success", {
          bossId: msg.info.bossId,
          currentHp: msg.info.currentHp,
          totalHp: msg.info.totalHp,
          lastUpdated: msg.info.lastUpdated,
          bossMembers: msg.info.bossMembers,
        });
        return;
      case "worldBoss:victory":
        emitEventToUsers(msg.playerUuid, "worldBoss:victory:success", {
          bossId: (msg as any).bossId,
        });
        return;
      default:
        // 未处理的消息类型保持原样（未来扩展）
        return;
    }
  } catch (err) {
    console.error('[battlePubSub] publishBattleInfo error:', err);
  }
}


function processBattleBatchMessages(messages: MsgQueuePayload[]): MsgQueuePayload[] {
  if (!messages || messages.length === 0) return messages;

  // 稳定化序列化，用于判等（键排序）
  const stableStringify = (v: any): string => {
    if (v === null || v === undefined) return String(v);
    if (typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
    const keys = Object.keys(v).sort();
    return `{${keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',')}}`;
  };

  const seen = new Set<string>();
  const out: MsgQueuePayload[] = [];

  for (const m of messages) {
    // 临时过滤：丢弃所有 addState 消息，降低前端与网络压力
    // if (m.type === 'on_add_state') {
    //   continue;
    // }
    if (m.type === 'battle_float_text') {
      const info = (m as any).info ?? {};
      const key = stableStringify(info);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m);
      } else {
        // 重复的 battle_float_text 丢弃
      }
    } else {
      out.push(m);
    }
  }

  return out;
}

/**
 * BattleMessageBatcher
 * - 对含有 battleUuid 的战斗消息按 battleUuid 聚合
 * - 每个 battleUuid：每批次最多 MAX_BATCH_SIZE 条，或在 BATCH_TIMEOUT_MS 窗口到期时触发一次 flush
 * - flush 时会获取玩家 UUID（优先从消息内部的 battleInfo），然后逐条分发（保持原有事件名）
 */
export class BattleMessageBatcher {
  private static buckets: Map<string, { msgs: MsgQueuePayload[]; timer: NodeJS.Timeout | null }> = new Map();
  private static readonly MAX_BATCH_SIZE = 1;
  private static readonly BATCH_TIMEOUT_MS = 20;

  static add(message: MsgQueuePayload & { battleUuid?: string }) {
    const battleUuid = message.battleUuid;
    if (!battleUuid) {
      // 非战斗消息不应进入此类
      return;
    }

    // 背压期间直接丢弃战斗消息，避免内存增长与积压
    if (Date.now() < BACKPRESSURE_UNTIL) {
      return;
    }

    let bucket = this.buckets.get(battleUuid);
    if (!bucket) {
      bucket = { msgs: [], timer: null };
      this.buckets.set(battleUuid, bucket);
    }

    // 控制每个桶的最大队列长度，超过则丢弃最旧消息
    if (bucket.msgs.length >= MAX_BUCKET_QUEUE) {
      bucket.msgs.shift();
    }
    bucket.msgs.push(message);

    if (bucket.msgs.length >= this.MAX_BATCH_SIZE) {
      this.flush(battleUuid);
      return;
    }

    if (!bucket.timer) {
      bucket.timer = setTimeout(() => this.flush(battleUuid), this.BATCH_TIMEOUT_MS);
    }
  }

  private static async flush(battleUuid: string) {
    const bucket = this.buckets.get(battleUuid);
    if (!bucket) return;

    // capture and reset
    const messages = bucket.msgs.splice(0, bucket.msgs.length);
    if (bucket.timer) {
      clearTimeout(bucket.timer);
      bucket.timer = null;
    }
    // if no more messages, delete bucket
    if (bucket.msgs.length === 0) {
      this.buckets.delete(battleUuid);
    }

    try {
      // 使用独立方法处理/合并消息（目前实现 battle_float_text 去重）
      const messagesToProcess = processBattleBatchMessages(messages);

      // 优先从任意消息内取出 battleInfo.members
      let playerUuids: string[] | null = null;
      for (const m of messagesToProcess) {
        // @ts-ignore
        if (m.battleInfo?.members) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          playerUuids = (m as any).battleInfo.members.filter((u: any) => u.isPlayer).map((u: any) => u.uuid);
          break;
        }
      }

      if (!playerUuids) {
        // 从 redis 读取
        playerUuids = await getBattlePlayerUuidsFromRedis(battleUuid);
      }

      // 分发每条消息给 playerUuids
      for (const msg of messagesToProcess) {
        // 对每种 msg.type 对应到事件名（与原实现保持一致）
        const eventMap: Record<string, string> = {
          on_turn_start: "battle:turnStart:success",
          on_turn_end: "battle:turnEnd:success",
          on_deal_damage: "battle:dealDamage:success",
          on_heal: "battle:heal:success",
          battle_float_text: "battle:floatText:success",
          use_battle_item: "battle:useBattleItem:success",
          on_add_state: "battle:addState:success",
          on_loss_mp: "battle:lossMp:success",
          on_restore_mp: "battle:restoreMp:success",
          on_cast_skill: "battle:castSkill:success",
          give_battle_exp_reward: "battle:giveExpReward:success",
          draw_line: "battle:drawLine:success",
          battle_begin: "battle:begin:success",
          battle_prepare_begin: "battle:prepareBegin:success",
          battle_prepare_end: "battle:prepareEnd:success",
        };

        const ev = eventMap[msg.type];
        if (!ev) continue;

        // Broadcast once to all players in this bucket: emitEventToUsers will perform per-user online/panel checks
        try {
          // @ts-ignore
          await emitEventToUsers(playerUuids, ev, msg.info);
        } catch (err) {
          logEmitError({
            phase: "BattleFlush",
            ev,
            error: err,
            battleUuid,
            roomUuid: (msg as any)?.roomUuid,
            msgType: msg.type,
            // @ts-ignore
            msg: JSON.stringify(msg.info),
          });
        }
      }
    } catch (err) {
      logEmitError({ phase: "BattleFlush", error: err, battleUuid, msg: "" });
    }
    }

  static cleanup() {
    try {
      for (const bucket of this.buckets.values()) {
        if (bucket.timer) {
          clearTimeout(bucket.timer);
        }
      }
      this.buckets.clear();
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

/**
 * pushMessageToQueue -> 路由：
 * - 若消息含 battleUuid：加入 BattleMessageBatcher
 * - 其它消息：立即交付（publishBattleInfo）
 */
export function pushMessageToQueue(message: MsgQueuePayload) {
  try {
    // 判定是否含有 battleUuid（战斗消息）
    if ('battleUuid' in message && (message as any).battleUuid) {
      // 将战斗消息交由批处理器按 battleUuid 聚合
      BattleMessageBatcher.add(message as MsgQueuePayload & { battleUuid: string });
      return;
    }

    // 立即处理非战斗消息
    publishBattleInfo(message);
  } catch (err) {
    console.error('[msgQueue] pushMessageToQueue error:', err);
    throw err;
  }
}
// ...existing code...

// =========================
// Reward outcome batch queue
// =========================
// 使用 Redis 列表作为简单队列，供后台worker批处理持久化，避免阻塞回合主路径。
export type BattleOutcomeBatchJob = {
  type: 'battle_outcome_batch';
  battleUuid: string;
  roomUuid: string;
  // 注意：为减少 worker 侧的查询，这里直接携带必要上下文
  room: BattleRoom;
  battleInfo: BattleInfo;
  unitStatistic: Record<string, any>;
  extraExpPercent: number;
  result: 'win' | 'lose' | 'escaped';

  resourceRewardTarget?: 'inventory' | 'harvestbox';
  resourceRewardTitle?: string;
};

const OUTCOME_QUEUE_KEY = 'queue:battle_outcome_id';

const euqueUsedRedisClient = redisClient.duplicate();
await euqueUsedRedisClient.connect();

// TTL for payload keys (seconds)
const OUTCOME_PAYLOAD_TTL_SEC = 60 * 2; // 2 minutes

export async function enqueueBattleOutcomeBatch(job: BattleOutcomeBatchJob) {
  try {
    if (!redisClient?.isOpen) return;

    // Create a compact payload key and store the (compressed) job there.
    const id = crypto.randomBytes(8).toString('hex');
    const payloadKey = `battle_outcome_payload:${id}`;

    // Serialize payload as JSON string. (No compression to avoid CPU overhead.)
    const raw = JSON.stringify(job);
    // Store raw JSON string with TTL to allow automatic cleanup on consumer failure.
    await euqueUsedRedisClient.set(payloadKey, raw, { EX: OUTCOME_PAYLOAD_TTL_SEC });

    // Push the small payload key into the outcome queue (short id instead of full job)
    await euqueUsedRedisClient.lPush(OUTCOME_QUEUE_KEY, payloadKey);
  } catch (err) {
    console.error('[enqueueBattleOutcomeBatch] error', err);
  }
}

// 导出清理函数，用于shutdown
export function cleanupMsgQueueMemory() {
  BattleMessageBatcher.cleanup();
}