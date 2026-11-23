<template>
    <el-card body-class="p-3! md:p-4! test">
        <h2 class="text-2xl font-bold mb-4">猫猫镇</h2>

        <div class="text-gray-600 dark:text-gray-400  mb-6 text-sm">
            <!-- 猫猫镇现在出具规模，已经有了很多建筑。你可以在这里建造新的建筑，或者升级现有的建筑。每个建筑都有不同的功能和效果，可以帮助你在游戏中获得更多的资源和提升猫猫们的生活质量。 -->

            <p class="mb-3">
                在镇民们的共同努力下，猫猫镇现在已经初具规模！小镇的街道上随处可见忙碌的猫咪身影，他们或采集资源，或制作物品，为小镇的繁荣发展贡献着自己的力量。
            </p>

            <div class="flex flex-col justify-start gap-2 mt-4">
                <el-text size="small" class="self-start!">
                    为了让所有居民都能享受更好的生活，小镇议会决定规划一些区域用来建造公共设施与建筑。
                </el-text>
                <el-text size="small" class="self-start!">
                    建筑所需的物资和资源都需要大家共同努力来收集。每座建筑都有其独特的功能和效果。
                </el-text>
                <el-text size="small" class="self-start!">
                    根据小镇发展情况，后续会规划更多公共建筑!
                </el-text>
            </div>
        </div>

        <el-tabs v-model="tab">
            <el-tab-pane :lazy="true" label="公共建筑" name="building">
                <GameVillageBuilding />
            </el-tab-pane>
            <!-- <el-tab-pane :lazy="true" label="列表" name="list">
                list
            </el-tab-pane> -->
        </el-tabs>

    </el-card>
</template>

<script setup lang="tsx">
import { GameVillageBuilding } from '#components';

const tab = ref("building")

</script>