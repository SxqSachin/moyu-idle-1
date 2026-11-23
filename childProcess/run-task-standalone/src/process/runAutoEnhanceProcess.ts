import { AutoEnhanceRequestStatus } from '~/shared/types/enhance';
import { getAllKittyUuids } from '../utils/game/kitty';
import { prisma } from '../utils/prisma';
import { runKittyTask } from './runKittyTask';
import { autoEnhance } from '../utils/game/enhance';
import { getMultiUserTalentCats } from '../utils/game/tarven';
import { getMultiCharacterStatusInfo } from '../utils/game/characterStatus';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant';

const INTERVAL = 16000;

function parseArgs() {
    const groupArg = process.argv.find(arg => arg.startsWith('--group='));
    const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
    const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
    const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
    return { group, groupCount };
}

const { group, groupCount } = parseArgs();

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

// `pLimit` was removed because `limit` is not used in this file.

async function mainLoop() {
    while (running) {
        const startTime = Date.now();
        // console.log(`[AutoEnhance][group:${group}] loop tick start: pid=${process.pid}, time=${new Date(startTime).toISOString()}`);

        // 使用 count + skip/take 来避免一次性拉取全部 uuid 导致的内存峰值
        const total = await prisma.enhanceRequire.count({
            where: {
                status: {
                    in: [AutoEnhanceRequestStatus.PENDING, AutoEnhanceRequestStatus.PROCESSING]
                }
            },
            orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
        });

        const groupSize = Math.ceil(total / groupCount || 1);
        const start = group * groupSize;
        // 最后一组取剩余
        let take = groupSize;
        if (group === groupCount - 1) {
            take = Math.max(0, total - start);
        }

        const myFullRequests = await prisma.enhanceRequire.findMany({
            where: {
                status: {
                    in: [AutoEnhanceRequestStatus.PENDING, AutoEnhanceRequestStatus.PROCESSING]
                }
            },
            // Use a stable order to reduce pagination instability
            orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
            skip: start,
            take,
        });
        // console.log(`[AutoEnhance][group:${group}] fetched ${myFullRequests.length} requests (start=${start}, take=${take}, total=${total})`);

        // 去重 userUuid，减少重复查询和计算
        let myUserUuids = Array.from(new Set(myFullRequests.map(req => req.userUuid)));

            // 查询用户状态：是否被封禁、以及最后上线时间，用于决定是否跳过该用户队列
            const users = await prisma.user.findMany({
              where: { uuid: { in: myUserUuids } },
              select: { uuid: true, is_banned: true, last_online_date: true },
            });

            const userStatusMap = new Map<string, { uuid: string; is_banned: boolean; last_online_date: Date }>(
                users.map(u => [u.uuid, u as any])
            );

            const userTaverns = await getMultiUserTalentCats(myUserUuids);
            const userCharacterStatuses = await getMultiCharacterStatusInfo(myUserUuids);

        // Generate a per-batch token (not stored in DB) to help logging.
        const batchToken = `${group}:${process.pid}:${Date.now()}`;

        // Try to atomically claim each fetched request. This avoids two
        // different groups both processing the same request: each claim is a
        // conditional update. We also allow reclaiming stale PROCESSING items
        // whose `updatedAt` is older than `STALE_PROCESSING_MS`.
        const claimedRequests: typeof myFullRequests = myFullRequests
        // const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes
        // const staleDate = new Date(Date.now() - STALE_PROCESSING_MS);
        // for (const request of myFullRequests) {
        //     try {
        //         const res = await prisma.enhanceRequire.updateMany({
        //             where: {
        //                 uuid: request.uuid,
        //                 OR: [
        //                     { status: AutoEnhanceRequestStatus.PENDING },
        //                     { status: AutoEnhanceRequestStatus.PROCESSING, updatedAt: { lt: staleDate } }
        //                 ]
        //             },
        //             data: { status: AutoEnhanceRequestStatus.PROCESSING, updatedAt: new Date() }
        //         });
        //         if (res.count && res.count > 0) {
        //             claimedRequests.push(request);
        //         } else {
        //             // someone else already claimed it; skip
        //         }
        //     } catch (e) {
        //         console.error(`[AutoEnhance][${batchToken}] claim failed for ${request.uuid}:`, e);
        //     }
        // }
        // console.log(`[AutoEnhance][group:${group}] claimed ${claimedRequests.length} requests to process`);

        const t1 = Date.now();
        const list: Promise<any>[] = [];
        for (const request of claimedRequests) {
            try {
                // console.log(`[AutoEnhance][${batchToken}] start processing request ${request.uuid} user=${request.userUuid}`);
                const status = userStatusMap.get(request.userUuid);
                if (status) {
                    if (status.is_banned) {
                        // console.log(`[AutoEnhance][${batchToken}] skip ${request.uuid} user=${request.userUuid} reason=banned`);
                        // 跳过被封禁用户的请求
                        continue;
                    }

                    if (status.last_online_date) {
                        const hoursSince = (Date.now() - new Date(status.last_online_date).getTime()) / (1000 * 60 * 60);
                        if (hoursSince > MAX_OFFLINE_HOUR) {
                            // console.log(`[AutoEnhance][${batchToken}] skip ${request.uuid} user=${request.userUuid} reason=offline_hours=${hoursSince.toFixed(1)}`);
                            // 用户长时间未上线，跳过其队列
                            continue;
                        }
                    }
                }
                // const reqStart = Date.now();
                await autoEnhance(request, {
                    experts: userTaverns!.get(request.userUuid) || [],
                    characterStatusInfo: userCharacterStatuses!.get(request.userUuid)!
                });
                // const reqEnd = Date.now();
                // console.log(`[AutoEnhance][${batchToken}] finished request ${request.uuid} user=${request.userUuid} duration=${reqEnd-reqStart}ms`);
            } catch (error) {
                // 局部捕获，记录错误并继续处理下一个请求，避免单个出错导致进程崩溃
                console.error(`[AutoEnhance][${batchToken}] Error processing request ${request.uuid} for user ${request.userUuid}:`, error);
            }
        }
        // console.log(`[AutoEnhance][group:${group}] batch finished: processed=${claimedRequests.length} elapsed=${Date.now()-t1}ms`);
        const t2 = Date.now();
        if (t2 - t1 > INTERVAL) {
            console.log(`[AutoEnhance] Group ${group} processing took ${t2 - t1}ms`);
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < INTERVAL) {
            await new Promise(res => setTimeout(res, INTERVAL - elapsed));
        }

        userTaverns.clear()
        userCharacterStatuses.clear()
        list.length = 0

    }
}

await mainLoop();
process.exit(0)