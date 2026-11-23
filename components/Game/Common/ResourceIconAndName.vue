<template>
    <template v-if="!!resourceId && thisResource">
        <template v-if="resourceId == '__satiety'">
            <span class="inline-block px-2 py-1 rounded" :class="tagClass">
                <GameCommonSimpleResourceIconAndName :resource-id="thisResource.id" :hide-name="hideName">
                </GameCommonSimpleResourceIconAndName>
                <template v-if="typeof count != 'undefined' && count !== null">
                    : {{ count }}
                </template>
                <slot name="count"></slot>
                <slot name="countSuffix"></slot>
                <template v-if="showInventoryCount">
                    ({{ formatNumber(inventoryCount) }}{{ countModify ? `-> ${inventoryCount + countModify}` : '' }})
                </template>
                <slot></slot>
            </span>
        </template>
        <template v-else>
            <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps"
                :class="!shouldRenderPopover ? ' inline-block rounded ' + tagClass : undefined"
                @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">

                <template v-if="shouldRenderPopover" #reference>
                    <span ref="itemRef" class="inline-block rounded cursor-pointer" :class="tagClass">
                        <GameCommonSimpleResourceIconAndName :resource-id="thisResource.id" :hide-name="hideName">
                        </GameCommonSimpleResourceIconAndName>
                        <template v-if="typeof count != 'undefined' && count !== null">
                            : {{ formatNumber(count) }}
                        </template>
                        <slot name="count"></slot>
                        <slot name="countSuffix"></slot>
                        <template v-if="showInventoryCount">
                            ({{ formatNumber(inventoryCount) }}{{ countModify ? `-> ${formatNumber(inventoryCount +
                            countModify)}` :
                            '' }})
                        </template>
                        <slot></slot>
                    </span>
                </template>

                <!-- 当不是 popover 时的内容 -->
                <template v-if="!shouldRenderPopover">
                    <span ref="itemRef">
                        <GameCommonSimpleResourceIconAndName :resource-id="thisResource.id" :hide-name="hideName">
                        </GameCommonSimpleResourceIconAndName>
                        <template v-if="typeof count != 'undefined' && count !== null">
                            : {{ formatNumber(count) }}
                        </template>
                        <slot name="count"></slot>
                        <slot name="countSuffix"></slot>
                        <template v-if="showInventoryCount">
                            ({{ formatNumber(inventoryCount) }}{{ countModify ? `-> ${formatNumber(inventoryCount +
                            countModify)}` : '' }})
                        </template>
                        <slot></slot>
                    </span>
                </template>

                <!-- popover 内容 -->
                <template v-if="shouldRenderPopover">
                    <div class="flex flex-row justify-between">
                        <!-- <div class="font-bold text-base mb-1">{{ resource.name }}</div> -->
                        <div class="flex flex-row items-center mb-2 gap-2">
                            <GameCommonSimpleResourceIconAndName :icon-size="16" :resource-id="resourceId"
                                :hide-name="true">
                            </GameCommonSimpleResourceIconAndName>
                            <div class="font-bold text-base">{{ thisResource.name }}</div>
                        </div>
                        <div class="text-sm text-gray-400 dark:text-gray-600" v-if="inventoryCount">数量：{{ formatNumber(inventoryCount) }} </div>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mb-2" v-html="description"></div>

                    <div class="max-h-72 overflow-y-auto">
                        <GameCommonResourceRelativeActionInfo v-if="thisResource.id" :resource-id="thisResource?.id">
                        </GameCommonResourceRelativeActionInfo>
                    </div>

                    <div>
                        <template v-if="!thisResource.hideInMarket">
                            <el-button class="w-full" type="primary"
                                @click="() => eventBus.emit('show-in-market', { itemId: thisResource.id })">
                                <el-icon class="mr-2">
                                    <Icon name="game-icons:shop" class="size-8" mode="css"></Icon>
                                </el-icon>
                                在市场中展示
                            </el-button>
                        </template>
                    </div>
                </template>
            </component>
            
            <!-- 长按（移动端）简洁 dialog: only mount on mobile when opened to avoid overlay placeholders -->
            <el-dialog v-if="isMobile && showLongPressDialog" v-model="showLongPressDialog" width="80%" align-center :append-to-body="true">
                <template #header>
                    <div class="flex flex-row items-center gap-2">
                        <GameCommonSimpleResourceIconAndName :icon-size="16" :resource-id="resourceId"
                            :hide-name="true">
                        </GameCommonSimpleResourceIconAndName>
                        <div class="font-bold text-base">{{ thisResource.name }}</div>
                    </div>
                </template>
                <div class="flex flex-row justify-between">
                    <div class="text-sm text-gray-400 dark:text-gray-600" v-if="inventoryCount">数量：{{ formatNumber(inventoryCount) }} </div>
                </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mb-2" v-html="description"></div>

                    <div class="max-h-72 overflow-y-auto">
                        <GameCommonResourceRelativeActionInfo v-if="thisResource.id" :resource-id="thisResource?.id">
                        </GameCommonResourceRelativeActionInfo>
                    </div>

                    <div>
                        <template v-if="!thisResource.hideInMarket">
                            <el-button class="w-full" type="primary"
                                @click="() => eventBus.emit('show-in-market', { itemId: thisResource.id })">
                                <el-icon class="mr-2">
                                    <Icon name="game-icons:shop" class="size-8" mode="css"></Icon>
                                </el-icon>
                                在市场中展示
                            </el-button>
                        </template>
                    </div>
            </el-dialog>
        </template>
    </template>
