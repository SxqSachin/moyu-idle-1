<template>
    <component :is="shouldRenderPopover[item.id] ? ElPopover : 'span'" v-bind="popoverProps"
        @mouseenter="() => handleMouseEnter(item.id)" @mouseleave="handleMouseLeave">

        <template v-if="shouldRenderPopover" #reference>
            <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                @click="emits('select', item.id)">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="item.id"
                        :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-12 md:w-15 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ item.name }}
                </div>

                <slot name="item">
                </slot>
            </div>
        </template>

        <!-- 当不是 popover 时的内容 -->
        <template v-if="!shouldRenderPopover[item.id]">
            <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out"
                @click="emits('select', item.id)">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="item.id"
                        :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-13 md:w-15 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ item.name }}
                </div>

                <slot name="item">
                </slot>
            </div>
        </template>

        <template v-if="shouldRenderPopover[item.id]">
            <slot></slot>
        </template>
    </component>
</template>

<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllGameResourceID } from '~/shared/types/gameResource';


const props = defineProps<{
    resourceId: AllGameResourceID
}>()

const item = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const emits = defineEmits<{
    (e: 'select', id: AllGameResourceID): void
}>()

const popoverRef = ref()
const shouldRenderPopover = ref<{ [key: string]: boolean }>({})
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    
    return {
        hideAfter: 120,
        showAfter: 300,
        placement: "bottom",
        effect: "light",
        trigger: "hover",
        transition: "el-fade-in",
        width: 370,
    }
})

function handleMouseEnter(id: string) {
    // 延迟渲染 popover，避免快速划过时创建不必要的元素
    hoverTimer.value = setTimeout(() => {
        shouldRenderPopover.value[id] = true
    }, 60) // 620ms 延迟
}

// 鼠标离开事件
function handleMouseLeave() {
    // 清除延迟渲染的定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
}

onUnmounted(() => {
    // 清除定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
    shouldRenderPopover.value = {}
    popoverRef.value = null
})



</script>