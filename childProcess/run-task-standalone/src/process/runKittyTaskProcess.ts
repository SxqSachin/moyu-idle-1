/**
 * Kitty 任务进程（重构版）
 *
 * 目标
 * - 批量为主，按需穿透：当批量缓存未覆盖时，对单个缺失的 kitty/owner 立刻拉取一次再执行业务逻辑
 * - TTL 缓存 + 并发去重 + 失败退避
 * - 安全删除：多次确认缺失并直连二次校验才清理队列
 * - 分片调度：按 group/groupCount 切分
 */

import type { Tavern, User } from '~/generated/prisma';
import { getAllKittyUuids, getKitty, removeKittyTaskQueueInRedis } from '../utils/game/kitty';
import { runKittyTask } from './runKittyTask';
import type { CharacterStatusInfo } from '~/shared/types/characterInfo';
import type { Kitty } from '~/shared/types/kitty';
import { getMultiUserTalentCats } from '../utils/game/tarven';
import { getMultiCharacterStatusInfo } from '../utils/game/characterStatus';
import { logger } from '../utils/logger.js';
import { VillageBuildingStatus, type BaseVillageBuildingInfo } from '~/shared/types/village/building';
import { prisma } from '../utils/prisma';
import type { allVillageBuilding } from '~/shared/data/allVillageBuilding';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant';

/* ==================== 常量 ==================== */

const MIN_TICK_INTERVAL_MS = 500;

const GLOBAL_TTL_MS = 10_000;
const KITTY_TTL_MS = 10_000;
const OWNER_TTL_MS = 10_000;

const MANAGER_TICK_MS = 10_000;

const BACKOFF_BASE_MS = 3_000;
const BACKOFF_MAX_MS = 60_000;

const MISSING_REMOVE_THRESHOLD = 3;

/* ==================== 工具 ==================== */

