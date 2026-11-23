<template>
    <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded mb-2 relative">
        <div v-if="title" class="mb-2">
            {{ title }}:
        </div>

        <div class="flex flex-row relative">
            <el-text v-if="!!label"
                class="pointer-events-none block text-sm text-gray-700 dark:text-gray-200 mb-2 w-1/4 absolute left-0 top-1">{{
                label }}:</el-text>
            <div class="flex flex-wrap gap-2 w-full" :class="{
                'ml-0 w-full': !label,
                'ml-10': !!label,
            }">
                <template v-if="showDuration">
                    <template v-if="action">
                        <span
                            class="inline-block bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800  px-2 py-1 rounded text-sm">
                            {{ generateDurationStr() }}
                        </span>
                    </template>
                </template>

                <template v-if="actionRequirement?.building && characterBuildingInfo">
                    <template v-for="(requirement, index) in actionRequirement.building" :key="index">
                        <span class="inline-block px-2 py-1 rounded text-sm" :class="{
                        'bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ': (characterBuildingInfo[requirement.id]?.level ?? 0) >= requirement.minLevel,
                        'bg-red-100 text-red-800': (characterBuildingInfo[requirement.id]?.level ?? 0) < requirement.minLevel,
                    }">
                            <GameCommonSimpleIcon :icon="allGameBuilding[requirement.id].icon">
                                {{allGameBuilding[requirement.id].name}}</GameCommonSimpleIcon>
                        </span>
                    </template>
                </template>
                <template v-if="actionRequirement?.characterStatus && characterStatusInfo">
                    <template v-for="(requirement, index) in actionRequirement.characterStatus" :key="index">
                        <span class="inline-block px-2 py-1 rounded text-sm"
                            :class="getStatusRequirementClass(requirement)">
                            <GameCommonStatusIconAndName :status="requirement.status"></GameCommonStatusIconAndName>
                            <span>
                                : {{ requirement.min }} ({{ getStatusLevel(requirement) }})
                            </span>
                        </span>
                    </template>
                </template>

                <template v-if="showReward && action">
                    <template v-for="(reward, index) in getActionRewards(action)" :key="index">
                        <!-- <span class="inline-block bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800  px-2 py-1 rounded text-sm" v-if="reward.id"> -->
                        <GameCommonResourceIconAndName v-if="reward.id && !reward.rewardWhenCompleteBySpecialKitty" :resource-id="reward.id">
                            : {{ getRewardCountAndPercentStr(reward) }}
                            <template v-if="reward.from">({{ reward.from }})</template>
                        </GameCommonResourceIconAndName>
                        <!-- </span> -->
                    </template>
                </template>

                <template v-if="showKittyExtraReward && action">
                    <template v-for="(reward, index) in getActionRewards(action)" :key="index">
                        <!-- <span class="inline-block bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800  px-2 py-1 rounded text-sm" v-if="reward.id"> -->
                        <GameCommonResourceIconAndName v-if="reward.id && reward.rewardWhenCompleteBySpecialKitty == showKittyExtraReward" :resource-id="reward.id">
                            : {{ getRewardCountAndPercentStr(reward)}}<template v-if="reward.from">[{{ reward.from
                                }}]</template>
                        </GameCommonResourceIconAndName>
                        <!-- </span> -->
                    </template>
                </template>

                <template v-if="showImprove && action">
                    <span v-for="(improve, index) in modifiedCharacterImprove" :key="index"
                        class="inline-block bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800  px-2 py-1 rounded text-sm">
                        {{ getCharacterStatusIcon(improve.status) }} {{ getCharacterStatusName(improve.status)
                        }}: {{ improve.increaseExp }} 经验
                        <template v-if="improve.from">({{ improve.from }})</template>
                    </span>
                </template>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { GameCommonResourceIconAndName } from '#components';
