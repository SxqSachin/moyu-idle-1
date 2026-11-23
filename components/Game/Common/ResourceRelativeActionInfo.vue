<template>
    <GameCommonResourceAlchemyTag :uuid="resourceId"></GameCommonResourceAlchemyTag>
    <div class="my-2 flex flex-col gap-1" v-if="!!minMarketPrice || !!shopMinPrice?.count">
        <div class="text-xs text-gray-400 dark:text-gray-600" v-if="shopMinPrice?.count">
            商店价：{{ formatNumber(shopMinPrice?.count) }}
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-600" v-if="minMarketPrice !== undefined">
            市场最低售价：{{ formatNumber(minMarketPrice) }}
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-600" v-if="maxMarketBuyerOrderPrice !== undefined">
            市场最高求购价：{{ formatNumber(maxMarketBuyerOrderPrice) }}
        </div>
    </div>
    <template v-if="actionsUsingThisResource.length || actionsProducingThisResource.length || resource.onUse || resource.onEquip || monstersDroppingThisResource.length || resource.inBattleEffect || shopSellThisResource || fromUseResource.length">
        <el-divider class="my-2!"></el-divider>

        <div v-if="actionsProducingThisResource.length || canThisResourceGenerateFromAlcheny" class="mb-2">
            <div class="text-xs text-gray-500 mb-1">作为产出：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <template v-for="action in actionsProducingThisResource" :key="action.id">
                    <span
                        class="inline-flex items-center px-2 py-1 bg-green-50 dark:bg-gray-600  rounded text-xs cursor-pointer">
                        <template v-for="reward in action.rewards" :key="reward.id">
                            <GameCommonActionNameAndIcon
                                v-if="reward.id === resourceId || reward.id == resourceActuralId"
                                :percent="reward.percent" :action-id="action.id" />
                        </template>
                    </span>
                </template>

                <span v-if="canThisResourceGenerateFromAlcheny"
                    class="inline-flex items-center px-2 py-1 bg-green-50 dark:bg-gray-600  rounded text-xs cursor-pointer">
                    🧪 炼金台
                </span>
            </div>
        </div>

        <div class="text-sm font-bold mb-1" v-if="actionsUsingThisResource.length || actionsProducingThisResource.length">相关动作</div>
        <div v-if="actionsUsingThisResource.length">
            <div class="text-xs text-gray-500 mb-2">作为原料：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <template v-for="action in actionsUsingThisResource" :key="action.id">
                    <span v-if="!action.id.startsWith('dismantle_') && !action.id.startsWith('build_')"
                        class="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-gray-700  rounded text-xs cursor-pointer">
                        <GameCommonActionNameAndIcon :action-id="action.id"
                            :cost-count="getResourceRequirementCount(action)" />
                    </span>
                </template>
            </div>
        </div>


        <div v-if="shopSellThisResource" class="mb-2">
            <div class="text-xs text-gray-500 mb-1">可于以下商店进行购买：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <el-tag size="small"> {{ shopSellThisResource }} </el-tag>
            </div>
        </div>

        <div v-if="shopRecycleThisResource " class="mb-2">
            <div class="text-xs text-gray-500 mb-1">可于以下商店进行回收：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <el-tag size="small"> {{ shopRecycleThisResource }} </el-tag>
            </div>
        </div>

        <!-- 新增：怪物掉落信息 -->
        <div v-if="monstersDroppingThisResource.length" class="mb-2">
            <div class="text-xs text-gray-500 mb-1">怪物掉落：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <div v-for="enemy in monstersDroppingThisResource" :key="enemy.id"
                    class="inline-flex flex-wrap items-center px-2 py-1 bg-purple-50 dark:bg-gray-700 rounded text-xs gap-2">
                    <span>{{ enemy.name }}</span>
                    <span v-if="enemy.dropChance" class="text-yellow-600">({{ enemy.dropChance.toFixed(2) }}%)</span>
                    <span v-if="enemy.battleAreas.length" class="text-gray-400">
                        [{{ enemy.battleAreas.map(a => a.name).join('，') }}]
                    </span>
                </div>
            </div>
        </div>

        <div v-if="fromUseResource.length" class="mb-2">
            <div class="text-xs text-gray-500 mb-1">从物品中获得：</div>
            <div class="flex flex-wrap gap-2 mb-2">
                <template v-for="item in fromUseResource" :key="item.id">
                    <GameCommonResourceIconAndName :resource-id="item.id" :hide-name="false" size="xs"></GameCommonResourceIconAndName>
                </template>
            </div>
        </div>

        <div v-if="resource.onUse">
            <div class="text-xs text-gray-500 mb-1">使用效果：</div>
            <div class="flex flex-col gap-2">
                <GameCommonResourceUseInfo :small="true" :resource-id="resourceId"></GameCommonResourceUseInfo>
                <div>
                    <GameCommonKittyStatusUseInfo :resource-id="resourceId" :small="true">
                    </GameCommonKittyStatusUseInfo>
                </div>
            </div>
        </div>
        <div v-if="resource.inBattleEffect" class="mb-1">
            <div class="text-xs text-gray-500 mb-1">战斗中：</div>
            <GameCommonResourceInBattleEffect :resource-id="resourceId"></GameCommonResourceInBattleEffect>
        </div>
        <div v-if="resource.equipStatusRequirement" class="mb-1">
            <div class="text-xs text-gray-500 mb-1">装备需求：</div>
            <GameCommonResourceEquipRequirement :small="true" :resource-id="resourceId">
            </GameCommonResourceEquipRequirement>
        </div>
        <div v-if="resource.onEquip" class="mb-1">
            <div class="text-xs text-gray-500 mb-1">装备效果：</div>
            <GameCommonResourceEquipInfo :small="true" :resource-id="resourceId"></GameCommonResourceEquipInfo>
        </div>

        <div v-if="allTitleEffect.length" class="mb-1">
            <div class="text-xs text-gray-500 mb-1">称号效果：</div>
            <div class="flex flex-col gap-2">
                <template v-for="title in allTitleEffect">
                    <TitleEffect :title="title" :hide-title="true" :hide-description="true"></TitleEffect>
                </template>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import { allBattleAreas } from '~/shared/data/allBattleInfo';
