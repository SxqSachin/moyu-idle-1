import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { doAlchemy, getUserAlchemyAtlas, fromInputToRecipe } from "../utils/game/alchemy";
import { emitEventToUser } from ".";
import { ItemCountInfo } from "~/shared/types/gameInventory";
import { delay, ObjectKeysTyped } from "~/shared/utils";
import { prisma } from "../utils/game/db";
import { withUniqueLock } from "../utils/lock";

/**
 * socket 接口：拍卖相关
 * 规范与 referrer.ts 一致：调用后 emitEventToUser(user, "<topic>:success"/":fail", { ... })
 * 关键路径使用 withUniqueLock 防止重复并发。
 */

/** 查询拍卖列表 */
export async function handleGetUserAlchemyAtlas(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const res = await getUserAlchemyAtlas(userUuid);
    emitEventToUser(userUuid, "alchemy:atlas:success", res);
  } catch (e: any) {
    emitEventToUser(userUuid, "alchemy:atlas:fail", { message: e.message });
  }
}

export async function handleUserStartAlchemyAction (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{input: ItemCountInfo}>
) {
  const userUuid = data.user.uuid;

  return;

  // Redis锁检查
  const lockKey = "alchemy:lock:" + userUuid;
  const lock = await redisClient.set(lockKey, "1", {
    NX: true,
    EX: 2,
  });

  if (lock !== "OK") {
    emitEventToUser(data.user, "alchemy:start:fail", {
      msg: "炼金台准备中...",
    });
    return;
  }

  await withUniqueLock("alchemy:" + userUuid, async () => {
    try {
      let be = await getUserAlchemyAtlas(userUuid);
      const {
        usedItems,
        rewardItems,
        atlas,
        successCount,
        mutationCount,
        expectMainOutput,
        recipeIndex,
        rewardTimes,
      } = await doAlchemy(userUuid, data.data.input);

      emitEventToUser(userUuid, "alchemy:start:success", {
        usedItems,
        rewardItems,
        successCount,
        mutationCount,
        expectMainOutput,
        recipeIndex,
        rewardTimes,
      });

      if (JSON.stringify(be) != JSON.stringify(atlas)) {
        emitEventToUser(userUuid, "alchemy:atlas:success", atlas);
      }
    } catch (e: any) {
      console.log(e);
      emitEventToUser(userUuid, "alchemy:start:fail", { message: e.message });
    }
  });
}

// 创建自动炼金请求
export async function handleUserRequestAutoAlchemy (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{input: ItemCountInfo, times: number}>
) {
  const userUuid = data.user.uuid;

  const lockKey = "alchemy:lock:" + userUuid;
  const lock = await redisClient.set(lockKey, "1", { NX: true, EX: 2 });
  if (lock !== "OK") {
    emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: "炼金台准备中..." });
    return;
  }

  await withUniqueLock("autoAlchemy:" + userUuid, async () => {
    try {
      const { input, times } = data.data;
      if (!input || typeof input !== 'object') {
        emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: "缺少输入材料" });
        return;
      }
      if (!times || times <= 0 || !Number.isInteger(times)) {
        emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: "次数必须为正整数" });
        return;
      }

      const parsed = fromInputToRecipe(input);
      if (!parsed.matched || !parsed.matched.recipe) {
        emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: "无法识别的炼金配方" });
        return;
      }
      const recipeId = parsed.matched.mainOutputResourceId;
      const recipeIndex = parsed.matched.recipeIndex;

      const existing = await prisma.autoAlchemy.findFirst({
        where: { userUuid, status: { in: ['PENDING','PROCESSING'] } }
      });
      if (existing) {
        emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: "已存在进行中的炼金活动" });
        return;
      }

      const record = await prisma.autoAlchemy.create({
        data: {
          userUuid,
          recipeId,
          recipeIndex,
          input: JSON.stringify(input),
          targetTimes: times,
          doneTimes: 0,
          status: 'PENDING',
          isActive: true,
          allUsedItems: '{}',
          allRewardItems: '{}'
        }
      });

      emitEventToUser(userUuid, "alchemy:auto:create:success", {
        uuid: record.uuid,
        recipeId,
        recipeIndex,
        targetTimes: times,
      });
    } catch (e: any) {
      console.error('[handleUserRequestAutoAlchemy] error', e);
      emitEventToUser(userUuid, "alchemy:auto:create:fail", { msg: e.message || '创建失败' });
    }
  });
}

