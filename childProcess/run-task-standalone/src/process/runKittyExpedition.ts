import { KittyExpeditionTeamState, type KittyExpeditionTeamReward } from "~/shared/types/kittyExpedition";
import { getKittyExpeditionTeam, refreshKittyExpeditionTeamLastRewardAt, updateKittyExpeditionTeamStateToExpedition, updateKittyExpeditionTeamStateToFinishedAndGiveReward } from "../utils/game/kittyExpedition";
import { allBattleAreaExpeditionInfo, allBattleAreas } from "~/shared/data/allBattleInfo";
import type { BattleArea } from "~/shared/types/battle";
import type { ItemDrop } from "~/shared/types/emeny";
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import { getKitty } from "../utils/game/kitty";
import { prisma } from "../utils/prisma";

export async function runExpedition(expeditionUuid: string) {
    let expeditionInfo = await getKittyExpeditionTeam(expeditionUuid);

    if (!expeditionInfo) {
        return
    }

    let areaId = expeditionInfo.expeditionAreaId as keyof typeof allBattleAreaExpeditionInfo;
    let areaExpeditionInfo = allBattleAreaExpeditionInfo[areaId]
    let areaBattleInfo = allBattleAreas[areaId] as BattleArea
    if (expeditionInfo.state == KittyExpeditionTeamState.ON_THE_WAY) {
        let startTime = expeditionInfo.startTime;

        if (!startTime) {
            console.error("探险队没有开始时间: ", expeditionInfo.uuid);
            return;
        }

        let needDuration = areaExpeditionInfo.travelDuration

        if (Date.now() > (startTime.getTime() + needDuration)) {
            await updateKittyExpeditionTeamStateToExpedition(expeditionUuid);
        }

        return;
    }

    if (expeditionInfo.state == KittyExpeditionTeamState.RETURNING) {
        let endTime = expeditionInfo.endTime;
        if (!endTime) {
            console.error("探险队没有结束时间: ", expeditionInfo.uuid);
            return;
        }

        let needDuration = areaExpeditionInfo.travelDuration

        if (Date.now() > (endTime.getTime() + needDuration)) {
            await updateKittyExpeditionTeamStateToFinishedAndGiveReward(expeditionUuid);
        }

        return;
    }

    if (expeditionInfo.state == KittyExpeditionTeamState.EXPEDITION) {
        let lastRewardAt = expeditionInfo.lastRewardAt
        let passedTurn = expeditionInfo.turn;
        if (!lastRewardAt) {
            await refreshKittyExpeditionTeamLastRewardAt(expeditionUuid);

            return
        }

        let battleDuration: number = areaExpeditionInfo.normalBattleDuration;
        for (const specialTurn of (areaBattleInfo.specialBattles ?? [])) {
            if ((passedTurn + 1) % specialTurn.every == 0) {
                battleDuration = areaExpeditionInfo.specialBattleDuration;
                break;
            }
        }

        if ((lastRewardAt.getTime() + battleDuration) <= Date.now()) {

            let rewardPool = areaBattleInfo.expeditionRewardInfo ?? [];
            
            // let reward: ItemCountInfo = expeditionInfo.reward;
            let expeditionReward: KittyExpeditionTeamReward = expeditionInfo.reward;
            for(const kittyUuid of expeditionInfo.kittyUuids) {
                let kitty = await getKitty(kittyUuid);
                if (!kitty) {
                    continue;
                }

                let characterUuid = kitty?.owner;

                let areaDropRate = areaExpeditionInfo.dropRateMultiplier ?? 0.5;
                let kittyCount = expeditionInfo.kittyUuids.length;

                for (const reward of rewardPool) {
                    let rewardBaseDropPercent = reward.percent 

                    let finalDropPercent = rewardBaseDropPercent * areaDropRate * kittyCount

                    if (randomNumberInFullColseRange(0, 1) < finalDropPercent) {
                        let count = randomIntegerInFullCloseRange(reward.range)

                        count = Math.max(1, ~~(count / 2))

                        if (!expeditionReward[characterUuid]) {
                            expeditionReward[characterUuid] = {};
                        }

                        if (!expeditionReward[characterUuid][reward.id]) {
                            expeditionReward[characterUuid][reward.id] = {
                                count: 0
                            };
                        }
                        expeditionReward[characterUuid][reward.id]!.count += count
                    }
                }
            }

            await prisma.kittyExpeditionTeam.update({
                where: { uuid: expeditionUuid },
                data: {
                    lastRewardAt: new Date(),
                    turn: passedTurn + 1,
                    reward: JSON.stringify(expeditionReward),
                    updatedAt: new Date()
                }
            })
        }

        return;
    }
}