import { allGameAction } from '~/shared/data/allGameActions'
import { allGameEnemies } from '~/shared/data/allGameEnemy';
import { allGameResource, allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';
import { getEquipmentActuralId, getResourceActuralId } from '~/shared/utils/game/equipment';
import allAlchemyOutput from '~/assets/resource/allAlchemyOutput.json';

import { useMarketPrices } from '~/composables/game/useMarketPrices';
import { formatNumber } from '~/shared/utils';
import type { allTitles } from '~/shared/data/allTitle';
import TitleEffect from './TitleEffect.vue';
// market price (min) display
const marketPrices = useMarketPrices()
const minMarketPrice = computed(() => marketPrices.getMinPrice(props.resourceId))
const maxMarketBuyerOrderPrice = computed(() => marketPrices.getMaxBuyerOrderPrice(props.resourceId))

const shopMinPrice = computed(() => {
    const res = allGameResource[props.resourceId];
    return res.userBuyCost?.filter(c => !c.cost || c.cost === 'gold')[0];
});

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal
}>()

const resource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const resourceActuralId = computed(() => {
    return getResourceActuralId(props.resourceId);
});

// 相关动作依赖
const actionsUsingThisResource = computed(() => {
    return Object.values(allGameAction).filter((action: any) => {
        return action.requirement?.resource?.some((r: any) => r.id === resourceActuralId.value)
    }).filter((action: any) => {
        // 排除拆解和建造动作
        return !action.id.startsWith('dismantle_') && !action.id.startsWith('build_')
    })
})

const enhanceUsingThisResource = computed(() => {
    return Object.values(allGameAction).filter((action: any) => {
        return action.requirement?.resource?.some((r: any) => r.id === resourceActuralId.value)
    }).filter((action: any) => {
        // 排除拆解和建造动作
        return !action.id.startsWith('dismantle_') && !action.id.startsWith('build_')
    })
})

const actionsProducingThisResource = computed(() => {
    let r = Object.values(allGameAction).filter((action: any) => {
        return action.rewards?.some((r: any) => r.id === resourceActuralId.value)
    })

    r = r.filter((action: any) => {
        // 排除拆解和建造动作
        return !action.id.startsWith('dismantle_') && !action.id.startsWith('build_')
    })

    return r;
})

