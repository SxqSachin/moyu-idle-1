<template>
    <el-card body-class="p-3! md:p-4! test">
        <h2 class="text-2xl font-bold mb-4">物品分解</h2>

        <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            喵呜~欢迎来到小猫咪的分解工坊！在这里，你可以将不需要的装备或材料分解，返还部分原材料，为你的冒险之路腾出更多空间喵！
            <br />

            <div class="gap-2 mt-4">
                <el-text size="small" class="block mt-2">分解物品时，返还制造消耗的60%原材料，向下取整。如果某个原材料的消耗量为1，则原材料将不会被返还。</el-text>
                <el-text size="small" class="block mt-2">分解单个物品的耗时，为原制造耗时的50%，向下取整。</el-text>
                <el-text size="small" class="block mt-2">分解强化物品时，仅返回基础制造消耗，强化所消耗的物资不进行返还。</el-text>
                <el-text size="small" class="block">部分特殊物品不可分解。</el-text>
            </div>
        </div>

        <el-divider></el-divider>

        <div class="w-full flex flex-col items-center">
            <el-card class="w-full md:w-2/3 p-2">
                <GameDismantleBase :init-select-resource-id="initSelectResourceId" />
            </el-card>
        </div>
    </el-card>
</template>

<script setup lang="ts">
import type { AllGameResourceID } from '~/shared/types/gameResource';

const props = defineProps<{
    initSelectResourceId?: AllGameResourceID; // Replace with actual type if available
}>();
</script>
