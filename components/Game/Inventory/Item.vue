<template>

    <component :is="shouldRenderPopover ? ElPopover : 'div'" v-bind="popoverProps" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
        <template v-if="shouldRenderPopover" #reference>
            <div ref="itemRef" class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                :class="extraClass" @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resource.id" :icon-size="10" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="item-name flex justify-end items-end text-sm absolute w-16 h-16 right-0.5 bottom-0 break-all text-right">
                    {{ resourceCount }}
                </div>
                <slot></slot>
                <div
                    class="absolute text-center -left-1.5 md:-left-0.5 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resource.name }}
                </div>
            </div>
        </template>
        <template v-if="!shouldRenderPopover">
            <div ref="itemRef" class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out"
                :class="extraClass" @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resource.id" :icon-size="10" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="item-name flex justify-end items-end text-sm absolute w-16 h-16 right-0.5 bottom-0 break-all text-right">
                    {{ resourceCount }}
                </div>
                <slot></slot>
                <div
                    class="absolute text-center -left-1.5 md:-left-0.5 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resource.name }}
                </div>
            </div>
        </template>

        <!-- popover 内容 -->
        <template v-if="shouldRenderPopover">
            <div class="flex flex-row justify-between">
                <!-- <div class="font-bold text-base mb-1">{{ resource.name }}</div> -->
                <div class="flex flex-row items-center mb-2 gap-2">
                    <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="resourceId" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                    <div class="font-bold text-base">{{ resource.name }}</div>
                </div>
                <div class="text-sm text-gray-400 dark:text-gray-600">数量：{{ formatNumber(inventory[resource.id]?.count)
                    }}</div>
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2" v-html="resource.description.replace(/\\n/g, '<br/>')"></div>

            <GameCommonResourceRelativeActionInfo v-if="resource.id" :resource-id="resource.id">
            </GameCommonResourceRelativeActionInfo>
        </template>
    </component>

    <!-- 长按（移动端）简洁 dialog: only mount on mobile when opened to avoid overlay placeholders -->
    <el-dialog v-if="isMobile && showLongPressDialog" v-model="showLongPressDialog" width="80%" align-center :close-on-click-modal="true" :append-to-body="true">
        <template #header>
            <div class="flex flex-row items-center gap-2">
                <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="resourceId" :hide-name="true">
                </GameCommonSimpleResourceIconAndName>
                <div class="font-bold text-base">{{ resource.name }}</div>
            </div>
        </template>
        <div class="flex flex-row justify-between">
            <div class="text-sm text-gray-400 dark:text-gray-600">数量：{{ formatNumber(inventory[resource.id]?.count)
            }}</div>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-2"
            v-html="resource.description.replace(/\\n/g, '<br/>')"></div>

        <GameCommonResourceRelativeActionInfo v-if="resource.id" :resource-id="resource.id">
        </GameCommonResourceRelativeActionInfo>
    </el-dialog>

    <!-- 使用对话框：仅在需要时挂载，避免在页面初始化创建 overlay 占位元素 -->
    <el-dialog v-if="showUseDialog" v-model="showUseDialog" :title="resource.name" width="350px" align-center>
        <div class="flex flex-col items-center">
            <GameCommonSimpleResourceIconAndName :resource-id="resource.id" :hide-name="true" :icon-size="16">
            </GameCommonSimpleResourceIconAndName>
            <div class="text-sm text-gray-600 dark:text-gray-400 " v-html="resource.description.replace(/\\n/g, '<br/>')"></div>

            <el-divider class="my-4!"></el-divider>

            <template v-if="resource.equipStatusRequirement?.length">
                <div class="text-sm w-full mb-2">
                    <div class="font-bold mb-2">装备需求：</div>
                    <GameCommonResourceEquipRequirement :resource-id="resource.id!">
                    </GameCommonResourceEquipRequirement>
                </div>
            </template>

            <template v-if="resource.onEquip?.length">
                <div class="text-sm w-full">
                    <div class="font-bold mb-2">装备后：</div>
                    <GameCommonResourceEquipInfo :resource-id="resource.id"></GameCommonResourceEquipInfo>
                </div>

                <el-divider class="mt-4! mb-0!"></el-divider>
            </template>

            <template v-if="resource.onUse?.length">
                <div class="text-sm w-full">
                    <div class="font-bold mb-2">使用效果：</div>
                    <GameCommonResourceUseInfo :resource-id="resource.id" :multiple="useCount" :inventory="inventory">
                    </GameCommonResourceUseInfo>
                </div>

                <el-divider class="mt-4! mb-0!"></el-divider>
            </template>
        </div>

        <template #footer>
            <!-- 添加数量选择器 -->
            <div v-if="resource.onUse && !hideUseBtn" class="mb-2">
                <div class="w-full mb-4 flex flex-col items-start">
                    <div class="flex items-center w-full">
                        <span class="text-sm">使用：</span>
                        <el-input-number class="flex-1 mr-4! w-full!" v-model="useCount" :min="1"
                            :max="Math.min(resource.maxUseEachTime ?? MAX_USE_ITEM_COUNT, inventory[resourceId]?.count ?? 1, MAX_USE_ITEM_COUNT)">
                            <template #suffix> <span> / {{ formatCountToStr(inventory[resourceId]?.count ?? 1) }}</span>
                            </template>
                        </el-input-number>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-2 justify-between w-full" v-if="!resource.maxUseEachTime">
                        <el-button size="small" type="primary" @click="useCount += 10">+10</el-button>
                        <el-button size="small" type="primary" @click="useCount += 100">+100</el-button>
                        <el-button size="small" type="primary" @click="useCount += 1000">+1000</el-button>
                        <el-button size="small" type="primary" @click="useCount += 10000">+10000</el-button>
                    </div>
                </div>
                <div class="flex justify-center">
                    <el-button class="w-full" type="primary" :loading="isUsing" :disabled="isUsing"
                        @click="handleUseItem">
                        使用物品
                    </el-button>
                </div>
            </div>

            <div v-if="resource.onEquip && !hideEquipBtn" class="mb-2">
                <div class="flex gap-2">
                    <template v-if="resource.equipmentType?.includes('work')">
                        <el-button class="w-full" type="primary" :loading="isUsing" :disabled="isUsing"
                            @click="handleEquip('work')">
                            装备至 生活
                        </el-button>
                    </template>
                    <template v-if="resource.equipmentType?.includes('battle')">
                        <el-button class="w-full" type="primary" :loading="isUsing" :disabled="isUsing"
                            @click="handleEquip('battle')">
                            装备至 战斗
                        </el-button>
                    </template>
                </div>
            </div>

            <div class="flex flex-row gap-2">
                <template v-if="!resource.hideInMarket && !hideMarketBtn && !ironCat">
                    <el-button class="w-full" type="primary"
                        @click="() => emits('show-in-market', { itemId: resource.id })">
                        <el-icon class="mr-2">
                            <Icon name="game-icons:shop" class="size-8" mode="css"></Icon>
                        </el-icon>
                        市场
                    </el-button>
                </template>

                <template v-if="allDismantlableResource.includes(resource.id) && !hideDismantleBtn">
                    <el-button class="w-full ml-0!" type="primary" @click="() => handleDismantle(resource.id)">
                        <el-icon class="mr-2">
                            <Icon name="game-icons:abstract-031" class="size-8" mode="css"></Icon>
                        </el-icon>
                        分解
                    </el-button>
                </template>

                <template v-if="enhanceableItems.includes(resource.id) && !hideEnhanceBtn">
                    <el-button class="w-full ml-0!" type="primary" @click="() => handleEnhance(resource.id)">
                        <el-icon class="mr-2">
                            <Icon name="game-icons:upgrade" class="size-8" mode="css"></Icon>
                        </el-icon>
                        强化
                    </el-button>
                </template>

            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="tsx">
