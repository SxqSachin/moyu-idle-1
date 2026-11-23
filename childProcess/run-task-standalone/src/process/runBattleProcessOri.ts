import { generateCallback } from '../utils/game/battle';
import { runBattle } from '../process/runBattle';
import { getAllRoomKeys, getRoomsByIds } from '../utils/game/room';
import { logger } from '../utils/logger.js'
import { loadUnitStatisticFromRedis, saveUnitStatisticIntoRedis, setGlobalBattleCallbackGenerator } from '~/server/utils/game/battleAction';
import { redisClient } from '../utils/redis'
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from '~/shared/utils';

// 基础定时与发现间隔（ms）
const INTERVAL = 1380;
const ROOM_DISCOVERY_INTERVAL = 5000;
// 回合起始到下一回合起始的最小等待（不得小于此值）
const MIN_WAIT_MS = 300;

// 简化版 slot：使用 100ms 粒度的 bucket（最多 10 份），每个房间固定分配一个 bucketOffset
// 优点：实现简单、每次只会额外偏移 0..(SLOT_BUCKETS-1)*BUCKET_MS（最多 900ms），避免之前复杂逻辑导致的多次叠加延迟
const BUCKET_MS = 200;
const SLOT_BUCKETS = Math.min(10, Math.max(1, Math.floor(INTERVAL / BUCKET_MS)));

function parseArgs() {
    const groupArg = process.argv.find(arg => arg.startsWith('--group='));
    const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
    const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
    const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
    return { group, groupCount };
}

const { group, groupCount } = parseArgs();

interface BattleSchedule {
    roomUuid: string;
    nextRunTime: number;
    isRunning: boolean;
    lastStartTime?: number;    // 当前正在运行时的开始时间（用于卡住检测）
    lastRunEndTime?: number;   // 上一次实际结束时间（用于统计/调度参考）
}

const battleSchedules = new Map<string, BattleSchedule>();

/**
 * 简易字符串哈希，映射为非负整数
 */
// function hashStringToPositive(s: string) {
//     let h = 0;
//     for (let i = 0; i < s.length; i++) {
//         h = (h * 31 + s.charCodeAt(i)) | 0;
//     }
//     return Math.abs(h);
// }

/**
 * 返回 bucketIndex (0..SLOT_BUCKETS-1)
 * bucketOffset = bucketIndex * BUCKET_MS
 */
// function getBucketIndexForRoom(roomUuid: string) {
//     return hashStringToPositive(roomUuid) % SLOT_BUCKETS;
// }

// Fisher-Yates 随机打乱数组，避免固定顺序导致同一批次的固定偏向
function shuffleArray<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 核心战斗处理函数（已移除跨进程锁与复杂 slot 逻辑）
// 要求：保证从本次回合开始到下次回合开始 >= INTERVAL，但允许把 runBattle 耗时从 INTERVAL 中抵扣（最小等待不小于 MIN_WAIT_MS）
async function processBattle(roomUuid: string): Promise<void> {
    const schedule = battleSchedules.get(roomUuid);
    if (!schedule || schedule.isRunning) return;

    schedule.isRunning = true;
    const startProcBattle = Date.now();
    schedule.lastStartTime = startProcBattle;

    try {
        await runBattle(roomUuid);
    } catch (error: any) {
        logger.error(`Battle failed for room ${roomUuid}: ${error?.message ?? error}`);
        console.log(error)
    } finally {
        const endProcBattle = Date.now();
        const duration = endProcBattle - startProcBattle;

        try {
            // 1) earliestNextStart：基于“从本次开始到下次开始 >= INTERVAL”的约束，
            //    允许用本次 duration 抵扣 INTERVAL，但至少要等待 MIN_WAIT_MS
            const waitFromStart = Math.max(INTERVAL - duration, MIN_WAIT_MS);
            const earliestNextStart = startProcBattle + INTERVAL + randomIntegerInFullCloseRange(60, 120);

            // // 2) 简单 bucket 偏移：在 earliestNextStart 基础上加上固定 bucketOffset（0,100,..）
            // //    这样可以把房间在短时间内错开（粒度 100ms），避免复杂对齐逻辑导致多次推迟。
            // const bucketIndex = getBucketIndexForRoom(roomUuid);
            // const bucketOffset = bucketIndex * BUCKET_MS;

            // // candidate = earliestNextStart + bucketOffset
            // // 说明：最多会额外延后 (SLOT_BUCKETS-1)*BUCKET_MS（<= 900ms），但不会再因为 while 循环叠加多个 INTERVAL
            // let candidate = earliestNextStart + bucketOffset;

            // // 防护：如果 candidate 太接近现在（防止时间回退或极小差值），至少保证比 now 多 10ms
            // candidate = Math.max(candidate, Date.now() + 10);

            schedule.nextRunTime = earliestNextStart;
            schedule.lastRunEndTime = endProcBattle;
        } catch (err: any) {
            logger.warn(`Failed to compute nextRunTime for ${roomUuid}: ${err?.message ?? err}`);
            schedule.nextRunTime = Date.now() + Math.max(INTERVAL, MIN_WAIT_MS);
        }

        schedule.isRunning = false;
        schedule.lastStartTime = undefined;
    }
}

