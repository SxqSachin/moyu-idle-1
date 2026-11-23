<template>
    <el-card body-class="p-3! md:p-4!">
        <el-tabs v-model="activeTab" class="w-full">
            <el-tab-pane :lazy="true" label="战斗区域" name="area">
                <GameBattleKittyExpeditionMain @create-room-success="onCreateExpeditionSuccess"></GameBattleKittyExpeditionMain>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="我的探险队" name="my">
                <GameBattleKittyExpeditionMy></GameBattleKittyExpeditionMy>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="探险记录" name="history">
                <GameBattleKittyExpeditionHistory></GameBattleKittyExpeditionHistory>
            </el-tab-pane>
        </el-tabs>
    </el-card>
</template>

<script setup lang="ts">
const activeTab = ref("area");

onMounted(() => {

})

const onCreateExpeditionSuccess = () => {
    activeTab.value = "my";
}
</script>