<template>
  <div class="character-status-info flex flex-col gap-4">

    <GameCharacterStatusSatietyInfo :satiety="characterSatiety" />
    <template v-if="gameState">
      <GameCharacterStatusGameState :game-state="gameState"></GameCharacterStatusGameState>
    </template>

    <el-divider class="my-2!"></el-divider>

    <div class="grid grid-cols-2 md:grid-cols-2 gap-2">
      <template v-for="(status) in allWorkStatus" :key="status">
        <GameCharacterStatusDetail :status="status" :status-detail="characterStatus[status]">
        </GameCharacterStatusDetail>
      </template>
    </div>
    <el-divider class="my-1!"></el-divider>
    <div class="grid grid-cols-2 md:grid-cols-2 gap-2">
      <template v-for="(status) in allBattleStatus" :key="status">
        <GameCharacterStatusDetail :status="status" :status-detail="characterStatus[status]">
        </GameCharacterStatusDetail>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { allBattleStatus, allCharacterBaseStatusType, allWorkStatus } from "@/shared/data/allCharacterStatus"
import { emitGetCharacterGameState, onGetCharacterGameStateError, onGetCharacterGameStateSuccess } from "~/api/game/socket/character"
import { emitRequestCharacterStatusInfo, } from "~/api/game/socket/characterStatusInfo"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { useCharacterStatusInfo } from "~/composables/game/useCharacterStatusInfo"
import { useInventory } from "~/composables/game/useInventory"
import type { FuncAction } from "~/shared/types"
import type { PlayerState } from "~/shared/types/characterInfo"

const characterStatus = useCharacterStatusInfo()

const gameState = ref<PlayerState>()

const inventory = useInventory()
const characterSatiety = computed(() => {
    return inventory.value.__satiety?.count || 0
})

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
  await waitUtilConnected()
  emitRequestCharacterStatusInfo()
  emitGetCharacterGameState()

  off1 = onGetCharacterGameStateSuccess(({ gameState: state }) => {
    gameState.value = state
  })
  off2 = onGetCharacterGameStateError(({ message }) => {
    ElNotification.error({
      title: "获取角色状态失败",
      message,
    })
  })
})

onUnmounted(() => {
  off1?.()
  off2?.()
})
</script>