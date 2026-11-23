import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import {
  randomElementInCollection,
  randomIntegerInFullCloseRange,
  randomNumberInFullColseRange,
  safeJsonParse,
} from "~/shared/utils";
import {
  CatVillageMonumentExtraData,
  VillageBuildingStatus,
} from "~/shared/types/village/building";
import { emitEventToUser } from "../..";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";
import {
  ModifyItemCountType,
} from "~/shared/types/gameInventory";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";

/** 查询拍卖列表 */
const VILLAGE_NORMAL_BUILDINGS_CACHE_KEY = "VILLAGE_NORMAL_BUILDINGS_LIST";
// 统一的村庄时长捐献类型标识，用于多业务共享表区分
const VILLAGE_DONATE_TYPE = "catVillageMonument";
// 排行榜缓存（当前生效）
const CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_KEY = "CAT_VILLAGE_MONUMENT_LEADERBOARD";
const CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_TTL = 60; // 秒
// 排行榜缓存（总供奉时长）
const CAT_VILLAGE_MONUMENT_TOTAL_LEADERBOARD_CACHE_KEY =
  "CAT_VILLAGE_MONUMENT_LEADERBOARD_TOTAL";
export async function consecrateCatVillageMonument(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ times: number }>
) {
  const userUuid = data.user.uuid;
  const times = data.data.times;

  if (times < 1 || times > 240) {
    emitEventToUser(userUuid, "catVillageMonument:consecrate:fail", {
      message: "祈福次数错误",
    });
    return;
  }

  if (!Number.isInteger(times)) {
    emitEventToUser(userUuid, "catVillageMonument:consecrate:fail", {
      message: "祈福次数错误",
    });
    return;
  }

  try {
    await withUniqueLock("catVillageMonumentConsecrate", async () => {
      return prisma.$transaction(async (tx) => {
        const building = await tx.villageBuilding.findUnique({
          where: {
            type: "catVillageMonument",
            status: {
              in: [
                VillageBuildingStatus.NORMAL,
                VillageBuildingStatus.PREPARE_UPGRADE,
                VillageBuildingStatus.UPGRADING,
              ],
            },
          },
        });

        if (!building?.level) {
          throw new Error("猫猫镇纪念碑状态错误");
        }

        const level = building.level;
        const extraConfig = allVillageBuilding.catVillageMonument.extra(level);

        const consecrateItems = extraConfig.consecrateItems;

        // 消耗的材料需要乘以 times
        for (const k of Object.keys(consecrateItems)) {
          const key = k as keyof ItemCountInfo;
          consecrateItems[key] = {
            count:
              (consecrateItems[key]?.count || 0) * times,
          };
        }

        // 检查物品是否足够
        const resourceRequirement =
          convertItemCountInfoToResourceRequirement(consecrateItems);
        const hasEnoughItems = await checkResourceRequirementInDB(
          userUuid,
          resourceRequirement,
          tx
        );

        if (!hasEnoughItems) {
          throw new Error("物品不足，无法祈福");
        }

        await decreaseItemCount(
          userUuid,
          consecrateItems,
          {
            actionName: "猫猫镇纪念碑祈福 " + times + "分钟",
            type: ModifyItemCountType.ActionUse,
            showModifyInfo: true,
            sendModifyEvent: true,
          },
          tx
        );
        await invalidateInventoryCache(userUuid);

        const extraRewardCount = Math.floor(
          times / extraConfig.extraDropRewardPerTimes
        );

        if (extraRewardCount > 0) {
          const pool = extraConfig.rewardPool || [];
          // 归一化：将各分组 percent 作为权重，按 (weight / Σweight) 概率挑选一个分组。
          // 注意：若配置的 percent 不相加为 1，会进行归一化；若总和<=0，则各组等概率。
          const groups = pool.filter((g) => !!g && Array.isArray(g.ids) && g.ids.length > 0);
          const rawWeights = groups.map((g) => Math.max(0, g.percent || 0));
          let sumW = rawWeights.reduce((a, b) => a + b, 0);
          if (sumW <= 0) {
            // 全为0或非法，退化为等概率
            for (let i = 0; i < rawWeights.length; i++) rawWeights[i] = 1;
            sumW = rawWeights.length || 1;
          }
          const thresholds: number[] = [];
          {
            let acc = 0;
            for (const w of rawWeights) {
              acc += w / sumW;
              thresholds.push(acc);
            }
          }
          const pickGroup = () => {
            if (!groups.length) return null as any;
            const r = Math.random(); // [0,1)
            for (let i = 0; i < thresholds.length; i++) {
              if (r < thresholds[i]) return groups[i];
            }
            return groups[groups.length - 1];
          };

          const rewardRes: ItemCountInfo = {};
          for (let i = 0; i < extraRewardCount; i++) {
            const g = pickGroup();
            if (!g) continue;
            // 奖励数量必须为整数，避免写入 BigInt/整数列时报错
            const qty = randomIntegerInFullCloseRange(g.range.min, g.range.max);
            const id = randomElementInCollection(g.ids);
            if (!id) continue;
            const key = id as keyof ItemCountInfo;
            if (!rewardRes[key]) rewardRes[key] = { count: 0 } as any;
            rewardRes[key]!.count += qty;
          }

          if (Object.keys(rewardRes).length > 0) {
            await enqueueToHarvestBox(userUuid, rewardRes, {
              title: "猫猫镇纪念碑奖励",
              source: "Other",
            });
          }
        }

        // 记录供奉窗口到数据库（用于排行榜：按当前有效剩余时长排序）
        const now = new Date();
        // 查询最近一条记录的 endAt（ORM）
        const last = await tx.villageDurationDonateContribution.findFirst({
          where: { userUuid, type: VILLAGE_DONATE_TYPE },
          orderBy: { endAt: "desc" },
          select: { endAt: true },
        });
        const lastEndAt = last?.endAt ?? null;
        const effectiveStartAt = lastEndAt && lastEndAt > now ? lastEndAt : now;
        const effectiveEndAt = new Date(
          effectiveStartAt.getTime() + times * 60 * 1000
        );
        await tx.villageDurationDonateContribution.create({
          data: {
            userUuid,
            type: VILLAGE_DONATE_TYPE,
            startAt: effectiveStartAt,
            endAt: effectiveEndAt,
            minutes: times,
            // createdAt: 自动默认 now()
          },
        });
        // 新增供奉后，失效排行榜缓存（当前生效与总时长）——缓存失效失败不影响供奉成功
        try {
          await redisClient.del(CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_KEY);
          await redisClient.del(CAT_VILLAGE_MONUMENT_TOTAL_LEADERBOARD_CACHE_KEY);
        } catch {}

        let ext = safeJsonParse<CatVillageMonumentExtraData>(building.extra);

        if (!ext) {
          ext = {
            consecrateUntil: Date.now(),
          };
        }

        if (ext.consecrateUntil > Date.now()) {
          ext.consecrateUntil += data.data.times * (60 * 1) * 1000;
        } else {
          ext.consecrateUntil = Date.now() + data.data.times * (60 * 1) * 1000;
        }

        await tx.villageBuilding.update({
          where: {
            uuid: building.uuid,
          },
          data: {
            extra: JSON.stringify(ext),
          },
        });

        await redisClient.del(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY);

        emitEventToUser(userUuid, "catVillageMonument:consecrate:success");
      });
    });
  } catch (e: any) {
    emitEventToUser(userUuid, "catVillageMonument:consecrate:fail", {
      message: e.message || "祈福失败",
    });
  }
}

