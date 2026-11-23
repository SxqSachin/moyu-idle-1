<template>
    <component :is="shouldRenderPopover ? ElPopover : 'div'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave">
        <template v-if="shouldRenderPopover" #reference>
            <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resource.id" :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="flex justify-end items-end text-sm text-yellow-600 dark:text-cyan-600 absolute w-16 h-16 right-1 bottom-1 break-all text-right drop-shadow-sm">
                    {{ resourceCount }}
                </div>
                <slot></slot>
                <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resource.name }}
                </div>
            </div>
        </template>
        <template v-if="!shouldRenderPopover">
            <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out"
                @click="handleItemClick">
                <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                        :resource-id="resource.id" :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                    class="flex justify-end items-end text-sm text-yellow-600 dark:text-cyan-600 absolute w-16 h-16 right-1 bottom-0.5 break-all text-right drop-shadow-sm">
                    {{ resourceCount }}
                </div>
                <slot></slot>
                <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ resource.name }}
                </div>
            </div>
        </template>

        <!-- popover 内容 -->
        <template v-if="shouldRenderPopover">
            <div class="font-bold text-base mb-1">{{ resource.name }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ resource.description }}</div>

            <GameCommonResourceRelativeActionInfo v-if="resource.id" :resource-id="resource.id">
            </GameCommonResourceRelativeActionInfo>
        </template>
    </component>

    <el-dialog v-model="showUseDialog" :title="resource.name" width="350px" align-center>
        <div class="flex flex-col items-center">
            <GameCommonSimpleResourceIconAndName :resource-id="resource.id" :hide-name="true" :icon-size="16">
            </GameCommonSimpleResourceIconAndName>
            <div class="text-sm text-gray-600 dark:text-gray-400 ">{{ resource.description }}</div>

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
                    <GameCommonResourceUseInfo :resource-id="resource.id">
                    </GameCommonResourceUseInfo>
                </div>

                <el-divider class="mt-4! mb-0!"></el-divider>
            </template>
        </div>

        <template #footer>

            <div class="flex flex-row gap-2">
                <template v-if="!resource.hideInMarket">
                    <el-button class="w-full" type="primary"
                        @click="() => emits('show-in-market', { itemId: resource.id })">
                        <el-icon class="mr-2">
                            <Icon name="game-icons:shop" class="size-8" mode="css"></Icon>
                        </el-icon>
                        市场
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
import { formatCountToStr, ObjectKeys } from '~/shared/utils';
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import { MAX_USE_ITEM_COUNT } from '~/shared/data/constant';

const props = defineProps<{
    resourceId: AllGameResourceID
    count: number
}>()

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

const emits = defineEmits<{
    (e: 'show-in-market', payload: { itemId: AllGameResourceID }): void
    // (e: 'dismantle', payload: { itemId: AllGameResourceID }): void
}>()

const resource = computed(() => {
    return allGameResource[props.resourceId]
})

const showUseDialog = ref(false)

const handleItemClick = () => {
    if (resource.value.onUse?.length || resource.value.onEquip?.length) {
        showUseDialog.value = true
    }

    if (!resource.value.hideInMarket) {
        showUseDialog.value = true
    }
}

const resourceCount = computed(() => {
    let count = props.count

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