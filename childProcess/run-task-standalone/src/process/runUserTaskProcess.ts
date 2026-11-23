/**
 * (Deprecated) 旧轮询式用户任务调度器。
 * 已被 ZSET 时间优先队列 + runUserTaskProcessZSet 替换，仅保留用于回滚或参考。
 * 不再进行性能优化与新特性接入。
 */

import { runUserTask } from './runUserTask.js';
import {
  getTaskQueueInRedis,
  getAllTaskQueueKeys,
  getMultiUserTaskQueueInRedis,
  removeUserTaskQueueInRedis,
} from '../utils/game/taskQueue.js';
import { getMultiUserTalentCats } from '../utils/game/tarven.js';
import { getMultiCharacterStatusInfo } from '../utils/game/characterStatus.js';
import { getMultiQuestList } from '../utils/game/quest.js';
import { getMultiUserWorkEquipment } from '../utils/game/equipment.js';
import { batchGetBasicUserInfo } from '../utils/game/user.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

import {
  VillageBuildingStatus,
  type BaseVillageBuildingInfo,
} from '~/shared/types/village/building.js';
import type { allVillageBuilding } from '~/shared/data/allVillageBuilding.js';

import type { Tavern } from '~/generated/prisma/client.js';
import type { CharacterEquipmentInfo, CharacterStatusInfo } from '~/shared/types/characterInfo.js';
import type { Quest } from '~/shared/types/quest.js';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant.js';

/* ==================== 常量与实用函数 ==================== */

const MIN_TICK_MS = 500;

const GLOBAL_TTL_MS = 10_000;
const PER_USER_TTL_MS = 10_000;

const MANAGER_TICK_MS = 10_000;

const BACKOFF_BASE_MS = 3_000;
const BACKOFF_MAX_MS = 60_000;

type UserBasic = { uuid: string; is_banned: boolean; last_online_date: Date | null };

function parseArgs() {
  const groupArg = process.argv.find((a) => a.startsWith('--group='));
  const groupCountArg = process.argv.find((a) => a.startsWith('--groupCount='));
  const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
  const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
  return { group, groupCount };
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function sliceByGroup(list: string[], grp: number, grpCount: number) {
  if (grpCount <= 1) return list;
  const size = Math.ceil(list.length / grpCount);
  const start = grp * size;
  const end = grp === grpCount - 1 ? list.length : (grp + 1) * size;
  return list.slice(start, end);
}

function nextBackoff(level: number) {
  return Math.min(BACKOFF_BASE_MS * 2 ** level, BACKOFF_MAX_MS);
}

/* ==================== 全局缓存（村庄建筑） ==================== */

class GlobalCache {
  private data: BaseVillageBuildingInfo[] = [];
  private expireAt = 0;
  private refreshing?: Promise<void>;

  get snapshot(): BaseVillageBuildingInfo[] {
    return this.data;
  }

  async ensureFresh() {
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
        this.data = rows.map((r): BaseVillageBuildingInfo => ({
          type: r.type as keyof typeof allVillageBuilding,
          level: r.level,
        }));
        this.expireAt = Date.now() + GLOBAL_TTL_MS;
      } catch (e) {
        console.error('refresh village building failed:', e);
        // 保留旧数据，尽快重试
        this.expireAt = 0;
      } finally {
        this.refreshing = undefined;
      }
    })();

    await this.refreshing;
  }
}

/* ==================== 用户按需缓存（读穿透） ==================== */

type UserSnapshot = {
  basic?: UserBasic;
  status?: CharacterStatusInfo;
  taverns?: Tavern[];
  quests?: Quest[];
  work?: CharacterEquipmentInfo;
};

class UserCache {
  private basic = new Map<string, UserBasic>();
  private status = new Map<string, CharacterStatusInfo>();
  private taverns = new Map<string, Tavern[]>();
  private quests = new Map<string, Quest[]>();
  private work = new Map<string, CharacterEquipmentInfo>();

  private expireAt = new Map<string, number>();
  private inFlight = new Map<string, Promise<void>>();
  private backoffLevel = new Map<string, number>();
  private backoffUntil = new Map<string, number>();

  getSnapshot(userUuid: string): UserSnapshot {
    return {
      basic: this.basic.get(userUuid),
      status: this.status.get(userUuid),
      taverns: this.taverns.get(userUuid),
      quests: this.quests.get(userUuid),
      work: this.work.get(userUuid),
    };
  }

  private setTTL(userUuid: string) {
    this.expireAt.set(userUuid, Date.now() + PER_USER_TTL_MS);
  }

  async ensure(userUuid: string) {
    const now = Date.now();
    const exp = this.expireAt.get(userUuid) ?? 0;
    if (now < exp && (this.basic.has(userUuid) || this.status.has(userUuid))) {
      return;
    }

    const until = this.backoffUntil.get(userUuid) ?? 0;
    if (now < until) return;

    const running = this.inFlight.get(userUuid);
    if (running) {
      await running;
      return;
    }

    const p = (async () => {
      try {
        const [basicMap, statusMap, tavernMap, questMap, workMap] = await Promise.all([
          batchGetBasicUserInfo([userUuid]),
          getMultiCharacterStatusInfo([userUuid]),
          getMultiUserTalentCats([userUuid]),
          getMultiQuestList([userUuid]),
          getMultiUserWorkEquipment([userUuid]),
        ]);

        const basic = basicMap.get(userUuid);
        const status = statusMap.get(userUuid);

        if (basic) this.basic.set(userUuid, basic);
        if (status) this.status.set(userUuid, status);

        this.taverns.set(userUuid, tavernMap.get(userUuid) || []);
        this.quests.set(userUuid, questMap.get(userUuid) || []);
        this.work.set(userUuid, workMap.get(userUuid) || ({} as CharacterEquipmentInfo));

        this.setTTL(userUuid);
        this.backoffLevel.delete(userUuid);
        this.backoffUntil.delete(userUuid);
      } catch (e) {
        console.error(`ensure user failed: ${userUuid}`, e);
        const lvl = Math.min((this.backoffLevel.get(userUuid) ?? 0) + 1, 10);
        this.backoffLevel.set(userUuid, lvl);
        this.backoffUntil.set(userUuid, Date.now() + nextBackoff(lvl));
      } finally {
        this.inFlight.delete(userUuid);
      }
    })();

    this.inFlight.set(userUuid, p);
    await p;
  }
}

