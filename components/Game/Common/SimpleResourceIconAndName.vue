<template>
    <template v-if="resourceId && thisResource">
        <template v-if="thisResource.icon.includes(':')">
            <img class="inline" :class="iconClass" :src="getIconPath(thisResource.icon)"></img>
            <template v-if="!hideName"> {{ thisResource.name }} </template>
            <span :class="clz"
                v-if="thisResource.extraTextOnIcon && showExtraText">{{ thisResource.extraTextOnIcon }}</span>
        </template>
        <template v-else>
            <span :style="emojiIconStyle" class="inline-block text-center">
                {{ thisResource.icon }}
            </span>
            <span :class="clz"
                v-if="thisResource.extraTextOnIcon && showExtraText">{{ thisResource.extraTextOnIcon }}</span>
            <template v-if="!hideName"> {{ thisResource.name }} </template>
        </template>
        <slot></slot>
    </template>
</template>

<script setup lang="ts">
import { computed, unref } from "vue";
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal
    iconSize?: number
    hideName?: boolean
    showExtraText?: boolean
    plain?: boolean
}>()

const clz = computed(() => {
    if (props.plain) {
        return "text-gray-500 dark:text-gray-400 extra-text";
    }
    if (thisResource.value?.icon?.includes(':')) {
        return "absolute top-1 right-1 text-xs text-gray-500 dark:text-gray-400 extra-text"
    }

    return "absolute top-2 right-2 text-xs text-gray-500 dark:text-gray-400 extra-text"
})

if (!props.resourceId) {
    console.error('SimpleResourceIconAndName: resourceId is required');
}
if (!allGameResourceWithInternal[props.resourceId]) {
    console.error(`SimpleResourceIconAndName: resourceId ${props.resourceId} not found in allGameResourceWithInternal`);
}

const emojiIconStyle = computed(() => {
    return props.iconSize ? `font-size: ${props.iconSize + 18}px;` : 'font-size: 14px;'
})

const iconClass = computed(() => {
    return props.iconSize ? `w-${props.iconSize} h-${props.iconSize}` : 'w-4 h-4'
})

const thisResource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

if (!thisResource?.value?.icon) {
    console.error('resourceId ',props.resourceId,' missing icon ', thisResource.value);
}

</script>

<style lang="scss" scoped>
.extra-text {
    text-shadow: 0 0 8px #b5e4fd, 0 0 12px #b3b3b3;
}
</style>