import { useActionDuration } from '~/composables/game/useActionDuration';
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import { useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { useLearnedSkillNodes } from '~/composables/game/useLearnedSkillNodes';
import { useNormalVillageBaseBuildingInfo } from '~/composables/game/useNormalVillageBaseBuildingInfo';
import { allWorkStatus } from '~/shared/data/allCharacterStatus';
import { allGameBuilding } from '~/shared/data/allGameBuilding';
import { allGameResource } from '~/shared/data/allGameResources';
import { allVillageBuilding } from '~/shared/data/allVillageBuilding';
import { EXTRA_ACTION_REWARD_PERCENT_PER_LUCK } from '~/shared/data/constant';
import { allWorkSkillTreeNodesMap } from '~/shared/data/skillTrees';
import type { CharacterBuildingInfo } from '~/shared/types/building';
import type { CharacterStatusInfo } from '~/shared/types/characterInfo';
import type { ActionRequirement, CharacterStatusRequirement, GameAction, GameActionReward } from '~/shared/types/gameAction';
import type { CharacterInventory, } from '~/shared/types/gameInventory';
import { clone, ObjectKeysTyped } from '~/shared/utils';
import { isActionInclude, isStatusEqual } from '~/shared/utils/game/game';
import { getBuildingIconAndName, getCharacterStatusIcon, getCharacterStatusName, getResourcerIconAndName } from '~/shared/utils/game/info';
import { calcExtraWrokExpRewardPercent } from '~/shared/utils/game/requirementCheck';

const allActionDuration = useActionDuration()
const allActionResourceRequirement = useActionResourceReqiurement()
const userEquipment = useCharacterWorkEquipment()
const skillNodes = useLearnedSkillNodes()

const props = defineProps<{
    title?: string
    label?: string

    action?: GameAction
    actionRequirement?: ActionRequirement

    characterInventoryInfo?: CharacterInventory
    characterStatusInfo?: CharacterStatusInfo
    characterBuildingInfo?: CharacterBuildingInfo

    showOnUse?: boolean

    showDuration?: boolean

    showReward?: boolean
    showImprove?: boolean

    showKittyExtraReward?: string 
}>()

const actionRequirement = computed(() => {
    if (props.action) {
        return unref(props.action).requirement
    }

    return props.actionRequirement
})

const characterStatus = useCharacterStatusInfo()
const getRewardCountAndPercentStr = (reward: GameActionReward) => {
    if (!reward.buildingId) {
        let count = reward.range ? `${reward.range.min} ~ ${reward.range.max}` : reward.count
        let percent = +(reward.percent * 100).toFixed(2)

        let extraPercentFromLuck = 0;

        if (!reward.ignoreLuckFactor) {
            // 如果percent的小数位都是0，则去掉小数位
            if (percent == ~~percent) {
                percent = ~~percent
            }

            let luck = (characterStatus?.value?.luck?.final ?? 1)
            let extraPercentFromLuck = +((luck - 1) * EXTRA_ACTION_REWARD_PERCENT_PER_LUCK).toFixed(2);

            if (extraPercentFromLuck == ~~extraPercentFromLuck) {
                extraPercentFromLuck = ~~extraPercentFromLuck
            }

            if (extraPercentFromLuck <= 0) {
                return `${count} (${percent}%)`
            }
        }

        let finalPercent = +(percent + (percent * extraPercentFromLuck)).toFixed(2);

        if (finalPercent > 100) {
            finalPercent = 100
        }

        return `${count} (${finalPercent}%)`
    }

    return ""
}

const getActionRewards = (action: GameAction): Readonly<GameActionReward[]> => {
    return unref(action).rewards ?? []
}

const generateDurationStr = () => {
    const actionId = props.action!.id
    let durationInfo = unref(allActionDuration)[actionId]
    let base = parseDuration(durationInfo.base)
    if (durationInfo.base == durationInfo.final) {
        return base
    }

    return parseDuration(durationInfo.final) + `(基础${base})`
}

const parseDuration = (duration: number): string => {
    const seconds = duration / 1000

    if (seconds < 60) {
        return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)}秒`
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    if (secs === 0) {
        return `${mins}分钟`
    }
    return `${mins}分${secs}秒`
}

const getStatusLevel = (statusRequirement: CharacterStatusRequirement) => {
    if (statusRequirement.status == 'workTotal') {

        let level = 0;
        for(const workStatus of allWorkStatus) {
            level += characterStatus.value[workStatus].final ?? characterStatus.value[workStatus].level;
        }

        return level;
    }

    return characterStatus.value[statusRequirement.status].level;
}
const getStatusRequirementClass = (requirement: CharacterStatusRequirement) => {
    let statusLevel = getStatusLevel(requirement);

    if (statusLevel >= requirement.min) {
        return 'bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 '
    }

    return 'bg-red-100 text-red-800';
}

const normalStateBaseVillageBuildings = useNormalVillageBaseBuildingInfo()

const modifiedCharacterImprove = computed(() => {
    let base = clone(props.action!.characterImprove)

    if (!base) {
        return base
    }

    let extraWorkExpRewardPercent = calcExtraWrokExpRewardPercent(normalStateBaseVillageBuildings.value)

    let newBase = base.map(improve => {
        let baseExpReward = improve.increaseExp;

        let extra = 0;

        if (extraWorkExpRewardPercent) {
            extra += +(baseExpReward * extraWorkExpRewardPercent).toFixed(2);
        }

        for (const part of ObjectKeysTyped(userEquipment.value)) {
            let equipmentId = userEquipment.value[part]

            if (!equipmentId) {
                continue;
            }

            let equipment = allGameResource[equipmentId]

            if (!equipment) {
                continue;
            }

            if (part.startsWith('decorate')) {
                if (!equipment.equipPart?.startsWith('decorate')) {
                    continue;
                }
            } else {
                if (part != equipment.equipPart) {
                    continue;
                }
            }

            for (const effect of (equipment.onEquip ?? [])) {
                for (const expEffect of (effect.workActionExtEffect ?? [])) {

                    if (!isActionInclude(expEffect.action, props.action!.id)) {
                        continue;
                    }

                    if (isStatusEqual(expEffect.action, improve.status)) {
                        if ('increasePercent' in expEffect && expEffect.increasePercent) {
                            extra += +(baseExpReward * expEffect.increasePercent).toFixed(2);
                        }
                    }
                }
            }
        }

        if (skillNodes.allLearned?.value?.length) {
          for(const {nodeId, level} of skillNodes.allLearned?.value) {
            const node = allWorkSkillTreeNodesMap[nodeId]
            if (typeof node?.businessEffects?.actionExpRewardEffect != 'function') {
              continue;
            }

            const effects = node.businessEffects.actionExpRewardEffect(level)

            for(const effect of effects) {
              const passActionCheck = [effect.actionId].some(effectActionId => isActionInclude(effectActionId, props.action?.id ?? ""))

              if (!passActionCheck) {
                continue;
              }

              extra += +(
                baseExpReward * effect.modifyPercent
              ).toFixed(2);
            }
          }
        }

        improve.increaseExp = +(baseExpReward + extra).toFixed(2);

        return improve;
    });

    return newBase;
})
</script>