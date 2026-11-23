<template>
  <el-form :model="createForm" label-width="100px" class="pt-2">
    <el-form-item label="房间名称" required>
      <el-input v-model="createForm.name" maxlength="20" show-word-limit placeholder="请输入房间名称" />
    </el-form-item>

    <el-form-item label="选择Boss" required>
      <el-select v-model="createForm.worldBossId" placeholder="请选择Boss" filterable :loading="loadingBoss" @change="onBossChange">
        <el-option
          v-for="boss in bossList"
          :key="boss.id"
          :label="`${boss.name} (版本: ${boss.version})`"
          :value="boss.id"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="“大麻烦”" required v-if="currentSelectedBossBattle">
      <div class="flex flex-wrap items-center gap-2 w-full">
        <game-battle-world-boss-card :boss="currentSelectedBossBattle">
          <template #actions>
            <world-boss-leaderboard :boss="currentSelectedBossBattle" />
          </template>
        </game-battle-world-boss-card>
      </div>
    </el-form-item>


    <el-form-item label="是否公开">
      <el-switch v-model="createForm.isPublic" active-text="公开" inactive-text="私有" />
    </el-form-item>

    <el-form-item label="自动重开">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>自动重开</el-text>
          <el-tooltip content="开启后，每次因战斗胜利结束战斗时，会在4秒后会自动重开房间；因战斗失败结束战斗时，会在15秒后自动重开房间。" placement="top">
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.autoRestart" />
    </el-form-item>

    <el-form-item label="自动开始">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>自动开始</el-text>
          <el-tooltip content="开启后，当全员准备就绪时，战斗将在4秒后自动开启。" placement="top">
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.autoStartBattle" />
    </el-form-item>

    <!-- <el-form-item label="战利品信息">
      <el-switch v-model="createForm.publicBattleLoot" active-text="公开" inactive-text="隐藏" />
    </el-form-item> -->

    <el-form-item label="击败后动作">
      <el-radio-group v-model="(createForm.afterWin as any).type">
        <el-radio label="wait">等待（不做额外操作）</el-radio>
        <el-radio label="startBattle">开始战斗</el-radio>
      </el-radio-group>

      <div v-if="(createForm.afterWin as any).type === 'startBattle'" class="mt-3">
        <el-form-item label="副本区域" label-width="80px">
          <el-select v-model="(createForm.afterWin as any).config.area" placeholder="请选择副本" filterable>
            <el-option v-for="area in battleAreaList" :key="area.id" :label="area.name" :value="area.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="难度等级" label-width="80px">
          <el-radio-group v-model="(createForm.afterWin as any).config.difficulty">
            <el-radio label="0" :value="0">无额外难度</el-radio>
            <el-radio v-for="(level, idx) in BATTLE_ROOM_DIFFICULTY_LEVELS_INFO" :key="idx" :label="String(idx+1)" :value="idx+1">难度：{{ idx+1 }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </el-form-item>

    <el-form-item>
      <el-button @click="emits('cancel')">取消</el-button>
      <el-button type="primary" @click="handleCreateRoom" :disabled="!canCreate" :loading="creatingRoom">创建</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { emitBattleRoomCreate } from '~/api/game/socket/battleRoom';
import type { AllBattleAreaID } from '~/shared/types/battle';
import type { CreateWorldBossBattleRoomInput } from '~/shared/types/battleRoom';
import type { WorldBossConfigWithState, WorldBossSnapshot } from '~/shared/types/worldBoss';
import { useWorldBoss } from '~/composables/game/useWorldBoss';
import { GameBattleWorldBossCard } from '#components';
import { allBattleAreas } from '~/shared/data/allBattleInfo';
import { BATTLE_ROOM_DIFFICULTY_LEVELS_INFO } from '~/shared/data/constant';
import WorldBossLeaderboard from './WorldBossLeaderboard.vue';

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

const createForm = ref<CreateWorldBossBattleRoomInput & { worldBossVersion?: number }>({
  name: '',
  isPublic: true,
  publicBattleLoot: true,
  battleType: 'worldBoss',
  worldBossId: props.worldBossId || '',
  worldBossVersion: props.worldBossVersion,
  autoStartBattle: true,
  autoRestart: true,
  afterWin: { type: 'wait' },
});
const creatingRoom = ref(false);

const { bossList, loading: loadingBoss, refresh: refreshWorldBossList } = useWorldBoss();
const battleAreaList = Object.values(allBattleAreas);

// Ensure afterWin.config has sane defaults when switching to startBattle
watch(
  () => (createForm.value.afterWin as any)?.type,
  (newType) => {
    if (newType === 'startBattle') {
      const cfg = (createForm.value.afterWin as any).config || {};
      if (!cfg.area) cfg.area = battleAreaList[0]?.id;
      if (typeof cfg.difficulty === 'undefined') cfg.difficulty = 0;
      if (typeof cfg.publicBattleLoot === 'undefined') cfg.publicBattleLoot = true;
      (createForm.value.afterWin as any).config = cfg;
    }
  }
);

watch(
  () => props.worldBossId,
  (newId) => {
    if (newId && !createForm.value.worldBossId) {
      createForm.value.worldBossId = newId;
      createForm.value.worldBossVersion = props.worldBossVersion;
    }
  },
  { immediate: true }
);

const canCreate = computed(() => !!createForm.value.name && !!createForm.value.worldBossId);

const currentSelectedBossBattle = computed(() => {
    return bossList.value.find((boss) => boss.id === createForm.value.worldBossId);
})

function onBossChange(bossId: string) {
  const boss = bossList.value.find(b => b.id === bossId);
  if (boss) {
    createForm.value.worldBossVersion = boss.version;
  }
}


async function handleCreateRoom() {
  if (!canCreate.value) return;
  creatingRoom.value = true;
  if ((createForm.value.afterWin as any)?.type === 'startBattle') {
    const cfg = (createForm.value.afterWin as any).config || {};
    if (!cfg.area) {
      ElMessage.error('请为击败后开始的战斗选择副本区域');
      creatingRoom.value = false;
      return;
    }
  }
  emitBattleRoomCreate({
    name: createForm.value.name,
    isPublic: createForm.value.isPublic,
    autoStartBattle: createForm.value.autoStartBattle,
    autoRestart: createForm.value.autoRestart,
    publicBattleLoot: createForm.value.publicBattleLoot,
    battleType: 'worldBoss',
    worldBossId: createForm.value.worldBossId,
    worldBossVersion: createForm.value.worldBossVersion,
    afterWin: createForm.value.afterWin,
  });
  creatingRoom.value = false;

  emits('createRoom');
}

// composable handles mounting, listeners and initial refresh
</script>
