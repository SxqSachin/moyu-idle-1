<template>
  <div class="space-y-2 text-gray-500 dark:text-gray-300 text-sm">
    <div>
      <span> 副本：{{ areaName }} </span>
      <template v-if="room.disableDenseFogModeBecausePlayerLose">
        <span class="text-sm text-gray-400">[迷雾已消散(战败)]</span>
        <slot name="resetDenseFog"></slot>
      </template>
      <template v-if="room.denseFogMode && selectedBattleArea?.denseFogModeRequireResource">
        <span class="text-sm text-gray-400">[迷雾模式]<span v-if="room.autoRestartDenseFogMode">(自动重新进入迷雾)</span></span>
        <div class="mt-4" v-if="room.ownerId === currentUserId">
          作为房主将消耗（迷雾模式):
          <GameCommonItemCountInfoIconAndName :item-count-info="selectedBattleArea.denseFogModeRequireResource"
            :show-count="true" :show-inventory-count="true" />
        </div>
      </template>

      <template v-if="selectedBattleArea?.requireResourceToEnter">
        <div class="mt-4" v-if="room.ownerId === currentUserId">
          作为房主将消耗:
          <GameCommonItemCountInfoIconAndName :item-count-info="selectedBattleArea.requireResourceToEnter"
            :show-count="true" :show-inventory-count="true" />
        </div>
      </template>
    </div>
    <div>难度等级：{{ room.difficulty ? `难度 ${room.difficulty}` : '无额外难度' }}</div>
    <div class="flex flex-row md:flex-col justify-between gap-2">
      <div>自动重开：{{ room.autoRestart ? '是' : '否' }}</div>
      <div>自动开始：{{ room.autoStartBattle ? '是' : '否' }}</div>
    </div>

    <template v-if="currentSelectedAutoWorldBoss">
      <div class="flex flex-row items-center">
        <span>自动挑战“大麻烦”：</span>
        <span class="mr-2">{{ currentSelectedAutoWorldBoss.name }}</span>
        <el-popover width="400">
          <template #reference>
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </template>
          <game-battle-world-boss-card :boss="currentSelectedAutoWorldBoss">
          </game-battle-world-boss-card>
        </el-popover>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BattleRoom, NormalBattleRoom } from '~/shared/types/battleRoom';
import { allBattleAreas } from '~/shared/data/allBattleInfo';
import type { BattleArea } from '~/shared/types/battle';
import GameCommonItemCountInfoIconAndName from '~/components/Game/Common/ItemCountInfoIconAndName.vue';
import type { WorldBossConfigWithState } from '~/shared/types/worldBoss';

import { useWorldBoss } from '~/composables/game/useWorldBoss';
const { availableBossList } = useWorldBoss();

const props = defineProps<{
  room: NormalBattleRoom;
  currentUserId?: string;
}>();

const battleAreaList = Object.values(allBattleAreas);
const selectedBattleArea = computed(() => battleAreaList.find((area) => area.id === props.room.area) as BattleArea | undefined);
const areaName = computed(() => allBattleAreas?.[props.room.area]?.name ?? '未知副本');


const currentSelectedAutoWorldBoss = computed<WorldBossConfigWithState | null>(() => {
  if (props.room.autoWorldBossBattleConf?.type !== 'switch') {
    return null;
  }
  const bossId = props.room.autoWorldBossBattleConf.config.bossId
  return availableBossList.value.find(b => b.id === bossId) || null;
});
</script>
