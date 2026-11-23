<template>
  <span class="inline-flex items-center cursor-pointer">
    <template v-if="action.icon.includes(':')">
      <div class="inline-block">
        <img class="inline aspect-square object-cover" :class="iconClass" :src="getIconPath(action.icon)"></img>
      </div>
    </template>
    <template v-else>
      <span v-if="action.icon" :style="emojiIconStyle">{{ action.icon }}</span>
    </template>
    <span v-if="!hideName" class="ml-1">{{ action.name }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { allGameAction } from '~/shared/data/allGameActions';
import type { AllGameActionID } from "~/shared/types/gameAction";

const props = defineProps<{
  actionId: AllGameActionID
  hideName?: boolean
  iconSize?: number
}>()

const showActionDialog = ref(false);

const action = computed(() => {
  if (!props.actionId) return allGameAction.farming;
  return allGameAction[props.actionId];
});

const emojiIconStyle = computed(() => {
    return props.iconSize ? `font-size: ${props.iconSize+18}px;` : 'font-size: 14px;'
}) 

const iconClass = computed(() => {
    return props.iconSize ? `w-${props.iconSize} h-${props.iconSize}` : 'w-4 h-4'
}) 
</script>