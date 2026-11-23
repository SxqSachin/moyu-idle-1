<template>
    <template v-if="icon">
        <template v-if="icon.includes(':')">
            <img class="inline" :class="iconClass" :src="getIconPath(icon)"></img>
        </template>
        <template v-else>
            <span :style="emojiIconStyle" class="inline-block text-center">
                {{ icon }}
            </span>
        </template>
    </template>
    <slot></slot>
</template>

<script setup lang="ts">
import { computed, } from "vue";
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    icon: string
    iconSize?: number
}>()

if (!props.icon) {
    console.error('SimpleResourceIconAndName: resourceId is required');
}

const emojiIconStyle = computed(() => {
    return props.iconSize ? `font-size: ${props.iconSize + 18}px;` : 'font-size: 14px;'
})

const iconClass = computed(() => {
    return props.iconSize ? `w-${props.iconSize} h-${props.iconSize}` : 'w-4 h-4'
})

</script>