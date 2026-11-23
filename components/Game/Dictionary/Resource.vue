<template>
    <div class="flex flex-col">
        <div class="flex flex-col md:flex-row items-center gap-0 md:gap-4 justify-center mb-4 md:mb-0">
            <div class="w-full">
                <el-tabs v-model="activeCategory">
                    <el-tab-pane key="all" label="全部" name="all"></el-tab-pane>
                    <el-tab-pane key="usable" label="可使用的物品" name="usable"></el-tab-pane>
                    <el-tab-pane key="workEquipment" label="👋生活装备" name="workEquipment"></el-tab-pane>
                    <el-tab-pane key="battleEquipment" label="🗡️战斗装备" name="battleEquipment"></el-tab-pane>
                    <template v-for="(catInfo, catKey) in allGameResourceCategoryInfo" :key="catKey">
                        <el-tab-pane v-if="catKey != GameResourceCategory.Custom"
                            :label="`${catInfo.icon} ${catInfo.name}`" :name="catKey" />
                    </template>
                </el-tabs>
            </div>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-8 pb-8 px-0 md:px-2">
            <template v-if="['all', 'usable'].includes(activeCategory) && filteredResources.length">
                <template v-for="group in categoryGroupedResources" :key="group.category">
                    <div class="flex flex-col gap-2 w-full">
                        <div class="w-full font-bold text-lg">
                            {{ getCategoryName(group.category) }}
                        </div>
                            <div class="grid gap-8 resource-grid">
                                <template v-for="resource in group.resources" :key="resource.id">
                                    <GameCommonItemSlot :showCount="false ":resource-id="resource.id"></GameCommonItemSlot>
                                </template>
                            </div>
                    </div>
                </template>
            </template>
            <template
                v-else-if="['workEquipment', 'battleEquipment', 'Equipment'].includes(activeCategory) && filteredResources.length">
                <template v-for="group in equipmentPartGroupedResources" :key="group.part">
                    <div class="flex flex-col gap-2 w-full">
                        <div class="w-full font-bold text-lg">
                            {{ parseEquimentPartToString(group.part) || '其他' }}
                        </div>
                            <div class="grid gap-8 resource-grid">
                                <template v-for="resource in group.resources" :key="resource.id">
                                    <GameCommonItemSlot :showCount="false ":resource-id="resource.id"></GameCommonItemSlot>
                                </template>
                            </div>
                    </div>
                </template>
            </template>
            <template v-else-if="filteredResources.length">
                <template v-for="resource in filteredResources" :key="resource.id">
                     <GameCommonItemSlot :showCount="false ":resource-id="resource.id"></GameCommonItemSlot>
                </template>
            </template>
            <template v-else>
                <template>
                    <div class="w-full text-center py-8 text-gray-400">
                        <div class="text-4xl mb-2">{{ '📦' }}</div>
                        <div>当前分类下暂无物品</div>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>


<script setup lang="ts">
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources';

import { waitUtilConnected as waitUtilSocketConnected } from '~/api/game/socket/socket';
import { emitRequestInventory, } from '~/api/game/socket/inventory';
import { useInventory } from '~/composables/game/useInventory';
import { GameResourceCategory, type GameResource } from '~/shared/types/gameResource';
import { allCharacterEquipmentPart, CharacterEquipmentPart } from '~/shared/types/characterInfo';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';
import { ObjectKeys } from '~/shared/utils';
import PY from 'pinyin-match'
import { emitGetUserPersonalization, onGetUserPersonalizationSuccess, emitSetFavorites, onSetFavoritesSuccess, onUserPersonalizationError, emitSetCategoryOrder } from '~/api/game/socket/userPersonalization'
import { GameCommonSimpleResourceIconAndName } from '#components'

const { isMobile } = useDevice()

const searchQuery = ref<string>('')

// user personalization
const favoriteItems = ref<string[]>([])
const categoryOrder = ref<string[]>([])

// favoriteResources computed after filteredResources is declared (moved lower)

const activeCategory = ref<'all' | 'usable' | 'workEquipment' | 'battleEquipment' | GameResourceCategory>('all');

const getCategoryName = (category: GameResourceCategory | 'all' | 'mine') => {
    if (category === 'all') return '全部物品';
    if (category === 'mine') return '我的物品';
    return allGameResourceCategoryInfo[category]?.name || category;
}
const categoryGroupedResources = computed(() => {
    const groups: {[key in (GameResourceCategory | 'all' | 'mine')]?: GameResource[]} = {}
    for (const resource of filteredResources.value) {
        if (Array.isArray(resource.category)) {
            for (const cat of resource.category) {
                if (!groups[cat]) groups[cat] = []
                groups[cat].push(resource)
            }
        }
    }
    // 返回有序数组
    let res = ObjectKeys<(GameResourceCategory | 'all' | 'mine')>(allGameResourceCategoryInfo)
        .filter(cat => groups[cat] && groups[cat].length)
        .map(cat => ({
            category: cat,
            resources: groups[cat]
        }))

    return res;
})

const equipmentPartGroupedResources = computed(() => {
    const groups: Record<string, GameResource[]> = {}
    for (const resource of filteredResources.value) {
        const part = resource.equipPart || 'other'
        if (!groups[part]) groups[part] = []
        groups[part].push(resource)
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

    // 去掉强化物品
    let res = resourcesByCategory.filter(resource => !resource.id.includes('+'));
    res = res.filter(resource => !resource.sponsorDiyItem);

    if (searchQuery.value) {
        res = res.filter(resource => {
            let pyMatchRes = PY.match(resource.name, searchQuery.value)

            return !!pyMatchRes || resource.name.includes(searchQuery.value)
        })
    }

    return res;
})

onMounted(async () => {
    await waitUtilSocketConnected()

    emitRequestInventory()
    // fetch personalization
    emitGetUserPersonalization()
    onGetUserPersonalizationSuccess((p) => {
        favoriteItems.value = p.favoriteItems || []
        categoryOrder.value = p.categoryOrder || []
    })

    onSetFavoritesSuccess((p) => {
        favoriteItems.value = p.favoriteItems || []
    })

    onUserPersonalizationError((err) => {
        // simple notification
        console.warn('user personalization error', err)
    })
})

</script>

<style lang="scss" scoped>
.item-increase-text {
    animation-duration: 1.62s;
    animation-name: item-increase-anim;
    animation-timing-function: ease-out;
    animation-fill-mode: forwards;

    font-size: 14px;
    // animation-direction: alternate;            /*动画交替反向运行*/
    // animation-iteration-count: infinite;       /*无限重复*/
}

@keyframes item-increase-anim {
    0% {
        transform: translateY(0);
        opacity: 1;
    }

    4% {
        font-size: 18px;
        transform: translateY(0px);
    }

    20% {
        transform: translateY(0px);
    }

    40% {
        font-size: 14px;
    }

    100% {
        transform: translateY(-14px);
        opacity: 0;
    }
}

/* resource grid: auto-fill columns, fallback to two columns on small screens */
.resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
}

</style>