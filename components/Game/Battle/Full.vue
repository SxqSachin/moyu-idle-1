<script setup lang="ts">
import { ref, watch } from "vue";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import GameBattleList from "./List.vue";
import GameBattleRoom from "./Room.vue";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { GameBattleDetail } from "#components";

const activeTab = ref("explore")

</script>

<template>
  <GameBattle />
</template>