/* ==================== 调度器 ==================== */

type UserLoop = { stop: () => void; done: Promise<void> };

class Scheduler {
  private running = true;
  private globals = new GlobalCache();
  private users = new UserCache();

  private currentUsers: string[] = [];
  private loops = new Map<string, UserLoop>();

  constructor(private group: number, private groupCount: number) {}

  private async discoverUsers(): Promise<string[]> {
    const keys = await getAllTaskQueueKeys(); // e.g. TASK_QUEUE_<uuid>
    const uuids = keys.map((k) => k.replace(/^TASK_QUEUE_/, '')).filter(Boolean).sort();
    return sliceByGroup(uuids, this.group, this.groupCount);
  }

  private async startUserLoop(userUuid: string): Promise<UserLoop> {
    let active = true;

    const done = (async () => {
      while (this.running && active) {
        const start = Date.now();
        try {
          // 确保全局与用户数据
          await this.globals.ensureFresh();
          await this.users.ensure(userUuid);

          const snap = this.users.getSnapshot(userUuid);

          // 基本信息缺失：短暂跳过，不做破坏性操作
          if (!snap.basic) {
            continue;
          }

          // 封禁用户：移除队列并停止
          if (snap.basic && snap.basic.is_banned) {
            await removeUserTaskQueueInRedis(userUuid);
            logger.info(`Remove banned user's queue: ${userUuid}`);
            break;
          }

          const maxOffline = MAX_OFFLINE_HOUR * 60 * 60 * 1000;
          const lastOnline = snap.basic?.last_online_date?.getTime() || 0;
          if (!lastOnline || Date.now() - lastOnline > maxOffline) {
            continue;
          }

          // 角色状态缺失：等待下一轮
          if (!snap.status) {
            continue;
          }

          // 获取任务并执行业务
          const userTasks = await getTaskQueueInRedis(userUuid);
          // const userTasks = tasksMap.get(userUuid) || [];

          await runUserTask(userUuid, {
            userTavern: snap.taverns || [],
            userCharacterStatus: snap.status,
            userTasks,
            userQuests: snap.quests || [],
            villageBuildingInfo: this.globals.snapshot,
            workEquipment: snap.work || ({} as CharacterEquipmentInfo),
            userBasicInfo: snap.basic,
          });
        } catch (e) {
          console.error(`runUserTask error: ${userUuid}`, e);
        } finally {
          const elapsed = Date.now() - start;
          const rest = Math.max(0, MIN_TICK_MS - elapsed);
          if (rest > 0) await sleep(rest);
        }
      }
    })();

    return {
      stop: () => {
        active = false;
      },
      done,
    };
  }

  async run() {
    const onSig = () => (this.running = false);
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);

    try {
      // 冷启动：发现分片 + 预热全局
      this.currentUsers = await this.discoverUsers();
      await this.globals.ensureFresh();

      for (const u of this.currentUsers) {
        const loop = await this.startUserLoop(u);
        this.loops.set(u, loop);
      }
      logger.info(`User shard started. group=${this.group}/${this.groupCount} users=${this.currentUsers.length}`);

      // 管理循环：分片变化 + 全局续期
      while (this.running) {
        try {
          const latest = await this.discoverUsers();

          // diff
          const prevSet = new Set(this.currentUsers);
          const nextSet = new Set(latest);
          const added: string[] = [];
          const removed: string[] = [];

          for (const u of latest) if (!prevSet.has(u)) added.push(u);
          for (const u of this.currentUsers) if (!nextSet.has(u)) removed.push(u);

          if (added.length || removed.length) {
            this.currentUsers = latest;

            for (const u of removed) {
              const loop = this.loops.get(u);
              if (loop) {
                loop.stop();
                this.loops.delete(u);
              }
            }
            for (const u of added) {
              const loop = await this.startUserLoop(u);
              this.loops.set(u, loop);
            }

            logger.info(
              `User shard updated. users=${this.currentUsers.length} added=${added.length} removed=${removed.length}`
            );
          }

          await this.globals.ensureFresh();
        } catch (e) {
          console.error('manager loop error:', e);
        }

        await sleep(MANAGER_TICK_MS);
      }
    } finally {
      const waits: Promise<void>[] = [];
      for (const [, loop] of this.loops) {
        loop.stop();
        waits.push(loop.done);
      }
      await Promise.allSettled(waits);
    }
  }
}

/* ==================== 启动 ==================== */

async function main() {
  const { group, groupCount } = parseArgs();
  const scheduler = new Scheduler(group, groupCount);
  await scheduler.run();
}

await main();
process.exit(0);