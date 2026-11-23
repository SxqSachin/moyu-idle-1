<template>
    <div class="flex flex-col gap-2">
        <template v-for="triggerEffect in thisResource.onEquip">
            <div v-if="triggerEffect.statusEffect" class="flex flex-row flex-wrap items-start gap-2">
                <template v-for="effect in triggerEffect.statusEffect">
                    <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                        <GameCommonStatusIconAndName :status="effect.status"></GameCommonStatusIconAndName>:
                        {{ getEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>

            <div v-if="triggerEffect.hpRegen?.increase" class="flex flex-row flex-wrap items-start gap-2">
                <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                    生命恢复：+{{ triggerEffect.hpRegen.increase }}
                </span>
            </div>

            <div v-if="triggerEffect.mpRegen?.increase" class="flex flex-row flex-wrap items-start gap-2">
                <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                    法力恢复：+{{ triggerEffect.mpRegen.increase }}
                </span>
            </div>

            <div v-if="triggerEffect.resourceRequirementModifyEffect" class="flex flex-row flex-wrap items-start gap-2">
                <template v-for="effect in triggerEffect.resourceRequirementModifyEffect">
                    <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                        <GameCommonActionNameAndIcon :action-id="effect.actionId"></GameCommonActionNameAndIcon>:
                        <GameCommonSimpleResourceIconAndName :resource-id="effect.resource">
                        </GameCommonSimpleResourceIconAndName>
                        {{ getEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>

            <div v-if="triggerEffect.actionDurationEffect" class="flex flex-row flex-wrap items-start gap-2">
                <template v-for="effect in triggerEffect.actionDurationEffect">
                    <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                        <GameCommonActionNameAndIcon :action-id="effect.action"></GameCommonActionNameAndIcon>
                        {{ getActionDurationEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>

            <div v-if="triggerEffect.workActionExtEffect" class="flex flex-row flex-wrap items-start gap-2">
                <template v-for="effect in triggerEffect.workActionExtEffect">
                    <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                        <GameCommonActionNameAndIcon :action-id="effect.action"></GameCommonActionNameAndIcon>
                        {{ getActionExpEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>

            <div v-if="triggerEffect.alchemyModify?.mutationPercentIncrease" class="flex flex-row flex-wrap items-start gap-2">
                <span class="inline-block rounded" :class="getTagClass(triggerEffect)">
                    <span>炼金台突变概率: +{{ (triggerEffect.alchemyModify.mutationPercentIncrease * 100).toFixed(2) }}%</span>
                </span>
            </div>

            <div v-if="triggerEffect.textDetail" class="flex flex-row flex-wrap items-start gap-2">
                <template v-for="effect in triggerEffect.textDetail">
                    <span class="inline-block rounded p-2!" :class="getTagClass(triggerEffect)">
                        <span v-html="parseATitle(effect.title)"></span><template v-if="effect.description">:</template>
                         <span v-html="parseDesc(effect.description)"></span>
                    </span>
                </template>
            </div>

        </template>
        <div class="text-sm mt-1">部位: {{ parseEquimentPartToString(thisResource.equipPart) }}</div>
    </div>
</template>

<script setup lang="ts">
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { CharacterEquipmentPart } from '~/shared/types/characterInfo';
import type { GameEffectAction, GameEffectActionAboutActionDuration, GameEffectActionAboutActionExp, GameEffectActionAboutResource, GameEffectActionAboutResourceWithPercent, GameEffectActionAboutStatus } from '~/shared/types/gameEffect';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';
import SimpleResourceIconAndName from './SimpleResourceIconAndName.vue';

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal

    small?: boolean
}>()

const thisResource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const getTagClass = (effectAction: GameEffectAction) => {
    let prefix = props.small ? " px-2 py-1 text-xs " : " px-2 py-1 text-sm "
    if (effectAction.isDebuff) {
        return prefix + ' bg-red-100 text-red-800';
    }

    return prefix + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
}

const getEffectCountModifyValueStr = (effectAction: GameEffectActionAboutStatus | GameEffectActionAboutResource | GameEffectActionAboutResourceWithPercent) => {
    if (effectAction.increase) {
        return '+' + (effectAction.increase)
    }

    return '-' + (effectAction.decrease!)
}

const getActionDurationEffectCountModifyValueStr = (effectAction: GameEffectActionAboutActionDuration) => {
    if ('increasePercent' in effectAction && effectAction.increasePercent) {
        return '用时 +' + (effectAction.increasePercent * 100).toFixed(2) + '%'
    }

    if ('decreasePercent' in effectAction && effectAction.decreasePercent) {
        return '用时 -' + (effectAction.decreasePercent * 100).toFixed(2) + '%'
    }

    if (effectAction.increase) {
        return '用时 +' + (effectAction.increase / 1000) + ' 秒'
    }

    return '用时 -' + (effectAction.decrease! / 1000) + ' 秒'
}

const getActionExpEffectCountModifyValueStr = (effectAction: GameEffectActionAboutActionExp) => {
    if ('increasePercent' in effectAction && effectAction.increasePercent) {
        return '经验获取 +' + (effectAction.increasePercent * 100).toFixed(2) + '%'
    }

    if ('decreasePercent' in effectAction && effectAction.decreasePercent) {
        return '经验获取 -' + (effectAction.decreasePercent * 100).toFixed(2) + '%'
    }

    return "";
}

const parseATitle = (title: string) => {
    return title.replaceAll('[攻击方式调整]', '<b>[攻击方式调整]</b>');
}
const parseDesc = (desc: string) => {
    return desc.replaceAll('\n', '<br/>');
}
</script>