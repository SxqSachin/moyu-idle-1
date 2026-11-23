<template>
    <div class="relative h-16 w-full flex flex-row items-center">

        <div class="relative flex items-center justify-center w-16 h-16 rounded-xl border-2 transition-colors duration-200
                        bg-gray-50 border-gray-200
                        dark:bg-gray-800 dark:border-gray-700
                        hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-900/30"
            @click="handleSlotClick">
            <template v-if="selectedResource && selectedResourceId">
                <el-popover :show-after="180" placement="right" width="200px">
                    <template #reference>
                        <div>
                            <GameCommonSimpleResourceIconAndName :resource-id="selectedResourceId" :icon-size="12"
                                :hide-name="true"></GameCommonSimpleResourceIconAndName>
                        </div>
                    </template>
                    <div>
                        <div class="font-bold text-base mb-1">{{ selectedResource.name }}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{
                            selectedResource.description }}</div>
                        <GameCommonResourceAlchemyTag :uuid="selectedResourceId"></GameCommonResourceAlchemyTag>
                    </div>
                </el-popover>
            </template>
            <template v-else>
                <div class="text-xs text-gray-500">
                    选择 <br />
                    素材
                </div>
            </template>
        </div>

        <div class="flex-1 ml-8">
            <el-slider :disabled="!selectedResource" v-model="selectedResourceCount" :min="1" :max="resourceMaxCount"
                size="small" show-input :show-input-controls="false" @change="handleSelect(selectedResource?.id)" />
            <div v-if="selectedResource"
                class="absolute whitespace-nowrap left-1/2 -translate-x-1/2 -bottom-1 text-xs text-gray-500 dark:text-gray-400">
                <GameCommonSimpleResourceIconAndName :resource-id="selectedResource.id">
                </GameCommonSimpleResourceIconAndName>
                x{{ selectedResourceCount }} (库存: {{ formatCountToStr(inventory[selectedResource.id]?.count ?? 0) }})
            </div>
        </div>

    </div>

    <el-dialog v-model="showItemSelector" @close="showItemSelector = false" :close-on-click-modal="true" title="选择素材"
        :width="isMobile ? 'auto' : '736px'" :fullscreen="isMobile">
        <div class="flex flex-col flex-wrap gap-x-4 gap-y-8">

            <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                @click="handleSelect(null)">
                <div class="relative w-full h-full flex items-center justify-center">
                    <span class="text-2xl text-gray-400">🚫</span>
                </div>
                <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-13 md:w-15 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    清空
                </div>
            </div>

            <div class="flex flex-col gap-4 divide-y divide-gray-200 dark:divider-gray-800 px-2 ">
                <template v-for="tag of AllResourceAlchemyTag">
                    <div v-if="resourceCanUseAsAlchemyInput.filter(r => r.alchemyTag?.includes(tag.id)).length"
                        class="pb-8">

                        <div class="w-full font-bold text-md mb-2 text-gray-800 dark:text-gray-200">{{ tag.name }}</div>
                        <div class="flex flex-row flex-wrap gap-x-3 gap-y-8 ">
                            <template
                                v-for="item in resourceCanUseAsAlchemyInput.filter(r => r.alchemyTag?.includes(tag.id))"
                                :key="item.id">
                                <GameCommonLazyLoadResourceItem :resource-id="item.id" @select="handleSelect">
                                    <template #item>
                                        <div
                                            class="item-name flex justify-end items-end text-sm absolute w-16 h-16 right-0.5 bottom-0 break-all text-right">
                                            {{ formatCountToStr(inventory[item.id]?.count ?? 0) }}
                                        </div>
                                    </template>
                                    <div>
                                        <div class="font-bold text-base mb-1">{{ item.name }}</div>
                                        <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{
                                            item.description
                                            }}</div>
                                        <GameCommonResourceAlchemyTag :uuid="item.id">
                                        </GameCommonResourceAlchemyTag>
                                    </div>
                                </GameCommonLazyLoadResourceItem>
                            </template>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </el-dialog>


</template>

<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { useInventory } from '~/composables/game/useInventory';
import { allGameResource } from '~/shared/data/allGameResources';
import { AllResourceAlchemyTag } from '~/shared/types/gameAlchemy';
import { GameResourceCategory, type AllGameResourceID } from '~/shared/types/gameResource';
import { formatCountToStr } from '~/shared/utils';

const { isMobile } = useDevice();

const inventory = useInventory();

const props = defineProps<{
    resourceId: AllGameResourceID
    count: number
    allSelectedInput: {
        resourceId: AllGameResourceID
        count: number
    }[]
}>()

const emits = defineEmits<{
    (e: 'select', payload: { id: AllGameResourceID | null, count: number }): void
}>()

const popoverRef = ref<HTMLElement | null>(null)
const showItemSelector = ref(false)

const selectedResourceId = ref<AllGameResourceID | null>(props.resourceId)
const selectedResourceCount = ref<number>(props.count)

const selectedResource = computed(() => {
    if (!selectedResourceId.value) return null

    return allGameResource[selectedResourceId.value]
})

const handleSlotClick = () => {
  showItemSelector.value = true
}

watch(() => props.resourceId, (newVal) => {
    selectedResourceId.value = newVal
})
watch(() => props.count, (newVal) => {
    selectedResourceCount.value = newVal
})

const handleSelect = (itemId?: AllGameResourceID | null) => {
    if (!itemId) {
        itemId = null
    }

    selectedResourceId.value = itemId

    if (!selectedResourceCount.value) {
        selectedResourceCount.value = 1;
    }

    showItemSelector.value = false

    emits('select', { id: selectedResourceId.value, count: selectedResourceCount.value })
}

const resourceMaxCount = computed(() => {
    if (!selectedResource.value) return 1

    let max = 1000;
    if (selectedResource.value.id == 'gold') {
        max = 10000;
    }

    return Math.min(max, inventory.value[selectedResource.value.id]?.count ?? 1)
})

const resourceCanUseAsAlchemyInput = computed(() => {
    let res = Object.values(allGameResource).filter(resource => {
        return !!resource.alchemyTag?.length
    }).filter(resource => {
        let itemInventory = inventory.value[resource.id]

        return (itemInventory?.count ?? 0) > 0
    }).filter(resource => {
        return !props.allSelectedInput.some(item => item.resourceId === resource.id)
    })

    return res
})

</script>

<style lang="scss" scoped>
:deep(.el-slider .el-input-number) {
    width: 4em;
    .el-input__wrapper {
        padding-left: 0.5em;
        padding-right: 0.5em;
    }
}
</style>