import { GameCommonResourceUseInfo, GameCommonSimpleResourceIconAndName } from '#components';
import { ElPopover } from 'element-plus';
import { emitUseItem, } from '~/api/game/socket/effectAction';
import { emitEquipItem } from '~/api/game/socket/equipment';
import { allDismantlableResource, allGameAction } from '~/shared/data/allGameActions';
import { allGameResource } from '~/shared/data/allGameResources';
import type { CharacterEquipmentType } from '~/shared/types/characterInfo';
import type { GameAction } from '~/shared/types/gameAction';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import type { AllGameResourceID, } from '~/shared/types/gameResource';
import { formatCountToStr, formatNumber, ObjectKeys } from '~/shared/utils';
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import { MAX_USE_ITEM_COUNT } from '~/shared/data/constant';
import { useIronCat } from '~/composables/game/useIronCat';

import { onLongPress } from '@vueuse/core'


const { isMobile } = useDevice();

const props = defineProps<{
    inventory: CharacterInventory
    resourceId: AllGameResourceID
    extraClass?: string

    hideUseBtn?: boolean // 是否隐藏使用按钮
    hideEquipBtn?: boolean // 是否隐藏装备按钮
    hideMarketBtn?: boolean // 是否隐藏市场按钮
    hideDismantleBtn?: boolean // 是否隐藏分解按钮
    hideEnhanceBtn?: boolean // 是否隐藏强化按钮
}>()

