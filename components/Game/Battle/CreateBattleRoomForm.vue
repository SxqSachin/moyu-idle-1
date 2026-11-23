<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="普通战斗" name="normal">
      <CreateBattleRoomNormal
        :default-area="defaultArea"
        @create-room="() => emits('createRoom')"
        @cancel="() => emits('cancel')"
      />
    </el-tab-pane>
    <el-tab-pane label="“大麻烦”" name="worldBoss">
      <CreateBattleRoomWorldBoss
        :default-area="defaultArea"
        :world-boss-id="worldBossId"
        :world-boss-name="worldBossName"
        :world-boss-version="worldBossVersion"
        @create-room="() => emits('createRoom')"
        @cancel="() => emits('cancel')"
      />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CreateBattleRoomNormal from '~/components/Game/Battle/CreateBattleRoomNormal.vue';
import CreateBattleRoomWorldBoss from '~/components/Game/Battle/CreateBattleRoomWorldBoss.vue';
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

const activeTab = ref(props.battleType === 'worldBoss' ? 'worldBoss' : 'normal');
</script>