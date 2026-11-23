import type { Quest, QuestReward, QuickCreateActionQuestParams } from "~/shared/types/quest";
import { v4 as uuidv4 } from "uuid";
import { AllGameActionID, AllGameActionMainType } from "~/shared/types/gameAction";
import { allGameAction, allGameActionMainType } from "~/shared/data/allGameActions";
import { randomIntegerInFullCloseRange } from "~/shared/utils";
import { getInventoryInfo, increaseItemCount, } from "./characterInventory";
import { AllGameResourceIDWithInternal } from "~/shared/types/gameResource";
import { prisma } from "./db";
import { QuestRewardPollItem, questRewardPool } from "~/shared/data/allGameResources";
import { redisClient as redis } from '../index'; // 假设你有redis实例
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { GameBroadcastKind, UserQuestUpdateMessage } from "~/shared/types/broadcast";

const QUEST_LIST_CACHE_KEY = (executor: string) => `quest:list:${executor}`;
const QUEST_CACHE_EXPIRE = 60 * 60 * 4; // 4小时

// 工具：序列化/反序列化
function serializeRewards(rewards: QuestReward[]) {
    return JSON.stringify(rewards);
}
function deserializeRewards(rewards: string): QuestReward[] {
    return JSON.parse(rewards);
}

/**
 * 随机生成一个动作ID
 */
function getRandomActionId(mainType: AllGameActionMainType): AllGameActionID {
    const actions = allGameActionMainType[mainType]?.actions;
    if (!actions || actions.length === 0) throw new Error("No actions for this mainType");
    const idx = Math.floor(Math.random() * actions.length);
    return actions[idx];
}

function getRandomMainType(): (keyof typeof questRewardPool) {
    const mainTypes = Object.keys(questRewardPool) as (keyof typeof questRewardPool)[];
    const idx = Math.floor(Math.random() * mainTypes.length);
    return mainTypes[idx];
}
// 包装数据库结果为 Quest 类型
function toQuestType(dbQuest: any): Quest {
    return {
        uuid: dbQuest.uuid,
        title: dbQuest.title,
        actionMainType: dbQuest.actionMainType,
        description: dbQuest.description ?? undefined,
        executor: dbQuest.executor,
        difficulty: dbQuest.difficulty,
        createdAt: dbQuest.createdAt,
        updatedAt: dbQuest.updatedAt ?? undefined,
        completedAt: dbQuest.completedAt ?? undefined,
        dueDate: dbQuest.dueDate ?? undefined,
        status: dbQuest.status,
        rerollCount: dbQuest.rerollCount ?? 0,
        target: {
            actionId: dbQuest.targetActionId,
            count: dbQuest.targetGoalCount,
            current: dbQuest.targetCurrentCount,
        },
        rewards: deserializeRewards(dbQuest.rewards),
    };
}

