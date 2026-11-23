<template>
    <div class="space-y-2">
        <GameCommonRequirementLabel label="耗时" :action="action" :show-duration="true" class="text-sm">
        </GameCommonRequirementLabel>

        <template v-if="action.requirement && (action.requirement.building || action.requirement.characterStatus)">
            <GameCommonRequirementLabel label="需求" :action="action" :character-building-info="buildingInfo"
                :character-status-info="statusInfo" class="text-sm">
            </GameCommonRequirementLabel>
        </template>

        <template v-if="action.requirement?.resource">
            <GameCommonResourceRequirementLabel :action-id="action.id" :inventory="inventory" class="text-sm">
            </GameCommonResourceRequirementLabel>
        </template>

        <template v-if="action.rewards?.length">
            <GameCommonRequirementLabel label="获得" :action="action" :show-reward="true" class="text-sm">
            </GameCommonRequirementLabel>
        </template>

        <template v-for="kitty of kittyInfo">
            <template v-if="action.rewards?.filter(r => r.rewardWhenCompleteBySpecialKitty == kitty.uuid).length">
                <GameCommonRequirementLabel :title="kitty.name + '特性'" :action="action"
                    :show-kitty-extra-reward="kitty.uuid" class="text-sm">
                </GameCommonRequirementLabel>
            </template>
        </template>

        <template v-if="action.characterImprove?.length">
            <GameCommonRequirementLabel label="提升" :action="action" :show-improve="true" class="text-sm mb-0!">
            </GameCommonRequirementLabel>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { useKittyInfo } from '~/composables/game/useKittyInfo';
import useKittyTraits from '~/composables/game/useKittyTraits';
import { useTavern, useWorkingTavern } from '~/composables/game/useTavern';
import allTalentCat from '~/shared/data/allTalentCat';
import allKittyTraits from '~/shared/data/kittyTraits';
import type { CharacterBuildingInfo } from '~/shared/types/building';
import type { CharacterStatusImprove, CharacterStatusInfo } from '~/shared/types/characterInfo';
import type { GameAction, GameActionReward } from '~/shared/types/gameAction';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import { clone } from '~/shared/utils';
import { iteratorWorkEquipment } from '~/shared/utils/game/equipment';

const workEquipment = useCharacterWorkEquipment()
const tavernExpert = useWorkingTavern()

const kittyInfo = useKittyInfo();
const kittyTraits = useKittyTraits();

const props = defineProps<{
    action: GameAction
    buildingInfo?: CharacterBuildingInfo
    statusInfo?: CharacterStatusInfo
    inventory?: CharacterInventory
}>()


const action = computed<GameAction>(() => {
    const actionClone = clone(props.action)
    const actionId =props.action.id 

    let actualReward: Readonly<GameActionReward[]> = actionClone.rewards ?? []
    let extraReward: Readonly<GameActionReward[]> = [];
    let extraExpReward: Readonly<CharacterStatusImprove[]> = [];

    if (workEquipment) {
        iteratorWorkEquipment(workEquipment.value, ({ equipmentId, equipmentTrigger }) => {
            // 检查装备是否有有覆盖效果
            const overrideReward = equipmentTrigger?.overrideRewardOnActionFinish?.({ equipmentId, actionId }) ?? null
            if (overrideReward) {
                actualReward = overrideReward
            }

            // 检查额外奖励
            const extra = equipmentTrigger?.extraRewardOnActionFinish?.({ equipmentId, actionId }) ?? null
            if (extra) {
                extraReward = [...extraReward, ...extra]
            }

            const thisExtraExpReward = equipmentTrigger?.extraExpRewardOnActionFinish?.({ equipmentId, actionId }) ?? []
            if (thisExtraExpReward.length) {
                extraExpReward = [...thisExtraExpReward, ...extraExpReward];
            }
        })
    }

    for(const kittyUuid of Object.keys(kittyTraits.state.value)) {
        const traits = kittyTraits.state.value[kittyUuid] ?? []

        if (!traits.length) continue

        for (const traitRow of traits) {
            const traitInfo = allKittyTraits[traitRow.traitId];
            if (!traitInfo || typeof traitInfo.actionExtraReward !== 'function') continue

            const kitty = kittyInfo.value.find(k => k.uuid === kittyUuid)
            if (!kitty) continue

            const traitExtraRewards = traitInfo.actionExtraReward({
                kittyUuid,
                owner: kitty.owner,
                kittyName: kitty.name,
                actionId,
                traitLevel: traitRow.level,
                oriReward: actionClone.rewards ?? []
            }) ?? []

            extraReward = [...extraReward, ...traitExtraRewards]
        }
    }

    actualReward = clone([...actualReward, ...extraReward])
    actionClone.rewards = actualReward
    actionClone.characterImprove = clone([...(actionClone.characterImprove ?? []), ...extraExpReward]);

    for (const expert of tavernExpert) {
        const expertInfo = allTalentCat.find(cat => cat.id === expert.type as any)

        if (!expertInfo) continue

        let expertActions = Object.keys(expertInfo?.actionOverride ?? {})

        if (clone(expertActions).includes(props.action.id)) {

            expertActions.some(actionId => {
                if (actionId == props.action.id) {

                    actionClone.rewards = [...(actionClone.rewards ?? []), ...(expertInfo.actionOverride?.[actionId].rewards ?? [])]

                    actionClone.characterImprove = [...(actionClone.characterImprove ?? []), ...(expertInfo.actionOverride?.[actionId].characterImprove ?? [])]

                    // actionClone.baseDuration = expertInfo.actionOverride?.[actionId].baseDuration || actionClone.baseDuration

                    return true
                }
            })
        }
    }

  return actionClone
})
</script>