const canThisResourceGenerateFromAlcheny = computed(() => {
    return allAlchemyOutput.includes(resourceActuralId.value) || allAlchemyOutput.includes(getEquipmentActuralId(props.resourceId));
})


// 获取该资源在动作中的消耗数量
function getResourceRequirementCount(action: any) {
    const req = action.requirement?.resource?.find((r: any) => r.id === resourceActuralId.value)
    return req?.count ?? undefined
}

const monstersDroppingThisResource = computed(() => {
    // 1. 找到所有掉落该资源的怪物
    const result: {
        id: string,
        name: string,
        dropChance: number | undefined,
        battleAreas: { id: string, name: string }[]
    }[] = [];
    for (const [enemyId, enemy] of Object.entries(allGameEnemies)) {
        const drop = enemy.drops?.find((drop: any) => drop.id === resourceActuralId.value)
        if (drop) {
            // 2. 查找该怪物出现在哪些副本
            const areas: { id: string, name: string }[] = [];
            for (const area of Object.values(allBattleAreas)) {
                if (
                    area.enemyPool?.some((e: any) => e.id === enemyId) ||
                    area.specialBattles?.some((sb: any) => sb.enemies?.some((e: any) => e.id === enemyId))
                ) {
                    areas.push({ id: area.id, name: area.name })
                }
            }
            result.push({
                id: enemyId,
                name: enemy.name || enemyId,
                dropChance: drop.percent * 100,
                battleAreas: areas
            })
        }
    }
    return result
})

const shopSellThisResource = computed(() => {
    if (resource.value.hideInShop) {
        return false;
    }

    if (!resource.value.shopType) {
        if (resource.value.userBuyCost?.length) {
            return '商店';
        }

        return false;
    }

    if (resource.value.shopType && !resource.value.userBuyCost?.length) {
        return false;
    }

    const shopTypeNameMap: Record<string, string> = {
        fish: '水产商店',
        farmingPlant: '农产品商店',
        cutePointShop: '心意点数商店',
        sponsorShop: '赞助积分商店',
    };

    const shopName = resource.value.shopType ? shopTypeNameMap[resource.value.shopType] : '商店';

    return shopName;
})

const shopRecycleThisResource = computed(() => {
    if (resource.value.hideInShop) {
        return false;
    }

    if (!resource.value.shopType) {
        if (resource.value.userSellCost?.length) {
            return '商店';
        }

        return false;
    }

    if (resource.value.shopType && !resource.value.userSellCost?.length) {
        return false;
    }

    const shopTypeNameMap: Record<string, string> = {
        fish: '水产商店',
        farmingPlant: '农产品商店',
        cutePointShop: '心意点数商店',
        sponsorShop: '赞助积分商店',
    };

    const shopName = resource.value.shopType ? shopTypeNameMap[resource.value.shopType] : '商店';

    return shopName;
})

const fromUseResource = computed(() => {
    const target = resourceActuralId.value;
    const result: { id: string; name: string; count: number; percent?: number }[] = [];

    Object.entries(allGameResource).forEach(([id, res]) => {
        res.onUse?.forEach((use) => {
            use?.resourceEffect?.forEach((eff: any) => {
                if (eff?.resource === target && typeof eff.increase === 'number' && eff.increase > 0) {
                    result.push({ id, name: res.name, count: eff.increase, percent: eff.percent });
                }
            })
        })
    })

    return result;
});

const allTitleEffect = computed(() => {
    // 简单判断是否有称号效果

    let addTitleIdList: (keyof typeof allTitles)[] = []
    resource.value.onUse?.forEach(e => {
        if (e.addTitle) {
            addTitleIdList.push(...e.addTitle);
        }
    })

    return addTitleIdList;
});
</script>

然后是物品数据，物品数据包含很多很多信息（可获取来源、用途），你可以在ResourceRelativeActionInfo中了解到如何获取到这些信息。物品数据我们先处理装备类的，可装备的物品通常equipPart都不为空，同时要注意，装备一般都可以被强化，强化的装备数据除了单独形成条目外，还需要在基础物品中添加关联，先生成一个装备转markdown的逻辑吧。