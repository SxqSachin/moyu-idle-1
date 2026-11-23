<script setup lang="ts">
import { ref, watch } from "vue";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import GameBattleList from "../List.vue";
import GameBattleRoom from "../Room.vue";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { GameBattleDetail } from "#components";

const activeTab = ref("list");

onMounted(() => {
  activeTab.value = "area"
})

const onStartBattle = () => {
  activeTab.value = "battle"
}

const onCreateRoom = () => {
  activeTab.value = "room"
}

const onLeaveRoom = () => {
  activeTab.value = "list"
}
</script>

<template>
  <el-card>
    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="竞技场" name="list">
        <GameBattleArenaMain />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="房间" name="room">
        <GameBattleArenaRoom />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="战斗" name="detail">
        <GameBattleArenaDetail />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>