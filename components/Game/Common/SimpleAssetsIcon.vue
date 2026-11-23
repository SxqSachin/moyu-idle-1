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
</template>

<script setup lang="ts">
import { computed, unref } from "vue";

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    icon: string
    iconSize?: number
    hideName?: boolean
    showExtraText?: boolean
}>()

const emojiIconStyle = computed(() => {
    return props.iconSize ? `font-size: ${props.iconSize + 18}px;` : 'font-size: 14px;'
})

const iconClass = computed(() => {
    return props.iconSize ? `w-${props.iconSize} h-${props.iconSize}` : 'w-4 h-4'
})

</script>

<style lang="scss" scoped>
.extra-text {
    text-shadow: 0 0 8px #b5e4fd, 0 0 12px #b3b3b3;
}
</style>