// 缓存任务列表
async function cacheQuestList(executor: string, quests: Quest[]) {
    await redis.set(QUEST_LIST_CACHE_KEY(executor), JSON.stringify(quests), {
        expiration: {
            type: "EX",
            value: QUEST_CACHE_EXPIRE
        }
    });
}
export async function updateQuestListCache(executor: string) {
    const quests = await prisma.quest.findMany({
        where: {
            executor,
            status: {
                in: ["PENDING", "DOING", "DONE"],
            },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
    const questList = quests.map(toQuestType);
    await cacheQuestList(executor, questList);
}

// 创建任务
export async function createQuest(
    quest: Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt">
): Promise<Quest> {
    const result = await prisma.quest.create({
        data: {
            uuid: uuidv4(),
            title: quest.title,
            actionMainType: quest.actionMainType,
            description: quest.description,
            executor: quest.executor,
            difficulty: quest.difficulty,
            createdAt: new Date(),
            status: quest.status,
            targetActionId: quest.target.actionId,
            targetGoalCount: quest.target.count,
            targetCurrentCount: quest.target.current,
            rewards: serializeRewards(quest.rewards),
            dueDate: quest.dueDate,
        },
    });
    const questObj = toQuestType(result);
    await updateQuestListCache(questObj.executor); // 立即刷新缓存
    await publishGameBroadcast<UserQuestUpdateMessage>({
        kind: GameBroadcastKind.USER_QUEST_UPDATED,
        userUuid: questObj.executor
    })
    return questObj;
}

// 完成任务
export async function completeQuest(questId: string): Promise<Quest> {
    // 查询任务
    const dbQuest = await prisma.quest.findUnique({ where: { uuid: questId } });
    if (!dbQuest) throw new Error("任务不存在");

    const quest = toQuestType(dbQuest);

    // 检查是否已完成
    if (quest.status === "CLOSED") throw new Error("任务已关闭");
    if (quest.status !== "DONE") throw new Error("任务未完成");
    if (quest.target.current < quest.target.count) throw new Error("任务尚未完成目标");

    // 发放奖励（使用 increaseItemCount 批量发放）
    const rewardCountInfo: ItemCountInfo = {};
    for (const reward of quest.rewards) {
        if (!reward.resourceId || !reward.count) continue;
        rewardCountInfo[reward.resourceId as AllGameResourceIDWithInternal] = { count: reward.count };
    }
    if (Object.keys(rewardCountInfo).length > 0) {
        await increaseItemCount(quest.executor, rewardCountInfo, { 
            actionName: "任务奖励",
            showModifyInfo: true,
            type: ModifyItemCountType.Other,
            sendModifyEvent: true,
        });
    }

    // 更新任务状态
    const updated = await prisma.quest.update({
        where: { uuid: questId },
        data: {
            status: "CLOSED",
            completedAt: new Date(),
            updatedAt: new Date(),
        },
    });

    const questObj = toQuestType(updated);
    await updateQuestListCache(questObj.executor); // 立即刷新缓存

    await publishGameBroadcast<UserQuestUpdateMessage>({
        kind: GameBroadcastKind.USER_QUEST_UPDATED,
        userUuid: questObj.executor
    });

    return questObj;
}

export async function completeAllDoneQuest(executor: string) {
  // 查询所有可完成的任务
  const dbQuests = await prisma.quest.findMany({
    where: {
      executor,
      status: "DONE",
    },
  });

  for (const dbQuest of dbQuests) {
    const quest = toQuestType(dbQuest);

    if (quest.status !== "DONE") continue;
    if (quest.target.current < quest.target.count) continue;

    const thisQuestReward: ItemCountInfo = {};
    for (const reward of quest.rewards) {
      if (!reward.resourceId || !reward.count) continue;
      thisQuestReward[reward.resourceId as AllGameResourceIDWithInternal] = {
        count: reward.count,
      };
    }
    if (Object.keys(thisQuestReward).length > 0) {
      await increaseItemCount(quest.executor, thisQuestReward, {
        actionName: "任务奖励",
        showModifyInfo: true,
        type: ModifyItemCountType.Other,
        sendModifyEvent: true,
      });
    }

    // 更新任务状态
    await prisma.quest.update({
      where: { uuid: quest.uuid },
      data: {
        status: "CLOSED",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  await updateQuestListCache(executor); // 立即刷新缓存

  await publishGameBroadcast<UserQuestUpdateMessage>({
      kind: GameBroadcastKind.USER_QUEST_UPDATED,
      userUuid: executor
  });
}

// 重新随机一个新任务
export async function rerollQuest(
    questUuid: string,
    newQuest: Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt">,
): Promise<Quest> {
    // 将原任务的数据替换为新任务的
    const dbQuest = await prisma.quest.findUnique({ where: { uuid: questUuid } });
    if (!dbQuest) throw new Error("任务不存在");
    if (dbQuest.status === "DONE") throw new Error("任务已完成，无法重置");
    if (dbQuest.status === "CLOSED") throw new Error("任务已关闭，无法重置");
    if (dbQuest.status === "REROLL") throw new Error("任务已在重置中，请稍后再试");
    if (dbQuest.status !== "PENDING") throw new Error("只能对待办任务进行重置");

    // 检查新任务的有效性
    if (!newQuest || !newQuest.actionMainType || !newQuest.target || newQuest.target.count <= 0) {
        throw new Error("新任务参数无效");
    }

    // 确保新任务的奖励是有效的
    if (!newQuest.rewards || newQuest.rewards.length === 0) {
        throw new Error("新任务必须包含奖励");
    }

    // 更新任务
    // 注意：这里我们将新任务的所有字段都更新到原任务中
    // 但保留原任务的 uuid、createdAt 字段
    // 以便前端可以处理这个状态
    const updatedQuest = {
        ...dbQuest,
        title: newQuest.title,
        actionMainType: newQuest.actionMainType,
        description: newQuest.description,
        executor: newQuest.executor,
        difficulty: newQuest.difficulty,
        targetActionId: newQuest.target.actionId,
        targetGoalCount: newQuest.target.count,
        targetCurrentCount: 0, // 重置当前进度
        rewards: serializeRewards(newQuest.rewards),
        dueDate: newQuest.dueDate ?? null, // 保持原有的截止日期
    };

    // 更新数据库
    const quest = await prisma.quest.update({
        where: { uuid: questUuid },
        data: {
            ...updatedQuest,
            status: "PENDING",
            updatedAt: new Date(),
            completedAt: null, // 重置完成时间
            rerollCount: (dbQuest.rerollCount || 0) + 1, // 增加重置次数
        },
    });

    const questObj = toQuestType(quest);
    await updateQuestListCache(questObj.executor); // 立即刷新缓存

    await publishGameBroadcast<UserQuestUpdateMessage>({
        kind: GameBroadcastKind.USER_QUEST_UPDATED,
        userUuid: questObj.executor
    });

    return questObj;
}

// 获取任务列表（带缓存）
export async function getQuestList(executor: string, ignoreCache = false): Promise<Quest[]> {
    if (!ignoreCache) {
        const cacheKey = QUEST_LIST_CACHE_KEY(executor);
        const cache = await redis.get(cacheKey);
        if (cache) {
            try {
                return JSON.parse(cache) as Quest[];
            } catch { /* ignore */ }
        }
    }
    const quests = await prisma.quest.findMany({
        where: {
            executor,
            status: {
                in: ["PENDING", "DOING", "DONE"], // 只下发可用任务
            },
        },
        orderBy: { createdAt: "desc" },
        take: 20, // 只返回最近20条
    });
    const questList = quests.map(toQuestType);
    await cacheQuestList(executor, questList);
    return questList;
}

/**
 * 快速创建一个动作类任务
 */

export function quickGenerateActionQuest({
    mainType,
    executor,
    rewards = [],
    difficulty = 1,
    count,
}: QuickCreateActionQuestParams): Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt"> {
    if (!mainType) {
        mainType = getRandomMainType()
    }
    const actionId = getRandomActionId(mainType);
    const action = allGameAction[actionId];
    const questCount = count ?? randomIntegerInFullCloseRange(4 + difficulty * 10, 8 + 12 * difficulty);
    const mainTypeName = allGameActionMainType[mainType]?.name || mainType;

    const finalRewards = rewards;

    const quest: Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt"> = {
        title: `${mainTypeName}：${action.name}${questCount}次`,
        actionMainType: mainType,
        description: action.description,
        executor,
        difficulty,
        status: "PENDING",
        target: {
            actionId,
            count: questCount,
            current: 0,
        },
        rerollCount: 0,
        rewards: finalRewards,
        dueDate: undefined,
    };

    return quest
}

export async function quickCreateActionQuest({
    mainType,
    executor,
    rewards = [],
    difficulty = 1,
    count,
}: QuickCreateActionQuestParams): Promise<Quest> {
    return await createQuest(quickGenerateActionQuest({
        mainType,
        executor,
        rewards,
        difficulty,
        count,
    }));
}


export function generateQuestParam(user: string) {
    // 随机选择一个mainType
    const mainTypes = Object.keys(questRewardPool) as (keyof typeof questRewardPool)[]
    const mainType = mainTypes[randomIntegerInFullCloseRange(0, mainTypes.length - 1)];

    // 难度随机1~5
    const difficulty = randomIntegerInFullCloseRange(1, 3);

    // 从奖励池按概率抽取奖励
    let pool: QuestRewardPollItem[] = []
    let times = 0;
    while (!pool.length && times++ < 10) {
        let thisPool = questRewardPool[mainType];
        if (thisPool && thisPool[difficulty]) {
            pool = thisPool[difficulty]
        }
    }

    const rewards: QuestReward[] = pool
        .filter((r) => Math.random() < r.percent)
        .map((poolItem) => ({
            resourceId: poolItem.resourceId,
            count: randomIntegerInFullCloseRange(poolItem.range),
            // 可根据QuestReward类型补充其他必需字段
        }));

    const param: QuickCreateActionQuestParams = {
        executor: user,
        mainType,
        difficulty,
        rewards,
    };

    return param;
}