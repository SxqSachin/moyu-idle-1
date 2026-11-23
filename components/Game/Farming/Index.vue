<template>
    <el-card body-class="p-3! md:p-4!">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold">种植</h2>
        </div>
        <div class="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            <p>在这里你可以管理农田、种植作物并收获资源。</p>
        </div>
        <div class="flex flex-col text-gray-600 dark:text-gray-400 mb-4 text-xs gap-1">
            <el-text class="self-start!" size="small"> 你可以通过投入一定资源，将一块荒地变为可种植的土地 </el-text>
            <el-text class="self-start!" size="small">不同的种子生长时间和产出不同 </el-text>
            <el-text class="self-start!" size="small"> 你可以在“商店”->“农产品”中购买作物的种子 </el-text>
            <el-text class="self-start!" size="small"> 你也可以直接将作物出售给“农产品”商店 </el-text>

            <el-text class="self-start!" size="small"> 作物的成熟不受除了肥料外的任何效果影响（食物、状态、装备、专精） </el-text>
            <el-text class="self-start!" size="small"> 此“种植”功能后续会取代“采集”中的“种植” </el-text>
        </div>
        <GameFarmingPanel></GameFarmingPanel>
    </el-card>
</template>

<script setup lang="tsx">
// import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
// const building = useCharacterBuildingInfo()

// const hasMysteriousCabin = computed(() => {
//     return building.value?.mysteriousCabin?.status == 'BUILT'
// })
</script>