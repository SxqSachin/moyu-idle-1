<script setup lang="ts">
import { GameCommonSimpleResourceIconAndName } from "#components";

defineProps<{
  resourceId: string;
  amount: number;
  claimed?: boolean;
}>();
</script>

<template>
  <div class="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-white/5">
    <div class="flex items-center gap-2">
      <GameCommonSimpleResourceIconAndName :resource-id="resourceId" :hide-name="false" :icon-size="10" />
      <span class="text-sm text-gray-700 dark:text-gray-300">x {{ amount }}</span>
      <span v-if="claimed" class="text-xs text-green-600">已领取</span>
    </div>
  </div>
  
</template>

<style scoped>
</style>
