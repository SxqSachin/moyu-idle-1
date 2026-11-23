<template>
    <div class="flex flex-col">
        <div class="flex flex-col md:flex-row items-center gap-0 md:gap-4 justify-center mb-4 md:mb-0">
            <div class="flex flex-col md:flex-row justify-between w-full md:w-2/7">
                <el-input placeholder="输入商品名称" class="mr-2 w-full md:w-20" v-model="searchQuery"></el-input>
            </div>
            <div class="w-full md:w-5/7">
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
                    <div class="mt-2 md:mt-0 flex justify-end">
                        <el-button size="small" type="primary" @click="openFavoritesDialog">管理收藏</el-button>
                    </div>
            </div>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-8 pb-8 px-0 md:px-2">
            <template v-if="favoriteResources.length">
                    <div class="flex flex-col gap-2 w-full">
                    <div class="w-full font-bold text-lg">收藏</div>
                        <div class="grid gap-8 resource-grid">
                        <template v-for="resource in favoriteResources" :key="resource.id">
                            <GameInventoryItem :inventory="inventory" :resource-id="resource.id"
                                @show-in-market="(p) => emit('show-in-market', p)">
                            </GameInventoryItem>
                        </template>
                    </div>
                </div>
            </template>
            <template v-if="['all', 'usable'].includes(activeCategory) && filteredResources.length">
                <template v-for="group in categoryGroupedResources" :key="group.category">
                    <div class="flex flex-col gap-2 w-full">
                        <div class="w-full font-bold text-lg">
                            {{ getCategoryName(group.category) }}
                        </div>
                            <div class="grid gap-8 resource-grid">
                                <template v-for="resource in group.resources" :key="resource.id">
                                    <GameInventoryItem :inventory="inventory" :resource-id="resource.id"
                                            @show-in-market="(p) => emit('show-in-market', p)">
                                    </GameInventoryItem>
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
                                    <GameInventoryItem :inventory="inventory" :resource-id="resource.id"
                                        @show-in-market="(p) => emit('show-in-market', p)">
                                    </GameInventoryItem>
                                </template>
                            </div>
                    </div>
                </template>
            </template>
            <template v-else-if="filteredResources.length">
                <template v-for="resource in filteredResources" :key="resource.id">
                    <GameInventoryItem :inventory="inventory" :resource-id="resource.id"
                        @show-in-market="(p) => emit('show-in-market', p)">
                    </GameInventoryItem>
                </template>
            </template>
            <template v-else>
                <template v-if="!unownedResources">
                    <div class="w-full text-center py-8 text-gray-400">
                        <div class="text-4xl mb-2">{{ '📦' }}</div>
                        <div>当前分类下暂无物品</div>
                    </div>
                </template>
            </template>
            <template v-if="unownedResources.length">
                <div class="flex flex-col gap-2 w-full">
                    <div class="w-full font-bold text-lg">
                        未拥有
                    </div>
                    <div class="grid gap-8 resource-grid">
                        <template v-for="resource in unownedResources" :key="resource.id">
                            <GameInventoryItem :inventory="inventory" :resource-id="resource.id"
                                :extra-class="'opacity-50 cursor-not-allowed'" :hide-dismantle-btn="true"
                                :hide-enhance-btn="true" :hide-equip-btn="true" :hide-use-btn="true"
                                @show-in-market="(p) => emit('show-in-market', p)">
                            </GameInventoryItem>
                        </template>
                    </div>
                </div>
            </template>

        </div>
    </div>

    <el-dialog v-model="showFavoritesDialog" title="管理收藏" :width="isMobile ? '100%' : '760px'">
        <div class="flex flex-col gap-4">
            <!-- quick favorites area -->
            <div v-if="selectedFavorites.length" class="mt-2 p-2 border rounded bg-gray-50 dark:bg-gray-800">
                <div class="font-bold mb-2">已选择</div>
                <div class="flex flex-wrap gap-1">
                    <template v-for="id in selectedFavorites" :key="id">
                        <div class="flex items-center gap-1 h-8 px-2 rounded bg-white dark:bg-gray-700 border">
                            <GameCommonSimpleResourceIconAndName :resource-id="id" :icon-size="4" :hide-name="true" />
                            <div class="text-sm">{{ allGameResource[id]?.name || id }}</div>
                            <el-button type="text" class="ml-2 text-red-500" @click.stop="removeFromSelected(id)">✕</el-button>
                        </div>
                    </template>
                </div>
            </div>

            <el-input v-model="dialogSearch" placeholder="搜索物品 (支持拼音)" />

            <div class="max-h-72 overflow-auto">
                <template v-for="cat in ALL_CATEGORIES" :key="cat">
                    <div class="font-bold mb-4">{{ allGameResourceCategoryInfo[cat]?.name || cat }}</div>
                    <div class="grid gap-4 gap-y-8 mb-12 px-1 resource-grid">
                        <template v-for="res in getResourcesByCategoryForDialog(cat).filter(r => {
                            if (!dialogSearch) return true
                            const py = PY.match(r.name, dialogSearch)
                            return !!py || r.name.includes(dialogSearch)
                        })" :key="res.id">
                            <GameInventoryItem :inventory="inventory" :resource-id="res.id"
                                :extra-class="selectedFavorites.includes(res.id) ? 'ring-2 ring-yellow-400 scale-105' : ''">
                                <template #default>
                                    <button class="absolute inset-0 w-full h-full bg-transparent" @click.stop="() => {
                                        const idx = selectedFavorites.indexOf(res.id)
                                        if (idx >= 0) selectedFavorites.splice(idx, 1)
                                        else selectedFavorites.push(res.id)
                                    }"></button>
                                </template>
                            </GameInventoryItem>
                        </template>
                    </div>
                </template>
            </div>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2">
                <el-button @click="cancelFavorites">取消</el-button>
                <el-button type="primary" @click="confirmFavorites">确定</el-button>
            </div>
        </template>
    </el-dialog>
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