const ironCat = useIronCat()
const shouldRenderPopover = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

// ref to attach long-press listener (mobile)
const itemRef = ref<HTMLElement | null>(null)
const showLongPressDialog = ref(false)

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
    // nothing to cleanup for onLongPress in this environment
})

onMounted(() => {
    // 仅在移动端启用长按监听
    if (isMobile) {
        onLongPress(
            itemRef,
            (e: PointerEvent) => {
                // 打开简洁的长按 dialog
                showLongPressDialog.value = true
            },
            {
                modifiers: {
                    prevent: true,
                },
                delay: 300
            }
        )
    }
})

const emits = defineEmits<{
    (e: 'show-in-market', payload: { itemId: AllGameResourceID }): void
    // (e: 'dismantle', payload: { itemId: AllGameResourceID }): void
}>()

const resource = computed(() => {
    return allGameResource[props.resourceId]
})

// 1. 找出所有以当前物品为“原料”的动作
const actionsUsingThisResource = computed(() => {
    return Object.values(allGameAction).filter((action: GameAction) => {
        return action.requirement?.resource?.some(r => r.id === props.resourceId)
    })
})

// 2. 找出所有以当前物品为“产出”的动作
const actionsProducingThisResource = computed(() => {
    return Object.values(allGameAction).filter((action: GameAction) => {
        return action.rewards?.some(r => r.id === props.resourceId)
    })
})

const showUseDialog = ref(false)
const isUsing = ref(false)

const useCount = ref(1)


// 在对话框打开时重置使用数量
watch(showUseDialog, (newVal) => {
    if (newVal) {
        useCount.value = 1
    }
})

const handleItemClick = () => {
    if (resource.value.onUse?.length || resource.value.onEquip?.length) {
        showUseDialog.value = true
    }

    if (!resource.value.hideInMarket) {
        showUseDialog.value = true
    }
}

const handleUseItem = async () => {
    if (isUsing.value) return

    isUsing.value = true
    emitUseItem({
        itemId: props.resourceId,
        multiple: useCount.value
    })

    setTimeout(() => {
        isUsing.value = false
    }, 1000)

    showUseDialog.value = false
}

const handleEquip = async (type: CharacterEquipmentType) => {
    isUsing.value = true
    emitEquipItem({
        resourceId: unref(resource).id,
        type
    })

    setTimeout(() => {
        isUsing.value = false
    }, 1000)

    showUseDialog.value = false
}

const resourceCount = computed(() => {
    let count = props.inventory[props.resourceId]?.count ?? 0

    return formatCountToStr(count)
})

const enhanceableItems = computed(() => {
  return ObjectKeys<keyof typeof allGameResource>(allGameResource)
    // @ts-ignore
    .filter(id => allGameResource[id] && !!enhanceInfoJson[id]?.enhanceSuccessTo)
    .map(id => allGameResource[id].id)
})

const handleEnhance = (itemId: AllGameResourceID) => {
    eventBus.emit('enhance-item', { itemId })
}

const handleDismantle = (itemId: AllGameResourceID) => {
    eventBus.emit('dismantle-item', { itemId })
}
</script>
<style lang="scss" scoped>
.item-name  {
    color: #6283a4;
    text-shadow: 0 0 2px #a7a7a7;
    @at-root .dark & {
        color: #cdcdcd;
        text-shadow: 0 0 2px #6283a4;
    }
}
</style>