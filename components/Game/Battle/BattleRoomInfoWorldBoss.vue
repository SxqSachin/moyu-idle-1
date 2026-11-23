<template>
  <div class="mt-2 space-y-1 text-gray-500 dark:text-gray-300" v-if="currentSelectedBossBattle">
    <game-battle-world-boss-card :boss="currentSelectedBossBattle" :show-refresh="true">
      <template #actions>
        <world-boss-leaderboard :boss="currentSelectedBossBattle" />
      </template>
    </game-battle-world-boss-card>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { GameBattleWorldBossCard } from '#components';
import { computed } from 'vue';
import { useWorldBoss } from '~/composables/game/useWorldBoss';
import type { WorldBossBattleRoom } from '~/shared/types/battleRoom';
import type { WorldBossConfigWithState } from '~/shared/types/worldBoss';
import WorldBossLeaderboard from '~/components/Game/Battle/WorldBossLeaderboard.vue';

const props = defineProps<{ 
  room: WorldBossBattleRoom 
}>();


const { bossList, loading: loadingBoss, refresh: refreshWorldBossList } = useWorldBoss();
const currentSelectedBossBattle = computed(() => {
  return bossList.value.find((boss) => boss.id === props.room.worldBossId);
});
</script>
