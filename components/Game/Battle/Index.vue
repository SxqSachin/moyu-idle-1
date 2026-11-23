<script setup lang="ts">
import { ref, watch } from "vue";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import GameBattleList from "./List.vue";
import GameBattleRoom from "./Room.vue";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { GameBattleDetail } from "#components";
import { useRoute, useRouter } from "vue-router";

const currentBattleRoom = useCurrentBattleRoom();
const battleInfo = useBattleInfo();
const activeTab = ref(currentBattleRoom.value ? "room" : "list");
const battleSubTab = ref<'area' | 'worldBoss'>("area");
const route = useRoute();
const router = useRouter();

const syncFromRoute = () => {
  const sub = route.query.battleTab
  if (sub === 'worldBoss') {
    activeTab.value = 'area'
    battleSubTab.value = 'worldBoss'
    const newQuery = { ...route.query }
    delete newQuery.battleTab
    router.replace({ query: newQuery })
    return true
  }
  return false
}

onMounted(() => {
  const handled = syncFromRoute()
  if (handled) return

  // 初始化时根据当前房间状态设置tab
  if (unref(battleInfo)) {
    activeTab.value = "battle"
    return
  } 
  if (unref(currentBattleRoom)) {
    activeTab.value = "room";
    return
  }
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

watch(() => route.query.battleTab, () => {
  syncFromRoute()
})
</script>

<template>
  <el-card body-class="p-3! md:p-4!">
    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="战斗区域" name="area">
        <GameBattleArea :default-tab="battleSubTab" @create-room="onCreateRoom" />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="房间列表" name="list">
        <GameBattleList @create-room="onCreateRoom" />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="我的房间" name="room" :disabled="!currentBattleRoom">
        <GameBattleRoom @start-battle="onStartBattle" @leave-room="onLeaveRoom" v-if="currentBattleRoom" />
        <div v-else class="text-gray-400 p-4">你还未加入任何房间</div>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="战斗信息" name="battle">
        <el-card body-class="p-0!" class="border-0!">
          <GameBattleDetail></GameBattleDetail>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>