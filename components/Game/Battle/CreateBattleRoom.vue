<template>
  <CreateBattleRoomForm
    v-bind="passThroughProps"
    @create-room="() => emits('createRoom')"
    @cancel="() => emits('cancel')"
  />
</template>

<script setup lang="ts">
import CreateBattleRoomForm from '~/components/Game/Battle/CreateBattleRoomForm.vue';
import type { AllBattleAreaID } from '~/shared/types/battle';

const emits = defineEmits<{
  (e: 'createRoom'): void;
  (e: 'cancel'): void;
}>();

const props = defineProps<{
  defaultArea: AllBattleAreaID;
  battleType?: 'worldBoss' | 'normal';
  worldBossId?: string;
  worldBossName?: string;
  worldBossVersion?: number;
}>();

const passThroughProps = computed(() => ({
  defaultArea: props.defaultArea,
  battleType: props.battleType,
  worldBossId: props.worldBossId,
  worldBossName: props.worldBossName,
  worldBossVersion: props.worldBossVersion,
}));
</script>