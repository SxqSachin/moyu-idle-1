<template>
    <template v-if="kittyFurniture.length">
        <div v-if="lowDurabilityFurniture.length" class="mb-6">
            <div class="p-6 border border-yellow-300 bg-yellow-50/80 dark:bg-yellow-100/10 shadow-xl rounded-2xl!">
                <div class="flex items-center space-x-3 mb-6">
                    <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <span class="text-white text-xl">⚠️</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">猫舍家具耐久度预警</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">以下家具耐久度较低，请及时修理！</p>
                    </div>
                </div>
                <div class="flex flex-wrap flex-col gap-4">
                    <div v-for="furniture in lowDurabilityFurniture" :key="furniture.furnitureId"
                        class="px-4 py-2 rounded bg-yellow-100 dark:bg-gray-700 text-yellow-800 dark:text-gray-300 flex flex-col md:flex-row items-center justify-between gap-2">
                        <div class="text-sm md:text-md flex flex-col md:flex-row md:items-center w-auto">
                            <div class="flex items-center gap-2 mb-2 md:mb-0">
                            <span class="flex items-center gap-1">
                                <GameCommonSimpleAssetsIcon :icon-size="10"
                                    :icon="allKittyFurniture[furniture.furnitureId]?.icon">
                                </GameCommonSimpleAssetsIcon>
                                <span>{{ allKittyFurniture[furniture.furnitureId]?.name }}</span>
                            </span>
                            <span class="ml-1">({{ furniture.durability }}%)</span>
                            </div>
                            <div class="flex flex-wrap gap-2 ml-0 md:ml-4">
                                <template v-for="req in getRepairRequirements(furniture.furnitureId)" :key="req.id">
                                    <GameCommonResourceIconAndName :resource-id="req.id" :count="req.count"
                                        :show-inventory-count="true" />
                                </template>
                            </div>
                        </div>
                        <el-button class="w-full! md:w-auto!" type="primary" @click="repairKittyFurniture(furniture)">
                            修理
                        </el-button>
                    </div>
                </div>
            </div>
        </div>
    </template>
</template>

<script lang="ts" setup>

import { emitRepairFurniture } from '~/api/game/socket/kittyFurniture';
import { useKittyFurniture } from '~/composables/game/useKittyFurniture';
import { allKittyFurniture, type AllKittyFurnitureID } from '~/shared/data/allKittyFurniture';
import type { UserKittyFurnitureInstance } from '~/shared/types/kittyFurniture';
const kittyFurniture = useKittyFurniture()

const lowDurabilityFurniture = computed(() =>
    kittyFurniture.value.filter(f => (f.durability > 1 && f.durability < 3 && f.isActive) || f.durability <= 0)
)

const repairKittyFurniture = (furniture: UserKittyFurnitureInstance) => {
    emitRepairFurniture(furniture.furnitureId)
}

function getFurnitureConfig(furnitureId: string) {
  return allKittyFurniture[furnitureId as AllKittyFurnitureID];
}

function getRepairRequirements(furnitureId: string) {
  const config = getFurnitureConfig(furnitureId);
  if (!config || !config.repairRequirement || !config.repairRequirement[0]) {
    return [];
  }
  
  return config.repairRequirement[0].resource || [];
}
</script>