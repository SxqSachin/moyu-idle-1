import { redisClient } from "../redis"
import { type RedisClientType } from "@redis/client";
import { type AllBroadcastMessage, type BroadcastMessage, type GameBroadcastKind } from "~/shared/types/broadcast";
export const GAME_BROADCAST_CHANNEL = "GAME_BROADCAST";

// 防抖：在短时间窗口内（ms）对完全相同参数的多次 publish 只发送最后一次。
const BROADCAST_DEBOUNCE_MS = Number(process.env.BROADCAST_DEBOUNCE_MS) || 30;
type Pending = { timer: NodeJS.Timeout | null; last: BroadcastMessage };
const pendingPublishes = new Map<string, Pending>();

let pubClient:RedisClientType
async function doPublish(msg: BroadcastMessage) {
  if (!pubClient) {
    pubClient = redisClient.duplicate();
    await pubClient.connect();
  }

  try {
    await pubClient.publish(GAME_BROADCAST_CHANNEL, JSON.stringify(msg));
  } catch (e) {
    console.error("[broadcastHub] publish error", e, msg);
  }
}

export async function publishGameBroadcast<T extends BroadcastMessage>(msg: T) {
  let key: string;
  try {
    key = JSON.stringify(msg);
  } catch (e) {
    // 非序列化对象，直接发送（保守处理）
    return doPublish(msg);
  }

  const existing = pendingPublishes.get(key);
  if (existing) {
    // 更新 last 并重置 timer
    existing.last = msg;
    if (existing.timer) {
      clearTimeout(existing.timer);
    }
    existing.timer = setTimeout(async () => {
      pendingPublishes.delete(key);
      await doPublish(existing.last);
    }, BROADCAST_DEBOUNCE_MS);
    return;
  }

  const timer = setTimeout(async () => {
    const p = pendingPublishes.get(key)!;
    pendingPublishes.delete(key);
    await doPublish(p.last);
  }, BROADCAST_DEBOUNCE_MS);

  pendingPublishes.set(key, { timer, last: msg });
}

// 在进程退出前把待发消息立即刷出，避免消息丢失
export function flushPendingPublishes() {
  for (const [key, p] of pendingPublishes.entries()) {
    if (p.timer) {
      clearTimeout(p.timer);
    }
    // fire-and-forget
    doPublish(p.last).catch((e) => console.error('[broadcastHub] flush publish error', e, p.last));
    pendingPublishes.delete(key);
  }
}

// process.on('beforeExit', flushPendingPublishes);
// process.on('SIGINT', () => { flushPendingPublishes(); process.exit(); });
// process.on('SIGTERM', () => { flushPendingPublishes(); process.exit(); });

let subClient:RedisClientType
export const subscribeGameBroadcast = async (callback: (msg: AllBroadcastMessage) => void) => {
  if (!subClient) {
    subClient = redisClient.duplicate();
    await subClient.connect();
  }

  try {
    // duplicate is necessary: when a redis client subscribes it cannot be
    // used for normal commands; keep this detail internal so callers don't
    // have to manage separate clients.
    // @ts-ignore
    // const _subClient = pRedis.duplicate();
    await subClient.subscribe(GAME_BROADCAST_CHANNEL, (raw: string) => {
      try {
        const msg: AllBroadcastMessage = JSON.parse(raw);
        // dispatch to specific kind listeners
        callback(msg);
      } catch (e) {
        console.error("[broadcastHub] parse error", e, raw);
      }
    });
    console.log("[broadcastHub] subscribed to", GAME_BROADCAST_CHANNEL);
  } catch (e) {
    console.error("[broadcastHub] start subscriber error", e);
  }
};