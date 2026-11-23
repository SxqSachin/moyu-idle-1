<template>
    <div class="flex flex-col flex-wrap items-start gap-2 mb-2" v-if="hasKittyFeedEffect">
        <div class="text-xs">
            仅当用于喂食猫咪助手时:
        </div>
        <template v-for="triggerEffect in thisResource.onUse">
            <template v-for="effect in triggerEffect.kittyStatusEffect">
                <span class="rounded" :class="getTagClass(triggerEffect)">
                    <template v-if="effect.status == 'maxSatiety'">
                        🐱猫咪助手饱食度上限: {{ getEffectCountModifyValueStr(effect) }}
                    </template>
                    <template v-else-if="effect.status == 'mood'">
                        🐱猫咪助手心情恢复: {{ getEffectCountModifyValueStr(effect) }}
                    </template>
                    <template v-else-if="effect.status == 'maxMood'">
                        🐱猫咪助手心情上限临时增加: {{ getEffectCountModifyValueStr(effect) }}
                    </template>
                </span>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useInventory } from '~/composables/game/useInventory';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { GameEffectAction, GameEffectActionAboutKittyStatus, } from '~/shared/types/gameEffect';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';
import { getResourcerIconAndName } from '~/shared/utils/game/info';

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal

    inventory?: CharacterInventory

    multiple?: number

    reduce?: number
    
    small?: boolean
}>()

const multiple = computed(() => {
    return props.multiple ?? 1
})

const inventory = computed(() => {
    if (props.inventory) {
        return props.inventory
    }
    return unref(useInventory())
});

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

const getResourceCount = (resourceId: AllGameResourceIDWithInternal) => {
    return unref(inventory)[resourceId]?.count ?? 0
}

const getEffectCountModifyValueStr = (effectAction: GameEffectActionAboutKittyStatus) => {
    if (effectAction.increase) {
        return '+' + (effectAction.increase * unref(multiple))
    }

    return '-' + (effectAction.decrease! * unref(multiple))
}

const hasKittyFeedEffect = computed(() => {
    if (!thisResource.value.onUse || thisResource.value.onUse.length === 0) {
        return false
    }

    for (const triggerEffect of thisResource.value.onUse) {
        if (triggerEffect.kittyStatusEffect && triggerEffect.kittyStatusEffect.length > 0) {
            return true
        }
    }

    return false
})

</script>