/**
 * 查询征战圣火纪念碑供奉排行榜（基于当前时刻仍然生效的剩余时长汇总）。
 * 返回每个玩家尚未过期的供奉窗口覆盖时间之和（秒），按降序排序。
 */
export async function queryCatVillageMonumentLeaderboard(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ limit?: number }>
) {
  const userUuid = data.user.uuid;
  // 按需求：不再截取，返回所有人的数据

  try {
    // 先走缓存：缓存存 Top100 原始数据，这里再 slice + rank
    try {
      const cached = await redisClient.get(
        CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_KEY
      );
      if (cached) {
        const fullList = JSON.parse(cached) as Array<{
          userUuid: string;
          activeSeconds: number;
        }>;
        const list = fullList.map((x, idx) => ({ rank: idx + 1, ...x }));
        emitEventToUser(userUuid, "catVillageMonument:leaderboard:success", {
          list,
        });
        return;
      }
    } catch {}

    // 使用 ORM 读取仍未过期的窗口，并在应用侧聚合当前剩余秒数
    const now = new Date();
    const rows = await prisma.villageDurationDonateContribution.findMany({
      where: { type: VILLAGE_DONATE_TYPE, endAt: { gt: now } },
      select: { userUuid: true, startAt: true, endAt: true },
    });

    const acc = new Map<string, number>();
    for (const r of rows) {
      const overlapStart = r.startAt > now ? r.startAt : now;
      if (r.endAt > overlapStart) {
        const deltaSec = Math.floor(
          (r.endAt.getTime() - overlapStart.getTime()) / 1000
        );
        acc.set(r.userUuid, (acc.get(r.userUuid) ?? 0) + deltaSec);
      }
    }

    const fullList = Array.from(acc.entries())
      .map(([uuid, seconds]) => ({ userUuid: uuid, activeSeconds: seconds }))
      .filter((x) => x.activeSeconds > 0)
      .sort((a, b) => b.activeSeconds - a.activeSeconds);

    // 写缓存，仅在读时构建并写入
    try {
      await redisClient.set(
        CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_KEY,
        JSON.stringify(fullList),
        {
          expiration: {
            type: "EX",
            value: CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_TTL,
          },
        }
      );
    } catch {}

    const list = fullList.map((x, idx) => ({ rank: idx + 1, ...x }));
    emitEventToUser(userUuid, "catVillageMonument:leaderboard:success", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "catVillageMonument:leaderboard:fail", {
      message: e.message || "查询排行榜失败",
    });
  }
}

