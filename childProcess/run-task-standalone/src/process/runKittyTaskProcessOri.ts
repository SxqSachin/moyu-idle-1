import type { Tavern } from '~/generated/prisma';
import { getAllKittyUuids, getKitty, removeKittyTaskQueueInRedis } from '../utils/game/kitty';
import { runKittyTask } from './runKittyTask';
import type { CharacterStatusInfo } from '~/shared/types/characterInfo';
import type { Kitty } from '~/shared/types/kitty';
import { getMultiUserTalentCats, getUserWorkingTalentCats } from '../utils/game/tarven';
import { getCharacterStatusInfo, getMultiCharacterStatusInfo } from '../utils/game/characterStatus';
import pLimit from 'p-limit';
import { logger } from '../utils/logger.js'
import { VillageBuildingStatus, type BaseVillageBuildingInfo } from '~/shared/types/village/building';
import { prisma } from '../utils/prisma';
import type { allVillageBuilding } from '~/shared/data/allVillageBuilding';
import { batchGetBasicUserInfo } from '../utils/game/user';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant';

const INTERVAL = 750;
const limit = pLimit(100);

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


// 新增缓存相关变量
let villageBuildingList: BaseVillageBuildingInfo[] | null = null;
let cachedUserTaverns: Map<string, Tavern[]> = new Map();
let cachedUserCharacterStatuses: Map<string, CharacterStatusInfo> = new Map();
let cachedKitties: Map<string, Kitty | null> = new Map();
let lastTimeKittyUuids: string[] = [];
let userBasicInfo: Map<string, { uuid: string, is_banned: boolean, last_online_date: Date | null }> = new Map();

const REFRESH_DATA_EACH_LOOP = 10;
let currentLoopCount = 0;
let needRefresh = true;

async function mainLoop() {
    while (running) {
        const startTime = Date.now();

        const allKittyUuids = await getAllKittyUuids();

        const total = allKittyUuids.length;
        const groupSize = Math.ceil(total / groupCount);
        const start = group * groupSize;
        let end = (group + 1) * groupSize;
        if (group === groupCount - 1) {
            end = total; // 最后一组处理剩余所有
        }
        const myKitties = allKittyUuids.slice(start, end);

        // 使用myKitties的uuid进行对比，而不是owner
        if (
            myKitties.length !== lastTimeKittyUuids.length ||
            !myKitties.every((uuid, idx) => uuid === lastTimeKittyUuids[idx])
        ) {
            needRefresh = true;
        }
        lastTimeKittyUuids = [...myKitties];

        // 刷新缓存数据
        if (needRefresh) {
            cachedKitties.clear();
            const kittiesGetPromises: Promise<any>[] = [];
            for (const kittyUuid of myKitties) {
                kittiesGetPromises.push(
                    getKitty(kittyUuid).then(kitty => cachedKitties.set(kittyUuid, kitty))
                );
            }
            await Promise.all(kittiesGetPromises).catch((error) => {
                console.error(`Error fetching kitties for group ${group}:`, error);
            });

            // 收集所有owner
            const owners = Array.from(
                new Set(
                    Array.from(cachedKitties.values())
                        .filter(Boolean)
                        .map(kitty => (kitty as Kitty).owner)
                )
            );

            // 批量获取tavern和characterStatus
            const [newUserTaverns, newUserCharacterStatuses, newUserBasicInfo] = await Promise.all([
                getMultiUserTalentCats(owners),
                getMultiCharacterStatusInfo(owners),
                batchGetBasicUserInfo(owners)
            ]);
            cachedUserTaverns = newUserTaverns;
            cachedUserCharacterStatuses = newUserCharacterStatuses;
            userBasicInfo = newUserBasicInfo;

            needRefresh = false;
        }

        if (!villageBuildingList) {
            const villageBuildingInfo = await prisma.villageBuilding.findMany({
                select: {
                    type: true,
                    level: true
                },
                where: {
                    status: VillageBuildingStatus.NORMAL
                }
            })
            villageBuildingList = villageBuildingInfo.map((item): BaseVillageBuildingInfo => ({
                type: item.type as keyof typeof allVillageBuilding,
                level: item.level
            }));
        }

        const list: Promise<void>[] = [];
        for (const kittyUuid of myKitties) {
            const kitty = cachedKitties.get(kittyUuid) as Kitty;
            if (!kitty) {
                console.error("Kitty not found, uuid:", kittyUuid);
                continue;
            }
            list.push(
                runKittyTask(kittyUuid, {
                  kitty,
                  userTavern: cachedUserTaverns.get(kitty.owner) || [],
                  userCharacterStatus: cachedUserCharacterStatuses.get(
                    kitty.owner
                  )!,
                  villageBuildingInfo: villageBuildingList ?? [],
                })
            );
        }

        const t1 = Date.now();
        await Promise.all(list).catch(error => {
            console.error(`Error processing kitties for group ${group}:`, error);
        });
        const t2 = Date.now();
        if (t2 - t1 > INTERVAL) {
            logger.info(`Processed Kitty group ${group} with ${myKitties.length} rooms in ${t2 - startTime}ms.`);
        }

        currentLoopCount++;
        if (currentLoopCount > REFRESH_DATA_EACH_LOOP) {
            needRefresh = true;
            currentLoopCount = 0;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < INTERVAL) {
            await new Promise(res => setTimeout(res, INTERVAL - elapsed));
        }
    }
}

await mainLoop();
process.exit(0)