const emit = defineEmits<{
    (e: 'show-in-market', payload: { itemId: string }): void
}>()

const inventory = useInventory()

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

    return res;
})

const favoriteResources = computed(() => {
    if (!favoriteItems.value?.length) return [] as GameResource[]

    const favSet = new Set(favoriteItems.value)
    const results: GameResource[] = []

    for (const r of filteredResources.value) {
        // Direct match (including previously-saved enhanced ids)
        if (favSet.has(r.id)) {
            results.push(r)
            continue
        }

        // If a base id is favorited (no +level), include any owned enhanced variants
        for (const fav of favoriteItems.value) {
            if (fav.includes('+')) continue // already handled by direct match
            if (r.id.startsWith(fav + '+')) {
                results.push(r)
                break
            }
        }
    }

    return results
})

// favorites management dialog state
const showFavoritesDialog = ref(false)
const selectedFavorites = ref<string[]>([])
const dialogSearch = ref("")

const ALL_CATEGORIES = ObjectKeys(allGameResourceCategoryInfo).filter(c => c !== GameResourceCategory.Custom) as (keyof typeof allGameResourceCategoryInfo)[]

function getResourcesByCategoryForDialog(cat: string) {
    // Exclude enhanced variants (ids like `axe+1`, `axe+2`) from the selection dialog
    const enhancedIdRe = /\+\d+$/
    return Object.values(allGameResource).filter(r => Array.isArray(r.category)
        && r.category.includes(cat as GameResourceCategory)
        // most hidden (hideInMarket) resources are excluded from dialog (e.g. internal items)
        // but allow Currency category to show even if hideInMarket (so coins like `gold` appear)
        && (!r.hideInMarket || cat === GameResourceCategory.Currency)
        && !enhancedIdRe.test(r.id)
    )
}

function openFavoritesDialog() {
    selectedFavorites.value = [...favoriteItems.value]
    dialogSearch.value = ''
    showFavoritesDialog.value = true
}

function confirmFavorites() {
    // validation
    const MAX = 500
    if (selectedFavorites.value.length > MAX) {
        ElNotification.error({ title: '操作失败', message: `最多只能收藏 ${MAX} 个物品` })
        return
    }

    emitSetFavorites(selectedFavorites.value)
    showFavoritesDialog.value = false
}

function cancelFavorites() {
    showFavoritesDialog.value = false
}

function removeFromSelected(itemId: string) {
    const idx = selectedFavorites.value.indexOf(itemId)
    if (idx >= 0) selectedFavorites.value.splice(idx, 1)
}

// 未拥有的物品
const unownedResources = computed(() => {
    if (!searchQuery.value) {
        return []
    }
    return Object.values(allGameResource).filter(resource => 
        !inventory.value[resource.id] && resource.name.includes(searchQuery.value) &&
        ((resource.category ?? []).includes(activeCategory.value as GameResourceCategory) || activeCategory.value === 'all' || activeCategory.value === 'usable')
    ).filter(r => !r.hideInMarket)
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