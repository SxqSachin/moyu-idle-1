<template>
    <component :is="shouldRenderPopover ? ElPopover : 'div'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave">
        <template v-if="shouldRenderPopover" #reference>
            <div ref="itemRef" class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resourceId" :icon-size="10" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="absolute text-center -left-1.5 md:-left-0.5 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resourceName }}
                </div>
            </div>
        </template>
        <template v-if="!shouldRenderPopover">
            <div ref="itemRef" class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out"
                @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resourceId" :icon-size="10" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="absolute text-center -left-1.5 md:-left-0.5 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resourceName }}
                </div>
            </div>
        </template>

        <!-- popover 内容 -->
        <template v-if="shouldRenderPopover">
            <div class="flex flex-row items-center mb-2 gap-2">
                <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="resourceId" :hide-name="true">
                </GameCommonSimpleResourceIconAndName>
                <div class="font-bold text-base">{{ resourceName }}</div>
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ resourceDescription }}</div>

            <GameCommonResourceRelativeActionInfo v-if="resourceId" :resource-id="resourceId">
            </GameCommonResourceRelativeActionInfo>
        </template>
    </component>

    <!-- 长按（移动端）简洁 dialog: only mount on mobile when opened to avoid overlay placeholders -->
    <el-dialog v-if="isMobile && showLongPressDialog" v-model="showLongPressDialog" width="80%" align-center :append-to-body="true">
        <template #header>
            <div class="flex flex-row items-center gap-2">
                <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="resourceId" :hide-name="true">
                </GameCommonSimpleResourceIconAndName>
                <div class="font-bold text-base">{{ resourceName }}</div>
            </div>
        </template>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ resourceDescription }}</div>

        <GameCommonResourceRelativeActionInfo v-if="resourceId" :resource-id="resourceId">
        </GameCommonResourceRelativeActionInfo>
    </el-dialog>

</template>
<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { onLongPress } from '@vueuse/core'
import { allGameResource } from '~/shared/data/allGameResources';
import type { AllGameResourceID } from '~/shared/types/gameResource';


const props = defineProps<{
    resourceId: AllGameResourceID;
}>();

const { isMobile } = useDevice();

// ref to attach long-press listener (mobile)
const itemRef = ref<HTMLElement | null>(null)
const showLongPressDialog = ref(false)

const emits = defineEmits<{
    (e: 'click', resourceId: AllGameResourceID): void;
}>();

const resourceName = computed(() => {
    return allGameResource[props.resourceId].name;
})
const resourceDescription = computed(() => {
    return allGameResource[props.resourceId].description;
})

const handleItemClick = () => {
    emits('click', props.resourceId);
}

const shouldRenderPopover = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    
    return {
        hideAfter: 120,
        showAfter: 200,
        placement: "bottom",
        effect: "light",
        trigger: "hover",
        transition: "el-fade-in",
        width: 370,
    }
})

function handleMouseEnter() {
    // 在移动端禁用 popover 渲染（移动端使用长按弹出 dialog）
    if (isMobile) return

    // 延迟渲染 popover，避免快速划过时创建不必要的元素
    hoverTimer.value = setTimeout(() => {
        shouldRenderPopover.value = true
    }, 150) // 150ms 延迟
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
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
    }
    shouldRenderPopover.value = false
})

onMounted(() => {
    if (isMobile) {
        onLongPress(
            itemRef,
            (e: PointerEvent) => {
                showLongPressDialog.value = true
            },
            {
                modifiers: { prevent: true },
                delay: 300
            }
        )
    }
})

</script>