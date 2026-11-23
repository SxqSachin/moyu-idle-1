<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="普通战斗" name="normal">
      <EditBattleRoomNormalForm
        :room="adaptedRoomForNormal"
        :members="members"
        :loading="loading"
        @submit="(payload) => emits('submit', payload)"
        @cancel="() => emits('cancel')"
      />
    </el-tab-pane>
    <el-tab-pane label="“大麻烦”" name="worldBoss">
      <EditBattleRoomWorldBossForm
        :room="adaptedRoomForWorldBoss"
        :members="members"
        :loading="loading"
        @submit="(payload) => emits('submit', payload)"
        @cancel="() => emits('cancel')"
      />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import EditBattleRoomNormalForm from '~/components/Game/Battle/EditBattleRoomNormalForm.vue';
import EditBattleRoomWorldBossForm from '~/components/Game/Battle/EditBattleRoomWorldBossForm.vue';
import type { BattleRoom, NormalBattleRoom, WorldBossBattleRoom } from '~/shared/types/battleRoom';

const emits = defineEmits<{
  (e: 'submit', payload: any): void;
  (e: 'cancel'): void;
}>();

const props = defineProps<{
  room: BattleRoom;
  members: string[];
  loading?: boolean;
}>();

const activeTab = ref(props.room.battleType === 'worldBoss' ? 'worldBoss' : 'normal');

const adaptedRoomForNormal = computed((): NormalBattleRoom => {
  if (props.room.battleType === 'normal') {
    return props.room as NormalBattleRoom;
  } else {
    // create default normal from worldBoss
    const wb = props.room as WorldBossBattleRoom;
    return {
      ...wb,
      battleType: 'normal',
      area: 'forest_001',
      difficulty: 0,
      denseFogMode: false,
      autoRestartDenseFogMode: false,
      phantomUuidList: [],
      publicBattleLoot: true,
      autoRestart: false,
    } as NormalBattleRoom;
  }
});

const adaptedRoomForWorldBoss = computed((): WorldBossBattleRoom => {
  if (props.room.battleType === 'worldBoss') {
    return props.room as WorldBossBattleRoom;
  } else {
    // create default worldBoss from normal
    const nb = props.room as NormalBattleRoom;
    return {
      ...nb,
      battleType: 'worldBoss',
      worldBossId: '',
      worldBossVersion: undefined,
    } as WorldBossBattleRoom;
  }
});
</script>