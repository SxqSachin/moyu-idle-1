<template>
    <el-card>
        <h2 class="text-2xl font-bold mb-4">自由市场</h2>

        <div class="text-gray-600 dark:text-gray-400  mb-6 text-sm">
            喵呜~这里是由各位小猫咪自由交易的市场呢！在这里可以自由上架物品、决定售价，和其他小猫咪进行交易。记得要合理定价哦，毕竟大家都是精明的小商喵呢 (=･ω･=)

            <div class="flex gap-2 mt-4">
                <el-text size="small">
                    在市场中每交易(出售所得、购买花费)1金币，都会提升{{ TRADING_EXP_PER_GOLD_IN_MARKET }}交易经验
                </el-text>
            </div>
        </div>
        <el-tabs v-model="activeTab" class="w-full">
            <el-tab-pane :lazy="true" label="市场" name="index">
                <GameMarket></GameMarket>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="上架记录" name="history">
                <GameMarketHistory></GameMarketHistory>
            </el-tab-pane>
        </el-tabs>

    </el-card>

</template>
<script setup lang="ts">
import { TRADING_EXP_PER_GOLD_IN_MARKET } from '~/shared/data/constant';

const activeTab = ref("index")

</script>