/**
 * 总供奉时长排行榜（历史累计时长，单位：秒）
 */
export async function queryCatVillageMonumentTotalLeaderboard(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ limit?: number }>
) {
  const userUuid = data.user.uuid;
  // 按需求：不再截取，返回所有人的数据

  try {
    // 缓存优先（Top100）
    try {
      const cached = await redisClient.get(
        CAT_VILLAGE_MONUMENT_TOTAL_LEADERBOARD_CACHE_KEY
      );
      if (cached) {
        const fullList = JSON.parse(cached) as Array<{
          userUuid: string;
          totalSeconds: number;
        }>;
        const list = fullList.map((x, idx) => ({ rank: idx + 1, ...x }));
        emitEventToUser(userUuid, "catVillageMonument:leaderboard:total:success", {
          list,
        });
        return;
      }
    } catch {}

    let fullList: Array<{ userUuid: string; totalSeconds: number }> = [];
    // 优先尝试 groupBy（若不支持则回退）
    try {
      const grouped = await prisma.villageDurationDonateContribution.groupBy({
        by: ["userUuid"],
        where: { type: VILLAGE_DONATE_TYPE },
        _sum: { minutes: true },
      });
      fullList = grouped
        .map((g) => ({
          userUuid: g.userUuid,
          totalSeconds: Math.floor((g._sum.minutes ?? 0) * 60),
        }))
        .filter((x) => x.totalSeconds > 0)
        .sort((a, b) => b.totalSeconds - a.totalSeconds);
    } catch {
      const rows = await prisma.villageDurationDonateContribution.findMany({
        where: { type: VILLAGE_DONATE_TYPE },
        select: { userUuid: true, minutes: true },
      });
      const acc = new Map<string, number>();
      for (const r of rows) {
        const sec = Math.floor((r.minutes ?? 0) * 60);
        acc.set(r.userUuid, (acc.get(r.userUuid) ?? 0) + sec);
      }
      fullList = Array.from(acc.entries())
        .map(([uuid, seconds]) => ({ userUuid: uuid, totalSeconds: seconds }))
        .filter((x) => x.totalSeconds > 0)
        .sort((a, b) => b.totalSeconds - a.totalSeconds);
    }

    // 写缓存
    try {
      await redisClient.set(
        CAT_VILLAGE_MONUMENT_TOTAL_LEADERBOARD_CACHE_KEY,
        JSON.stringify(fullList),
        {
          expiration: {
            type: "EX",
            value: CAT_VILLAGE_MONUMENT_LEADERBOARD_CACHE_TTL,
          },
        }
      );
    } catch {}

    const list = fullList.map((x, idx) => ({ rank: idx + 1, ...x }));
    emitEventToUser(userUuid, "catVillageMonument:leaderboard:total:success", {
      list,
    });
  } catch (e: any) {
    emitEventToUser(userUuid, "catVillageMonument:leaderboard:total:fail", {
      message: e.message || "查询总排行榜失败",
    });
  }
}