// 查询当前自动炼金状态
export async function handleGetUserCurrentAutoAlchemy(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const rec = await prisma.autoAlchemy.findFirst({
      where: { userUuid, status: { in: ['PENDING','PROCESSING'] } },
      orderBy: { updatedAt: 'desc' }
    });
    if (!rec) {
      emitEventToUser(userUuid, 'alchemy:auto:current:success', { current: null });
      return;
    }
    emitEventToUser(userUuid, 'alchemy:auto:current:success', {
      current: {
        uuid: rec.uuid,
        recipeId: rec.recipeId,
        recipeIndex: rec.recipeIndex,
        targetTimes: rec.targetTimes,
        doneTimes: rec.doneTimes,
        status: rec.status,
        allUsedItems: rec.allUsedItems ? JSON.parse(rec.allUsedItems) : {},
        allRewardItems: rec.allRewardItems ? JSON.parse(rec.allRewardItems) : {},
        lastError: rec.lastError || undefined,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      }
    });
  } catch (e: any) {
    console.error('[handleGetUserCurrentAutoAlchemy] error', e);
    emitEventToUser(userUuid, 'alchemy:auto:current:fail', { msg: e.message || '查询失败' });
  }
}

// 历史自动炼金记录（完成/错误/取消），可分页（简单实现：limit 参数，默认 20）
export async function handleGetUserAutoAlchemyHistory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ limit?: number }>
) {
  const userUuid = data.user.uuid;
  try {
    const limit = Math.min(Math.max(1, data.data?.limit || 20), 100);
    const list = await prisma.autoAlchemy.findMany({
      where: { userUuid, status: { in: ['FINISHED','ERROR','CANCELLED'] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    const mapped = list.map(rec => ({
      uuid: rec.uuid,
      recipeId: rec.recipeId,
      recipeIndex: rec.recipeIndex,
      targetTimes: rec.targetTimes,
      doneTimes: rec.doneTimes,
      status: rec.status,
      allUsedItems: rec.allUsedItems ? JSON.parse(rec.allUsedItems) : {},
      allRewardItems: rec.allRewardItems ? JSON.parse(rec.allRewardItems) : {},
      lastError: rec.lastError || undefined,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    }));
    emitEventToUser(userUuid, 'alchemy:auto:history:success', { list: mapped });
  } catch (e: any) {
    console.error('[handleGetUserAutoAlchemyHistory] error', e);
    emitEventToUser(userUuid, 'alchemy:auto:history:fail', { msg: e.message || '查询失败' });
  }
}

// 取消当前自动炼金（仅对 PENDING/PROCESSING 生效）
export async function handleCancelAutoAlchemy(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid?: string }>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock("autoAlchemy:" + userUuid, async () => {
    try {
      const uuid = data.data?.uuid;
      let rec = null as null | typeof prisma.autoAlchemy extends infer T ? any : any;
      if (uuid) {
        rec = await prisma.autoAlchemy.findFirst({
          where: { userUuid, uuid, status: { in: ['PENDING','PROCESSING'] } },
        });
        if (!rec) {
          emitEventToUser(userUuid, 'alchemy:auto:cancelled', { ok: false, msg: '未找到可取消的任务（uuid）' } as any);
          return;
        }
      } else {
        rec = await prisma.autoAlchemy.findFirst({
          where: { userUuid, status: { in: ['PENDING','PROCESSING'] } },
          orderBy: { updatedAt: 'desc' },
        });
        if (!rec) {
          emitEventToUser(userUuid, 'alchemy:auto:cancelled', { ok: false, msg: '没有可取消的炼金任务' } as any);
          return;
        }
      }
      await prisma.autoAlchemy.update({ where: { id: rec.id }, data: { status: 'CANCELLED', isActive: false } });
      emitEventToUser(userUuid, 'alchemy:auto:cancelled', { ok: true, uuid: rec.uuid } as any);
    } catch (e: any) {
      emitEventToUser(userUuid, 'alchemy:auto:cancelled', { ok: false, msg: e.message || '取消失败' } as any);
    }
  })
}