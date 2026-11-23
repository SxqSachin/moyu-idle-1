import type { Quest, QuestReward, QuickCreateActionQuestParams } from "~/shared/types/quest";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../prisma";
import { redisClient as redis } from '../redis'
import type { AllGameActionID, AllGameActionMainType } from "~/shared/types/gameAction";
import { allGameAction, allGameActionMainType } from "~/shared/data/allGameActions";
import { questRewardPool, type QuestRewardPollItem } from "~/shared/data/allGameResources";
import { randomIntegerInFullCloseRange } from "~/shared/utils";
import { GameBroadcastKind, type UserQuestUpdateMessage } from "~/shared/types/broadcast";
import { publishGameBroadcast } from "./broadcastHub"

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
 * 快速创建一个动作类任务
 */

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

export async function updateQuestProgress(
    questUuid: string,
    increment: number
): Promise<Quest> {
    // 查询任务
    const dbQuest = await prisma.quest.findUnique({ where: { uuid: questUuid } });
    if (!dbQuest) throw new Error("任务不存在");

    // 计算新的 current
    const current = Math.min(
        (dbQuest.targetCurrentCount ?? 0) + increment,
        dbQuest.targetGoalCount
    );

    // 判断是否完成
    const isDone = current >= dbQuest.targetGoalCount;

    // 更新数据库
    const updated = await prisma.quest.update({
        where: { uuid: questUuid },
        data: {
            targetCurrentCount: current,
            updatedAt: new Date(),
            ...(isDone && dbQuest.status !== "DONE"
                ? {
                    status: "DONE",
                    completedAt: new Date(),
                }
                : {}),
        },
    });

    const quest = toQuestType(updated);
    await updateQuestListCache(quest.executor);

    await publishGameBroadcast<UserQuestUpdateMessage>({
        kind: GameBroadcastKind.USER_QUEST_UPDATED,
        userUuid: quest.executor
    })

    return quest;
}

export async function getMultiQuestList(executorList: string[]): Promise<Map<string, Quest[]>> {
    const result: Map<string, Quest[]> = new Map();
    if (!executorList.length) return result;

    // 1. 批量从 Redis 获取
    const cacheKeys = executorList.map(QUEST_LIST_CACHE_KEY);
    const cacheResults = await redis.mGet(cacheKeys);

    if (!cacheResults?.length) {
        return result;
    }

    // 2. 解析缓存，记录未命中的 executor
    const missedExecutors: string[] = [];
    executorList.forEach((executor, idx) => {
        // @ts-ignore
        const cache = cacheResults[idx];
        if (cache) {
            try {
                // todo json parse take long time
                result.set(executor, JSON.parse(cache) as Quest[]);
            } catch {
                missedExecutors.push(executor);
            }
        } else {
            missedExecutors.push(executor);
        }
    });

    // 3. 对未命中的批量查数据库
    if (missedExecutors.length) {
        const dbQuests = await prisma.quest.findMany({
            where: {
                executor: { in: missedExecutors },
                status: { in: ["PENDING", "DOING"] },
            },
            orderBy: { createdAt: "desc" },
            take: 20 * missedExecutors.length, // 每人最多20条
        });
        // 按 executor 分组
        const questMap: Record<string, Quest[]> = {};
        for (const dbQuest of dbQuests) {
            const quest = toQuestType(dbQuest);
            if (!questMap[quest.executor]) questMap[quest.executor] = [];
            if (questMap[quest.executor].length < 20) {
                questMap[quest.executor].push(quest);
            }
        }
        // 批量缓存
        await Promise.all(
            Object.entries(questMap).map(([executor, quests]) =>
                cacheQuestList(executor, quests)
            )
        );
        // 合并结果
        Object.entries(questMap).forEach(([executor, quests]) => {
            result.set(executor, quests);
        });
    }

    return result;
}

