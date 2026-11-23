<template>
  <span class="inline-flex items-center cursor-pointer">
    <GameCommonSimpleIcon :icon="status.icon"></GameCommonSimpleIcon>

    <span class="ml-1">{{ status.name }}{{ suffix }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { allCharacterStatus, internalCharacterStatus } from "~/shared/data/allCharacterStatus";
import type { AllBaseCharacterStatusType, AllCharacterStatusType } from "~/shared/types/characterInfo";

const props = defineProps<{
  status: AllBaseCharacterStatusType | 'workTotal',
  suffix?: string
}>()

const status = computed(() => {
  if (props.status == 'workTotal') {
    return {
      icon: '🛠️',
      name: '总生活等级',
    }
  }

  let res = allCharacterStatus[props.status];
  if (!res) {
    // @ts-ignore
    res = internalCharacterStatus[props.status];
  }
  return res;
});

</script>