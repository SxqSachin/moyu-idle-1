<template>
  <span class="inline-flex items-center "
  :class="{
    'cursor-pointer': !onlyName
  }"
   @click="handleClick">
    <template v-if="action.icon.includes(':')">
      <div class="inline-block mr-1">
        <img class="inline w-4 h-4" :src="getIconPath(action.icon)"></img>
      </div>
    </template>
    <template v-else>
      <span v-if="action.icon" class="mr-1">{{ action.icon }}</span>
    </template>
    <span>{{ action.name }}{{ costCount ? `(消耗: ${costCount})` : '' }}</span>
    <span v-if="percent !== undefined" class="ml-1 text-green-700 dark:text-green-200 ">
      ({{ (percent * 100).toFixed(2) }}%)
    </span>
  </span>
  <el-dialog v-if="showActionDialog" v-model="showActionDialog" title="执行动作" width="10%" :close-on-click-modal="true">
    <GameActionCard v-if="action" :action="action" :only-card="true" @dialog-close="showActionDialog = false" />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { allCharacterStatus, allCharacterStatusType } from "~/shared/data/allCharacterStatus";
import { allGameAction, allGameActionMainType } from '~/shared/data/allGameActions';
import { type GameAction, type AllGameActionID } from "~/shared/types/gameAction";

const props = defineProps<{
  actionId: AllGameActionID
  costCount?: number
  percent?: number
  onlyName?: boolean
}>()

const showActionDialog = ref(false);

// @ts-expect-error
const action = computed<GameAction>(() => {
  if (!props.actionId) return allGameAction.farming;

  if (props.actionId == 'allMysteriousAction') {
    return {
      name: '所有炼金行动（不包含炼金台）',
      icon: allCharacterStatus.mysterious.icon,
      action: null,
    };
  }

  if (props.actionId == 'allCookingAction') {
    return {
      name: '所有烹饪行动',
      icon: allCharacterStatus.cooking.icon,
      action: null,
    };
  }

  if (props.actionId == 'allMiningAction') {
    return {
      name: '所有挖掘行动',
      icon: allCharacterStatus.mining.icon,
      action: null,
    };
  }

  if (props.actionId == 'allAction') {
    return {
      name: '所有行动',
      icon: '',
      action: null,
    };
  }

  if (props.actionId == 'allWorkAction') {
    return {
      name: '所有生活行动',
      icon: '',
      action: null,
    };
  }

  if (props.actionId == 'allSpecialManufactureAction') {
    return {
      name: '所有特殊制造行动',
      icon: allCharacterStatus.manufacturing.icon,
      action: null,
    };
  }

  if (props.actionId == 'allForgingAction') {
    return {
      name: '所有锻造行动',
      icon: allCharacterStatus.forging.icon,
      action: null,
    };
  }

  if (props.actionId == 'allFishingAction') {
    return {
      name: '所有钓鱼行动',
      icon: allCharacterStatus.fishing.icon,
      action: null,
    };
  }

  if (props.actionId == 'allCollectingAction') {
    return {
      name: '所有采集行动',
      icon: allCharacterStatus.collecting.icon,
      action: null,
    };
  }

  if (props.actionId == 'allSewingAction') {
    return {
      name: '所有缝纫行动',
      icon: allCharacterStatus.sewing.icon,
      action: null,
    };
  }

  if (props.actionId == 'allExploreAction') {
    return {
      name: '所有探索行动',
      icon: allCharacterStatus.exploring.icon,
      action: null,
    };
  }

  if (props.actionId == 'allLevel1Manufacture') {
    return {
      name: '所有制造行动',
      icon: allCharacterStatus.manufacturing.icon,
      action: null,
    };
  }

  if (props.actionId == 'allFarmingAnimalAction') {
    return {
      name: '所有照料家禽行动',
      icon: allCharacterStatus.farmingAnimal.icon,
      action: null,
    };
  }

  if (props.actionId == 'allExerciseAction') {
    return {
      name: '所有自我提升动作',
      icon: allCharacterStatus.knowledge.icon,
      action: null,
    };
  }

  return allGameAction[props.actionId];
});

function handleClick() {
  if (props.onlyName) {
    return;
  }
  if (action.value.id.startsWith("dismantle_") || action.value.id.startsWith("build_")) {
    return;
  }
  if (props.actionId && action.value) {
    showActionDialog.value = true;
  }
}
</script>