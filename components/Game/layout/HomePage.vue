<template>
    <div class="flex-1">


        <div class="max-w-6xl mx-auto">

            <template v-if="!!battleInfo">
                <el-card class="mb-6">
                    <h3 @click="showBattleDetail = !showBattleDetail"
                        class="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between cursor-pointer">
                        <span> 📋 战斗信息 </span>

                        <span class="mr-2 flex items-center">
                            <el-icon>
                                <Icon name="material-symbols:collapse-content-rounded" v-if="showBattleDetail"></Icon>
                                <Icon name="material-symbols:expand-content-rounded" v-else></Icon>
                                <i :class="showBattleDetail ? 'el-icon-arrow-down' : 'el-icon-arrow-right'"></i>
                            </el-icon>
                        </span>
                    </h3>
                    <div v-if="showBattleDetail" class="flex flex-row mt-4">
                        <GameBattleDetail></GameBattleDetail>
                    </div>
                </el-card>
            </template>

            <GameActionQueue class="w-full"></GameActionQueue>

            <GameHomeWorldBossSummary />

            <GameHomeAutoAlchemyProcess class="w-full my-4"></GameHomeAutoAlchemyProcess>

            <!-- 收获箱 -->
            <GameHarvestBoxList />

            <!-- 优化后的小猫咪任务队列区域 -->
            <template v-if="kitties.length">
                <GameCatteryFurnitureDurabilityAlert></GameCatteryFurnitureDurabilityAlert>
            </template>

            <template v-if="kitties.length">
                <GameKittyAllActionQueue></GameKittyAllActionQueue>
            </template>

            <!-- 优化后的空状态 -->
            <div v-else
                class="bg-gradient-to-br from-white via-gray-50 to-blue-50/30 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
                <div class="mb-4">
                    <div
                        class="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto">
                        <span class="text-white text-2xl">🏠</span>
                    </div>
                </div>
                <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">还没有猫咪助手</h3>
                <p class="text-gray-500 dark:text-gray-400">建造猫舍并招募可爱的助手吧！</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { GameBattleDetail, GameCatteryFurnitureDurabilityAlert } from '#components';
import GameHomeWorldBossSummary from '~/components/Game/Home/WorldBossSummary.vue'
import { waitUtilConnected } from '~/api/game/socket/socket';
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { useHarvestBox } from '~/composables/game/useHarvestBox';
import { useKittyInfo } from '~/composables/game/useKittyInfo'

const {
  boxes,
  reload,
} = useHarvestBox();

const battleInfo = useBattleInfo()

const kitties = useKittyInfo()

const showBattleDetail = ref(false)

onMounted(async () => {
    await waitUtilConnected();
    reload()
})
</script>