// 获取当前进程负责的房间（按 group 分片）
async function getMyActiveRooms(): Promise<string[]> {
    try {
        const allRoomKeys = await getAllRoomKeys();
        const total = allRoomKeys.length;
        const groupSize = Math.ceil(total / groupCount);
        const start = group * groupSize;
        const end = group === groupCount - 1 ? total : (group + 1) * groupSize;
        const myRoomIds = allRoomKeys.slice(start, end);

        if (myRoomIds.length === 0) return [];

        const rooms = await getRoomsByIds(myRoomIds);
        return rooms
            .filter(room => room && ['battling', 'waiting_for_autostart', 'waiting_for_restart', 'go_to_area'].includes(room.status))
            .map(room => room.uuid);
    } catch (error: any) {
        logger.error(`Process ${group} failed to get active rooms:`, error);
        return [];
    }
}

// 更新战斗调度：删除不活跃、添加新房间（并使用简单 bucket 分配 nextRunTime）
// 注意：保证新添加或重新加入的房间不会在小于 INTERVAL 的等待后再次运行。
async function updateSchedules() {
    const activeRooms = await getMyActiveRooms();
    const now = Date.now();

    // 移除不再活跃的房间（且当前不在运行）
    for (const [roomUuid, schedule] of battleSchedules.entries()) {
        if (!activeRooms.includes(roomUuid) && !schedule.isRunning) {
            battleSchedules.delete(roomUuid);
        }
    }

    // 添加或修正房间调度
    for (const roomUuid of activeRooms) {
        if (!battleSchedules.has(roomUuid)) {
            // const bucketIndex = getBucketIndexForRoom(roomUuid);
            // const bucketOffset = bucketIndex * BUCKET_MS;
            const bucketOffset = randomIntegerInFullCloseRange(60, 120);
            const base = Math.floor(now / INTERVAL) * INTERVAL;
            let slotTime = base + bucketOffset;
            if (slotTime <= now) slotTime += INTERVAL;

            const schedule: BattleSchedule = {
                roomUuid,
                nextRunTime: slotTime,
                isRunning: false
            };
            battleSchedules.set(roomUuid, schedule);
        } else {
            const schedule = battleSchedules.get(roomUuid)!;
            if (!schedule.isRunning && schedule.nextRunTime <= now) {
                // const bucketIndex = getBucketIndexForRoom(roomUuid);
                // const bucketOffset = bucketIndex * BUCKET_MS;
                const bucketOffset = randomIntegerInFullCloseRange(60, 120);
                // 保证至少 INTERVAL，且保持 bucket 偏移
                // const fallback = schedule.lastRunEndTime ? schedule.lastRunEndTime + INTERVAL : now + INTERVAL;
                const base = Math.floor(now / INTERVAL) * INTERVAL;
                let slotTime = base + bucketOffset + INTERVAL;
                if (slotTime <= now) slotTime = now + INTERVAL + bucketOffset;
                schedule.nextRunTime = slotTime;
            }
        }
    }
}

