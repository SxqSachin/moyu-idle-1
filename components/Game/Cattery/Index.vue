<template>
    <el-card body-class="p-3! md:p-4! test">
        <h2 class="text-2xl font-bold mb-4">猫舍</h2>
        <div class="text-gray-600 dark:text-gray-300 mb-6 text-sm">
            欢迎来到猫舍！这里是你可爱小猫咪们的家园，你可以在这里查看、喂养和管理你的猫咪助手。合理照顾它们，让它们帮你完成更多有趣的任务吧 (=^･ω･^=)
            <br />

        </div>

        <el-tabs v-model="currentActiveTab">
            <el-tab-pane label="" name="kitties">
                <template #label>
                    <el-text>猫咪</el-text>
                    <el-popover placement="top" :width="460" trigger="hover" :show-after="380">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400 ml-1">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>
                        <div class="text-sm">
                            <div class="flex flex-col gap-1 text-sm">
                                <div>猫咪助手每次能安排3个待办工作</div>
                                <div>猫咪助手不是万能的～（至少没办法替你完成锻炼和读书！）</div>
                                <div>猫咪助手执行的动作，不会受到任何增益或减益的影响（比如不会受来自装备的效率提升影响）</div>
                                <div>猫咪助手执行的动作无法为你完成任务，也不会给你提供任何经验奖励（资源奖励还是会上交☺️）</div>
                                <div>猫咪助手进行工作时，不受工作的饱食度影响，每分钟会降低{{ KITTY_SATIETY_PER_SECOND * 60 }}饱食度(100饱食度可以工作{{ (100
                                    /
                                    (KITTY_SATIETY_PER_SECOND * 60 * 60)).toFixed(2) }}小时)。</div>
                                <div>猫咪饱食度为0时，会立刻结束所有工作开始休息。</div>
                                <div>喂食部分食物可以提升猫咪助手的饱食度上限。</div>
                            </div>
                        </div>
                    </el-popover>
                </template>
                <GameCatteryKitties></GameCatteryKitties>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="家具">
                <template #label>
                    <el-text>家具</el-text>
                </template>
                <GameCatteryFurniture />
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="随记">
                <template #label>
                    <el-text>随记</el-text>
                </template>
                <GameCatteryEssay/>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="玩伴">
                <template #label>
                    <el-text>玩伴</el-text>
                </template>
                <GameCatteryFriend />
            </el-tab-pane>
        </el-tabs>

    </el-card>
</template>

<script setup lang="ts">
import { KITTY_SATIETY_PER_SECOND } from '~/shared/data/constant';

const currentActiveTab = ref('kitties');

</script>