<template>
    <div class="flex flex-row flex-wrap items-start gap-2">
        <template v-for="requirement in thisResource.equipStatusRequirement">
            <span class="inline-block rounded" :class="getTagClass(requirement)">
                <GameCommonStatusIconAndName :status="requirement.status"></GameCommonStatusIconAndName>
                <span>: {{ requirement.min }}(当前:{{ getStatusLevel(requirement) }})</span>
            </span>
        </template>
    </div>
</template>

<script setup lang="ts">
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { GameEffectAction, GameEffectActionAboutActionDuration, GameEffectActionAboutResource, GameEffectActionAboutResourceWithPercent, GameEffectActionAboutStatus } from '~/shared/types/gameEffect';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';
import SimpleResourceIconAndName from './SimpleResourceIconAndName.vue';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import type { CharacterStatusRequirement } from '~/shared/types/gameAction';
import { allWorkStatus } from '~/shared/data/allCharacterStatus';

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal

    small?: boolean
}>()

const currentStatus = useCharacterStatusInfo()

const thisResource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const getTagClass = (statusRequirement: CharacterStatusRequirement) => {
    let prefix = props.small ? " px-2 py-1 text-xs " : " px-2 py-1 text-sm "

    let currentStatusLevel = getStatusLevel(statusRequirement)
    if (currentStatusLevel >= statusRequirement.min) {
        return prefix + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
    }

    return prefix + ' bg-red-100 text-red-800';
}

const getStatusLevel = (statusRequirement: CharacterStatusRequirement) => {
    if (statusRequirement.status == 'workTotal') {

        let level = 0;
        for(const workStatus of allWorkStatus) {
            level += currentStatus.value[workStatus].final ?? currentStatus.value[workStatus].level;
        }

        return level;
    }

    return currentStatus.value[statusRequirement.status].level;
}

</script>