</template>

<script setup lang="ts">
import { onLongPress } from '@vueuse/core'
import { ElPopover } from 'element-plus';
import { useInventory } from '~/composables/game/useInventory';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';

const {isMobile} = useDevice();

const inventory = useInventory();

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal
    inventory?: CharacterInventory
    count?: number
    showInventoryCount?: boolean
    countModify?: number
    ignoreTagColor?: boolean
    hideName?: boolean
    size?: "xs" | "small" | undefined
    hideExtra?: boolean

    color?: 'danger'
}>()

// 控制是否渲染 popover
const shouldRenderPopover = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)
// 本地移动端检测，避免依赖 Nuxt useDevice 导致在非 Nuxt 上下文报错
const itemRef = ref<HTMLElement | null>(null)
const showLongPressDialog = ref(false)

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    
    return {
        placement: "bottom",
        effect: "light",
        trigger: "hover",
        transition: "el-fade-in",
        showAfter: 620,
        width: 370,
    }
})

function handleMouseEnter() {
    // 在移动端禁用 popover 渲染（移动端使用长按弹出 dialog）
    if (unref(isMobile)) return

    // 如果已经在显示或者禁用了额外内容，直接返回
    if (shouldRenderPopover.value || props.hideExtra) return
    
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

// 组件卸载时清理
onUnmounted(() => {
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
    }
    shouldRenderPopover.value = false
})

onMounted(() => {
    if (unref(isMobile)) {
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

// ...existing code...

if (!props.resourceId) {
    console.error('ResourceIconAndName: resourceId is required');
}

if (!allGameResourceWithInternal[props.resourceId]) {
    console.error(`ResourceIconAndName: resourceId ${props.resourceId} not found in allGameResourceWithInternal`);
}

const characterInventoryInfo = computed<CharacterInventory>(() => {
    if (!props.showInventoryCount) {
        return {}
    }
    return unref(inventory)
})

const thisResource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const tagClass = computed(() => {
    let size = props.size == 'small' ? 'text-sm px-2 py-1' : 'text-sm px-2 py-1'
    if (props.size == 'xs') {
        size = 'text-xs px-1.5 py-0.5';
    }

    if (props.color == 'danger') {
        return size + ' bg-red-100 text-red-800';
    }

    if (!props.showInventoryCount || props.ignoreTagColor) {
        return size + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
    }

    if (!props.count) {
        return size + ' bg-gray-200 dark:bg-gray-600 text-gray-500 '
    }

    if (unref(inventoryCount) >= (props.count ?? 0)) {
        return size + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
    }
    return size + ' bg-red-100 text-red-800';
})

const inventoryCount = computed(() => {
    return unref(characterInventoryInfo)[unref(props.resourceId)]?.count ?? 0
})

function formatNumber(num: number | undefined | null) {
    return (num ?? 0).toLocaleString();
}

const description = computed(() => {
    return thisResource.value?.description.replaceAll('\n', '<br/>');
})
</script>