// 执行准备好的战斗（简化：到期的任务会尽快全部启动）
async function processReadyBattles() {
    const now = Date.now();
    const readyBattles: string[] = [];

    for (const [roomUuid, schedule] of battleSchedules.entries()) {
        if (!schedule.isRunning && now >= schedule.nextRunTime) {
            readyBattles.push(roomUuid);
        }
    }

    if (readyBattles.length === 0) return;

    shuffleArray(readyBattles);

    // 启动所有到期的任务（不再做本地并发限制）
    for (const roomUuid of readyBattles) {
        processBattle(roomUuid).catch(err => {
            logger.error(`Error running battle ${roomUuid}:`, err);
        });
    }
}

// 清理卡住的战斗：使用 lastStartTime 判断
function cleanupStuckBattles() {
    const now = Date.now();
    const stuckThreshold = 300000; // 5分钟

    for (const [roomUuid, schedule] of battleSchedules.entries()) {
        if (schedule.isRunning && schedule.lastStartTime && (now - schedule.lastStartTime) > stuckThreshold) {
            logger.warn(`Resetting stuck battle for room ${roomUuid}`);
            schedule.isRunning = false;
            schedule.lastStartTime = undefined;
            schedule.nextRunTime = Math.max(now + 1000, now + MIN_WAIT_MS);
        }
    }
}

let running = true;
let lastRoomUpdate = 0;
let lastDataSave = 0;

async function gracefulShutdown() {
    running = false;
    logger.info(`Process ${group} shutting down...`);

    const shutdownStart = Date.now();
    while (Array.from(battleSchedules.values()).some(s => s.isRunning)) {
        if (Date.now() - shutdownStart > 30000) {
            logger.warn(`Force shutdown after 30s`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
        await saveUnitStatisticIntoRedis(group, redisClient);
        logger.info(`Process ${group} data saved`);
    } catch (error: any) {
        logger.error(`Failed to save data:`, error);
    }

    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function main() {
    try {
        await loadUnitStatisticFromRedis(group, redisClient);
        setGlobalBattleCallbackGenerator((battleInfo) => generateCallback(battleInfo, {}));
        await updateSchedules();
        logger.info(`Process ${group} initialized with ${battleSchedules.size} rooms`);
    } catch (error: any) {
        logger.error(`Initialization failed:`, error);
        process.exit(1);
    }

    while (running) {
        const now = Date.now();

        try {
            if (now - lastRoomUpdate > ROOM_DISCOVERY_INTERVAL) {
                await updateSchedules();
                lastRoomUpdate = now;
            }

            await processReadyBattles();

            if (now - lastDataSave > 1000 * 60) {
                cleanupStuckBattles();
                lastDataSave = now;
            }
        } catch (error: any) {
            logger.error(`Main loop error:`, error);
        }

        // 主循环每100ms运行一次（与当前需求一致）
        await new Promise(resolve => setTimeout(resolve, BUCKET_MS));
    }
}

await main().catch(error => {
    logger.error(`Fatal error:`, error);
    process.exit(1);
});

// | 0  │ battle_c    │ default     │ N/A     │ fork    │ 13612    │ 97s    │ 6    │ online    │ 0%       │ 1016.6m… │ root     │ disabled │
// │ 1  │ battle_c    │ default     │ N/A     │ fork    │ 13634    │ 95s    │ 3    │ online    │ 0%       │ 1.0gb    │ root     │ disabled │
// │ 0  │ battle      │ default     │ N/A     │ fork    │ 14238    │ 88s    │ 5    │ online    │ 0%       │ 1.2gb    │ root     │ disabled │
// │ 1  │ battle      │ default     │ N/A     │ fork    │ 14220    │ 88s    │ 7    │ online    │ 0%       │ 1.3gb    │ root     │ disabled │
// │ 2  │ battle_b    │ default     │ N/A     │ fork    │ 14288    │ 86s    │ 4    │ online    │ 0%       │ 1.2gb    │ root     │ disabled │
// │ 3  │ battle_b    │ default     │ N/A     │ fork    │ 14318    │ 86s    │ 5    │ online    │ 0%       │ 1.3gb    │ root     │ disabled │