import { prisma } from "../utils/prisma";
import { withUniqueLock } from "../utils/index";
import { emitEventToUser } from "../utils/game/msgQueue";
import { doAlchemy } from "../utils/game/alchemy";
import { getUserEquipment } from "../utils/game/equipment";
import { safeJsonParse } from "~/shared/utils";
import { getMultiUserWorkEquipment } from "../utils/game/equipment";
import { memoryCache } from "../utils/memoryCache";

// 注意：生成的 Prisma Client 需要包含 AutoAlchemy；如果还未 migrate，本脚本会报错。
// 执行逻辑：轮询 PENDING/PROCESSING 状态的记录，一次执行一轮（每记录递增一次 doneTimes）。

const INTERVAL = 10000; // 10 秒
const MAX_BATCH_PER_TICK = 500; // 每轮最多处理任务数
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

type ItemCountInfo = Record<string, { count: number }>

// 缓存用户装备，50 秒内复用，减少重复查询
const EQUIPMENT_CACHE_TTL_MS = INTERVAL * 5 

const lGetUserEquipment = async (userUuid: string) => {
  const cacheKey = `autoAlchemy:equipment:${userUuid}`
  const cached = memoryCache.get<any>(cacheKey)
  if (cached) {
    return cached
  }
  const data = await getUserEquipment(userUuid, 'work')
  memoryCache.set(cacheKey, data, EQUIPMENT_CACHE_TTL_MS)
  return data
}

async function processOne(task: any) {
  const userUuid = task.userUuid;
  await withUniqueLock("autoAlchemy:" + userUuid, async () => {
    const current = await prisma.autoAlchemy.findUnique({ where: { id: task.id } });
    if (!current) return;
    if (current.status !== 'PENDING' && current.status !== 'PROCESSING') return;

    let targetTimes = current.targetTimes || 0;
    let doneTimes = current.doneTimes || 0;

    if (doneTimes >= targetTimes) {
      await prisma.autoAlchemy.update({ where: { id: current.id }, data: { status: 'FINISHED', isActive: false } });
      emitEventToUser(userUuid, 'alchemy:auto:finished', { uuid: current.uuid, doneTimes, targetTimes });
      return;
    }

    if (current.status === 'PENDING') {
      await prisma.autoAlchemy.update({ where: { id: current.id }, data: { status: 'PROCESSING', isActive: true } });
    }

    const input: ItemCountInfo = safeJsonParse(current.input, {});
    if (!input || Object.keys(input).length === 0) {
      await prisma.autoAlchemy.update({ where: { id: current.id }, data: { status: 'ERROR', lastError: '输入为空', isActive: false } });
      emitEventToUser(userUuid, 'alchemy:auto:error', { uuid: current.uuid, msg: '输入为空' });
      return;
    }

    try {
      const res = await doAlchemy(userUuid, input, {
        userEquipment: await lGetUserEquipment(userUuid),
      });
      const prevUsed = safeJsonParse<ItemCountInfo>(current.allUsedItems || '{}', {});
      const prevReward = safeJsonParse<ItemCountInfo>(current.allRewardItems || '{}', {});

      for (const [k, v] of Object.entries(res.usedItems || {})) {
        prevUsed[k] = { count: (prevUsed[k]?.count || 0) + (v?.count || 0) };
      }
      for (const [k, v] of Object.entries(res.rewardItems || {})) {
        prevReward[k] = { count: (prevReward[k]?.count || 0) + (v?.count || 0) };
      }

      doneTimes += 1;
      const updateData: any = {
        doneTimes,
        allUsedItems: JSON.stringify(prevUsed),
        allRewardItems: JSON.stringify(prevReward),
        updatedAt: new Date(),
      };
      if (doneTimes >= targetTimes) {
        updateData.status = 'FINISHED';
        updateData.isActive = false;
      }
      await prisma.autoAlchemy.update({ where: { id: current.id }, data: updateData });

      emitEventToUser(userUuid, 'alchemy:auto:progress', {
        uuid: current.uuid,
        doneTimes,
        targetTimes,
        lastReward: res.rewardItems,
      });

      if (doneTimes >= targetTimes) {
        emitEventToUser(userUuid, 'alchemy:auto:finished', {
          uuid: current.uuid,
          doneTimes,
          targetTimes,
          allRewardItems: prevReward,
          allUsedItems: prevUsed,
        });
      }
    } catch (e: any) {
      await prisma.autoAlchemy.update({ where: { id: current.id }, data: { status: 'ERROR', lastError: e.message || '执行失败', isActive: false } });
      emitEventToUser(userUuid, 'alchemy:auto:error', { uuid: current.uuid, msg: e.message || '执行失败' });
    }
  });
}

async function run() {
  const list = await prisma.autoAlchemy.findMany({
    where: { status: { in: ['PENDING', 'PROCESSING'] } },
    orderBy: { updatedAt: 'asc' },
    take: MAX_BATCH_PER_TICK,
  });
  for (const r of list) {
    await processOne(r);
  }
  if (list.length === 0) {
    console.log('[AutoAlchemy] no pending tasks');
  }
}

async function mainLoop() {
  console.log('[AutoAlchemy] 服务启动');
  while (running) {
    await run();
    await new Promise(res => setTimeout(res, INTERVAL));
  }
  console.log('[AutoAlchemy] 服务停止');
}

await mainLoop();
process.exit(0);