function parseArgs() {
  const groupArg = process.argv.find(arg => arg.startsWith('--group='));
  const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
  const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
  const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
  return { group, groupCount };
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function sliceByGroup(list: string[], grp: number, grpCount: number) {
  const total = list.length;
  if (grpCount <= 1) return list;
  const size = Math.ceil(total / grpCount);
  const start = grp * size;
  const end = grp === grpCount - 1 ? total : (grp + 1) * size;
  return list.slice(start, end);
}

function nextBackoff(level: number) {
  return Math.min(BACKOFF_BASE_MS * 2 ** level, BACKOFF_MAX_MS);
}

/* ==================== 通用按需缓存（读穿透） ==================== */

type LoadOne<K, V> = (key: K) => Promise<V | null>;
type Clock = () => number;

class OnDemandCache<K, V> {
  private store = new Map<K, V | null>();                // null 表示“确认不存在”
  private expireAt = new Map<K, number>();
  private inFlight = new Map<K, Promise<void>>();
  private backoffLevel = new Map<K, number>();
  private backoffUntil = new Map<K, number>();

  constructor(
    private ttlMs: number,
    private loadOne: LoadOne<K, V>,
    private now: Clock = () => Date.now(),
  ) {}

  getLocal(key: K) {
    const now = this.now();
    const exp = this.expireAt.get(key) ?? 0;
    if (now < exp && this.store.has(key)) {
      return this.store.get(key) ?? null;
    }
    return undefined;
  }

  async ensure(key: K) {
    const now = this.now();

    // 命中 TTL 内缓存（包括 null 负缓存）
    const exp = this.expireAt.get(key) ?? 0;
    if (now < exp && this.store.has(key)) return;

    // 退避期
    const until = this.backoffUntil.get(key) ?? 0;
    if (now < until) return;

    // 并发去重
    const running = this.inFlight.get(key);
    if (running) {
      await running;
      return;
    }

    const p = (async () => {
      try {
        const val = await this.loadOne(key);
        // null -> 确认不存在，写入负缓存以避免频繁命中
        this.store.set(key, (val ?? null));
        this.expireAt.set(key, this.now() + this.ttlMs);
        this.backoffLevel.delete(key);
        this.backoffUntil.delete(key);
      } catch (e) {
        // 加权退避
        const level = Math.min((this.backoffLevel.get(key) ?? 0) + 1, 10);
        this.backoffLevel.set(key, level);
        this.backoffUntil.set(key, this.now() + nextBackoff(level));
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, p);
    await p;
  }
}

/* ==================== 全局（村庄建筑）缓存 ==================== */

class GlobalBuildings {
  private data: BaseVillageBuildingInfo[] = [];
  private expireAt = 0;
  private refreshing?: Promise<void>;

  constructor(private ttlMs: number) {}

  get snapshot(): BaseVillageBuildingInfo[] {
    return this.data;
  }

  async ensure() {
    const now = Date.now();
    if (now < this.expireAt) return;

    if (this.refreshing) {
      await this.refreshing;
      return;
    }

    this.refreshing = (async () => {
      try {
        const rows = await prisma.villageBuilding.findMany({
          select: { type: true, level: true },
          where: { status: VillageBuildingStatus.NORMAL },
        });
        this.data = rows.map((item): BaseVillageBuildingInfo => ({
          type: item.type as keyof typeof allVillageBuilding,
          level: item.level,
        }));
        this.expireAt = Date.now() + this.ttlMs;
      } catch (e) {
        // 保留旧快照，降低破坏性
        console.error('refresh GlobalBuildings failed:', e);
        this.expireAt = 0;
      } finally {
        this.refreshing = undefined;
      }
    })();

    await this.refreshing;
  }
}

/* ==================== 组合缓存：Kitty / Owner 数据 ==================== */

class DataCaches {
  readonly global = new GlobalBuildings(GLOBAL_TTL_MS);

  readonly kitty = new OnDemandCache<string, Kitty>(
    KITTY_TTL_MS,
    async (uuid) => {
      const k = await getKitty(uuid);
      return k ?? null;
    },
  );

  // Tavern 列表（按 ownerUuid）
  readonly ownerTaverns = new OnDemandCache<string, Tavern[]>(
    OWNER_TTL_MS,
    async (ownerUuid) => {
      const map = await getMultiUserTalentCats([ownerUuid]);
      return (map.get(ownerUuid) ?? []) as Tavern[];
    },
  );

  // 角色状态（按 ownerUuid）
  readonly ownerStatus = new OnDemandCache<string, CharacterStatusInfo>(
    OWNER_TTL_MS,
    async (ownerUuid) => {
      const map = await getMultiCharacterStatusInfo([ownerUuid]);
      return map.get(ownerUuid) ?? null;
    },
  );

  readonly ownerBase = new OnDemandCache<string, User>(
    OWNER_TTL_MS,
    async (ownerUuid) => {
      const user = await prisma.user.findUnique({
        where: { uuid: ownerUuid },
      });
      return user ?? null;
    }
  )

  async ensureGlobal() {
    await this.global.ensure();
  }

  // 读穿透：若本地未命中，立刻按需加载一次
  async getKittyEnsure(uuid: string) {
    let v = this.kitty.getLocal(uuid);
    if (v === undefined) {
      await this.kitty.ensure(uuid);
      v = this.kitty.getLocal(uuid);
    }
    return v ?? null; // 可能为 null（负缓存）
  }

  async getOwnerEnsure(ownerUuid: string) {
    // taverns
    let taverns = this.ownerTaverns.getLocal(ownerUuid);
    if (taverns === undefined) {
      await this.ownerTaverns.ensure(ownerUuid);
      taverns = this.ownerTaverns.getLocal(ownerUuid);
    }
    // status
    let status = this.ownerStatus.getLocal(ownerUuid);
    if (status === undefined) {
      await this.ownerStatus.ensure(ownerUuid);
      status = this.ownerStatus.getLocal(ownerUuid);
    }
    
    let user = this.ownerBase.getLocal(ownerUuid);
    if (user === undefined) {
      await this.ownerBase.ensure(ownerUuid);
      user = this.ownerBase.getLocal(ownerUuid);
    }

    return {
      taverns: (taverns ?? []) as Tavern[],
      status: status ?? null,
      user: user ?? null,
    };
  }
}

/* ==================== 调度与执行 ==================== */

type KittyLoop = { stop: () => void; done: Promise<void> };

class Scheduler {
  private running = true;
  private caches = new DataCaches();

  private currentKitties: string[] = [];
  private kittyLoops = new Map<string, KittyLoop>();

  constructor(private group: number, private groupCount: number) {}

  private async myKitties(): Promise<string[]> {
    const all = await getAllKittyUuids();
    return sliceByGroup(all, this.group, this.groupCount);
  }

  private async startKittyLoop(kittyUuid: string): Promise<KittyLoop> {
    let active = true;
    let missingStreak = 0;

    const done = (async () => {
      while (this.running && active) {
        const tickStart = Date.now();
        try {
          // 预热全局（低频）
          await this.caches.ensureGlobal();

          // 1) 按需获取 kitty：若批量未覆盖，读穿透单拉
          const kitty = await this.caches.getKittyEnsure(kittyUuid);

          if (kitty === null) {
            // 确认不存在：多次命中后再直连二次校验
            missingStreak += 1;
            if (missingStreak >= MISSING_REMOVE_THRESHOLD) {
              try {
                const recheck = await getKitty(kittyUuid);
                if (!recheck) {
                  logger.info(`Removing kitty task queue (verified missing): ${kittyUuid}`);
                  await removeKittyTaskQueueInRedis(kittyUuid);
                  break; // 退出该 loop
                } else {
                  missingStreak = 0; // 误报，恢复
                }
              } catch (e) {
                // 二次校验失败，暂不删除，下轮再试
                console.error(`recheck kitty failed: ${kittyUuid}`, e);
              }
            }
            // 未达阈值，跳过本轮
            continue;
          } else {
            // 存在
            missingStreak = 0;
          }

          // 2) 读穿透 owner 数据（taverns/status）
          const ownerUuid = kitty.owner;
          const { taverns, status, user } = await this.caches.getOwnerEnsure(ownerUuid);

          // 若状态仍不可用，跳过本轮（避免打 DB，但已发生一次单拉，满足需求）
          if (!status) {
            continue;
          }

          if (user && user?.is_banned) {
            // 用户被封禁，删除任务队列
            await removeKittyTaskQueueInRedis(kittyUuid);
            break;
          }

          const maxOffline = MAX_OFFLINE_HOUR * 60 * 60 * 1000;
          const lastOnline = user?.last_online_date?.getTime() || Date.now();
          if (!lastOnline || Date.now() - lastOnline > maxOffline) {
            continue;
          }

          // 3) 执行业务逻辑
          await runKittyTask(kittyUuid, {
            kitty,
            userTavern: taverns,
            userCharacterStatus: status,
            villageBuildingInfo: this.caches.global.snapshot,
          });
        } catch (err) {
          console.error(`runKittyTask error for kitty ${kittyUuid}:`, err);
        } finally {
          // 节流
          const elapsed = Date.now() - tickStart;
          const rest = Math.max(0, MIN_TICK_INTERVAL_MS - elapsed);
          if (rest > 0) await sleep(rest);
        }
      }
    })();

    return {
      stop: () => { active = false; },
      done,
    };
  }

  async run() {
    const onSig = () => { this.running = false; };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);

    try {
      // 冷启动：发现分片 + 预热全局
      this.currentKitties = await this.myKitties();
      await this.caches.ensureGlobal();

      for (const k of this.currentKitties) {
        const loop = await this.startKittyLoop(k);
        this.kittyLoops.set(k, loop);
      }
      logger.info(`Kitty shard started. group=${this.group}/${this.groupCount} total=${this.currentKitties.length}`);

      // 管理循环：检测分片变化 + 定期刷新全局
      while (this.running) {
        try {
          const latest = await this.myKitties();

          // 变更集
          const oldSet = new Set(this.currentKitties);
          const newSet = new Set(latest);
          const added: string[] = [];
          const removed: string[] = [];
          for (const k of latest) if (!oldSet.has(k)) added.push(k);
          for (const k of this.currentKitties) if (!newSet.has(k)) removed.push(k);

          if (added.length || removed.length) {
            this.currentKitties = latest;

            for (const k of removed) {
              const loop = this.kittyLoops.get(k);
              if (loop) {
                loop.stop();
                this.kittyLoops.delete(k);
              }
            }
            for (const k of added) {
              const loop = await this.startKittyLoop(k);
              this.kittyLoops.set(k, loop);
            }

            logger.info(`Kitty shard updated. total=${this.currentKitties.length} added=${added.length} removed=${removed.length}`);
          }

          // 低频刷新全局
          await this.caches.ensureGlobal();
        } catch (e) {
          console.error('manager loop error:', e);
        }

        await sleep(MANAGER_TICK_MS);
      }
    } finally {
      // 优雅退出
      const waits: Promise<void>[] = [];
      for (const [, loop] of this.kittyLoops) {
        loop.stop();
        waits.push(loop.done);
      }
      await Promise.allSettled(waits);
    }
  }
}

/* ==================== 入口 ==================== */

async function main() {
  const { group, groupCount } = parseArgs();
  const scheduler = new Scheduler(group, groupCount);
  await scheduler.run();
}

await main();
process.exit(0);