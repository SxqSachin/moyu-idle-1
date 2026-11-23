<template>

    <div @click="showSelectDialog = true">
        <slot name="trigger">
            <el-button size="small" type="primary" plain>
                选择物品
            </el-button>
        </slot>
    </div>

    <el-dialog v-model="showSelectDialog" :width="isMobile ? '100%' : '500px'" :title="title ?? '选择物品'" :top="isMobile ? '0' : '8vh'" :append-to-body="true">
        <div class="flex flex-col md:flex-row justify-between w-full mb-2">
            <el-input placeholder="输入物品名称" class="mr-2 w-full" v-model="searchQuery" :prefix-icon="Search"></el-input>
        </div>

        <el-tabs v-model="activeCategory">
            <template v-for="category of categoryGroups" :key="category">
                <el-tab-pane :label="getCategoryName(category)" :name="category" :lazy="true">
                    <div class="flex flex-wrap gap-x-6 gap-8 pb-8 px-0 md:px-2">

                        <template v-if="['workEquipment', 'battleEquipment', 'Equipment'].includes(activeCategory) && filteredResources.length">
                            <template v-for="group in equipmentPartGroupedResources" :key="group.part">
                                <div class="flex flex-col gap-2 w-full">
                                    <div class="w-full font-bold text-lg">
                                        {{ parseEquimentPartToString(group.part) || '其他' }}
                                    </div>
                                    <div class="grid gap-8 resource-grid">
                                        <template v-for="resourceInfo in group.resources"
                                            :key="resourceInfo.resource.id">
                                            <div class="flex items-center justify-center">
                                                <ItemSlot :resource-id="resourceInfo.resource.id"
                                                    :count="resourceInfo.count"
                                                    @click="onSelectItem(resourceInfo.resource.id)">
                                                </ItemSlot>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </template>
                        <template v-else>
                            <template v-for="group in groups" :key="group.category">
                                <div class="flex flex-col gap-2 w-full">
                                    <div class="w-full font-bold text-lg">
                                        {{ getCategoryName(group.category) }}
                                    </div>
                                    <div class="grid gap-8 resource-grid">
                                        <template v-for="resourceInfo in group.resources"
                                            :key="resourceInfo.resource.id">
                                            <ItemSlot :resource-id="resourceInfo.resource.id"
                                                :count="resourceInfo.count"
                                                @click="onSelectItem(resourceInfo.resource.id)">
                                            </ItemSlot>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>
                </el-tab-pane>
            </template>
        </el-tabs>

        <template #footer>
            <el-button @click="showSelectDialog = false">取消</el-button>
        </template>
    </el-dialog>

</template>

<script setup lang="tsx">
import { useInventory } from '~/composables/game/useInventory';
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources';
import type { AllGameResourceID, GameResource, GameResourceCategory } from '~/shared/types/gameResource';
import PY from 'pinyin-match'
import { ObjectKeys } from '~/shared/utils';
import ItemSlot from '../Common/ItemSlot.vue';
import { allCharacterEquipmentPart } from '~/shared/types/characterInfo';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';
import { Search } from '@element-plus/icons-vue'
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"


const inventory = useInventory();
const { isMobile } = useDevice()

const props = defineProps<{
    categoryGroups: (GameResourceCategory | 'workEquipment' | 'battleEquipment')[]
    title?: string

    onlyEnhanceable?: boolean
}>();

const emits = defineEmits<{
    (e: 'select', payload: { id: AllGameResourceID | null }): void
}>();

const activeCategory = ref<'all' | 'usable' | 'workEquipment' | 'battleEquipment' | GameResourceCategory>('all');
const searchQuery = ref<string>('')

const showSelectDialog = ref(false);

const getCategoryName = (category: GameResourceCategory | 'workEquipment' | 'battleEquipment' | 'all' | 'mine') => {
    if (category === 'all') return '全部物品';
    if (category === 'mine') return '我的物品';
    if (category === 'workEquipment') return '工作装备';
    if (category === 'battleEquipment') return '战斗装备';
    return allGameResourceCategoryInfo[category]?.name || category;
}

const enhanceableItems = computed(() => {
  return ObjectKeys<keyof typeof allGameResource>(inventory.value)
    // @ts-ignore
    .filter(id => inventory.value[id]?.count)
    .map(id => allGameResource[id])
})


const filteredResources = computed(() => {
    let resourcesByCategory = []

    if (activeCategory.value === 'all') {
        resourcesByCategory = Object.values(allGameResource)
    } else if (activeCategory.value === 'workEquipment') {
        resourcesByCategory = Object.values(allGameResource).filter(resource =>
            resource.equipmentType?.includes('work')
        )
    } else if (activeCategory.value === 'battleEquipment') {
        resourcesByCategory = Object.values(allGameResource).filter(resource =>
            resource.equipmentType?.includes('battle')
        )
    } else if (activeCategory.value === 'usable') {
        // 筛选出有使用效果的物品
        resourcesByCategory = Object.values(allGameResource).filter(resource =>
            resource.onUse && resource.onUse.length > 0
        )
    } else {
        resourcesByCategory = Object.values(allGameResource).filter(resource =>
            Array.isArray(resource.category) &&
            resource.category.includes(activeCategory.value as GameResourceCategory)
        )
    }

    // 筛选有库存的资源
    let res = resourcesByCategory.filter(resource =>
        inventory.value[resource.id]?.count ?? 0 > 0
    )

    if (searchQuery.value) {
        res = res.filter(resource => {
            let pyMatchRes = PY.match(resource.name, searchQuery.value)

            return !!pyMatchRes || resource.name.includes(searchQuery.value)
        })
    }

    if (props.onlyEnhanceable) {
        // @ts-ignore
        res = res.filter(resource => enhanceInfoJson[resource.id]?.enhanceSuccessTo)
    }

    return res;
})

const groups = computed(() => {
    const groups: { [key in (GameResourceCategory | 'all' | 'mine')]?: { resource: GameResource, count: number }[] } = {}
    for (const resource of filteredResources.value) {
        if (Array.isArray(resource.category)) {
            for (const cat of resource.category) {
                if (!groups[cat]) groups[cat] = []
                groups[cat].push({
                    resource,
                    count: inventory.value[resource.id]?.count ?? 0
                })
            }
        }
    }
    // 返回有序数组
    let res = ObjectKeys<(GameResourceCategory | 'all' | 'mine')>(allGameResourceCategoryInfo)
        .filter(cat => groups[cat] && groups[cat].length)
        .map(cat => ({
            category: cat,
            resources: groups[cat],
        }))

    return res;
})

const equipmentPartGroupedResources = computed(() => {
    const groups: Record<string, { resource: GameResource, count: number }[]> = {}
    for (const resource of filteredResources.value) {
        const part = resource.equipPart || 'other'
        if (!groups[part]) groups[part] = []
        groups[part].push({
            resource,
            count: inventory.value[resource.id]?.count ?? 0
        })
    }
    // 返回有序数组
    let res = allCharacterEquipmentPart
        .filter(part => groups[part] && groups[part].length)
        .map(part => ({
            part,
            resources: groups[part]
        }))

    return res;
})

onMounted(() => {
    activeCategory.value = props.categoryGroups[0];
})

const onSelectItem = (id: AllGameResourceID) => {
    emits('select', { id });
    showSelectDialog.value = false;
}

</script>

<style lang="scss" scoped>
.resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
}
</style>