export async function getQuestList(executor: string): Promise<Quest[]> {
    const cacheKey = QUEST_LIST_CACHE_KEY(executor);
    const cache = await redis.get(cacheKey);
    if (cache) {
        try {
            return JSON.parse(cache) as Quest[];
        } catch { /* ignore */ }
    }
    console.log("GET QUEST IN SQL ", executor)
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

export async function getQuestListByExecutorAndActionId(
    executor: string,
    targetActionId: string
): Promise<Quest[]> {
    let questList = await getQuestList(executor);

    return questList.filter(quest => {
        return quest.target.actionId === targetActionId
    })

    // const dbQuests = await prisma.quest.findMany({
    //     where: {
    //         executor,
    //         targetActionId,
    //         status: {
    //             in: ["PENDING", "DOING", "DONE"], // 只查有效任务
    //         },
    //     },
    //     orderBy: { createdAt: "desc" },
    // });
    // return dbQuests.map(toQuestType);
}

async function updateQuestListCache(executor: string) {
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

async function cacheQuestList(executor: string, quests: Quest[]) {
    await redis.set(QUEST_LIST_CACHE_KEY(executor), JSON.stringify(quests), {
        expiration: {
            type: "EX",
            value: QUEST_CACHE_EXPIRE
        }
    });
}

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

export function quickGenerateActionQuest({
    mainType,
    executor,
    rewards = [],
    difficulty = 1,
    count,
}: QuickCreateActionQuestParams): Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt"> {
    let attempts = 0;
    const maxAttempts = 50; // 最大重试次数，防止无限循环
    
    while (attempts < maxAttempts) {
        attempts++;
        
        try {
            // 如果没有指定 mainType，随机选择一个
            let currentMainType = mainType;
            if (!currentMainType) {
                currentMainType = getRandomMainType();
            }
            
            // 检查 mainType 是否有效
            if (!allGameActionMainType[currentMainType]) {
                console.warn(`无效的 mainType: ${currentMainType}，尝试重新选择...`);
                continue;
            }
            
            // 尝试获取随机 actionId
            const actionId = getRandomActionId(currentMainType);
            if (!actionId) {
                console.warn(`mainType ${currentMainType} 没有可用的 actions，尝试重新选择...`);
                continue;
            }
            
            // 检查 action 是否存在
            const action = allGameAction[actionId];
            if (!action) {
                console.warn(`action ${actionId} 不存在于 allGameAction 中，尝试重新选择...`);
                continue;
            }
            
            // 验证 action 的必要属性
            if (!action.name) {
                console.warn(`action ${actionId} 缺少 name 属性，尝试重新选择...`);
                continue;
            }
            
            // 生成任务数量
            const questCount = count ?? randomIntegerInFullCloseRange(4 + difficulty * 10, 8 + 12 * difficulty);
            const mainTypeName = allGameActionMainType[currentMainType]?.name || currentMainType;

            // 创建任务对象
            const quest: Omit<Quest, "uuid" | "createdAt" | "updatedAt" | "completedAt"> = {
                title: `${mainTypeName}：${action.name}   ${questCount}次`,
                actionMainType: currentMainType,
                description: action.description || `执行 ${action.name} 任务`,
                executor,
                difficulty,
                status: "PENDING",
                target: {
                    actionId,
                    count: questCount,
                    current: 0,
                },
                rerollCount: 0,
                rewards: rewards,
                dueDate: undefined,
            };
            
            console.log(`成功生成任务 (尝试第${attempts}次): ${quest.title}`);
            return quest;
            
        } catch (error: any) {
            console.error(`生成任务失败 (尝试第${attempts}次):`, {
                error: error.message,
                mainType,
                attempts
            });
        }
    }
    
    // 如果所有尝试都失败了，抛出错误
    throw new Error(`经过 ${maxAttempts} 次尝试后仍无法生成有效任务。请检查 allGameAction 和 allGameActionMainType 数据的完整性。`);
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