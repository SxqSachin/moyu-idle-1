<template>
  <el-form :model="form" label-width="100px" class="pt-2">
    <el-form-item label="房间名称" required>
      <el-input v-model="form.name" maxlength="20" show-word-limit placeholder="请输入房间名称" />
    </el-form-item>
    <el-form-item label="选择Boss">
      <el-select v-model="form.worldBossId" placeholder="请选择Boss" filterable :loading="loadingBoss" @change="onBossChange">
        <el-option
          v-for="boss in bossList"
          :key="boss.id"
          :label="`${boss.name} (版本: ${boss.version})`"
          :value="boss.id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="“大麻烦”" required v-if="currentSelectedBossBattle">
      <div class="flex w-full">
        <game-battle-world-boss-card :boss="currentSelectedBossBattle">
          <template #actions>
            <WorldBossLeaderboard :boss="currentSelectedBossBattle" />
          </template>
        </game-battle-world-boss-card>
      </div>
    </el-form-item>


    <el-form-item label="是否公开" required>
      <el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有" />
    </el-form-item>
    <!-- <el-form-item label="战利品信息">
      <el-switch v-model="form.publicBattleLoot" active-text="公开" inactive-text="隐藏" />
    </el-form-item> -->

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
      <el-switch v-model="form.autoRestart" />
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
      <el-switch v-model="form.autoStartBattle" />
    </el-form-item>

    <el-form-item label="击败后动作">
      <el-radio-group v-model="(form.afterWin as any).type">
        <el-radio label="wait">等待（不做额外操作）</el-radio>
        <el-radio label="startBattle">开始战斗</el-radio>
      </el-radio-group>

      <div v-if="(form.afterWin as any).type === 'startBattle'" class="mt-3">
        <el-form-item label="副本区域" label-width="80px">
          <el-select v-model="(form.afterWin as any).config.area" placeholder="请选择副本" filterable>
            <el-option v-for="area in battleAreaList" :key="area.id" :label="area.name" :value="area.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="难度等级" label-width="80px">
          <el-radio-group v-model="(form.afterWin as any).config.difficulty">
            <el-radio label="0" :value="0">无额外难度</el-radio>
            <el-radio v-for="(level, idx) in BATTLE_ROOM_DIFFICULTY_LEVELS_INFO" :key="idx" :label="String(idx+1)" :value="idx+1">难度：{{ idx+1 }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </el-form-item>

    <el-divider />

    <el-form-item label="房主" required>
      <el-select v-model="form.ownerId" placeholder="请选择" class="w-full" size="large">
        <template #label>
          <GameUserAvatarAndName :uuid="form.ownerId" :hide-avatar="true" :hide-title="true" />
        </template>
        <el-option
          v-for="uuid in members"
          :key="uuid"
          :value="uuid"
          class="h-16! flex flex-row items-center"
        >
          <GameUserAvatarAndName :uuid="uuid" />
        </el-option>
      </el-select>
    </el-form-item>

    <div class="flex justify-center">
      <el-button @click="emits('cancel')">取消</el-button>
      <el-button type="primary" @click="submit" :loading="loading" :disabled="!canSubmit">保存</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { BattleRoom, UpdateWorldBossBattleRoomInput, WorldBossBattleRoom } from '~/shared/types/battleRoom';
import type { WorldBossConfigWithState, WorldBossSnapshot } from '~/shared/types/worldBoss';
import { useWorldBoss } from '~/composables/game/useWorldBoss';
import { allBattleAreas } from '~/shared/data/allBattleInfo';
import { BATTLE_ROOM_DIFFICULTY_LEVELS_INFO } from '~/shared/data/constant';
import WorldBossLeaderboard from './WorldBossLeaderboard.vue';

const emits = defineEmits<{
  (e: 'submit', payload: UpdateWorldBossBattleRoomInput & { worldBossId: string; worldBossVersion?: number }): void;
  (e: 'cancel'): void;
}>();

const props = defineProps<{
  room: WorldBossBattleRoom;
  members: string[];
  loading?: boolean;
}>();

const form = ref<UpdateWorldBossBattleRoomInput & { worldBossId: string; worldBossVersion?: number }>({
  name: '',
  isPublic: true,
  ownerId: '',
  battleType: 'worldBoss',
  autoRestart: true,
  autoStartBattle: true,
  worldBossId: '',
  worldBossVersion: undefined,
  afterWin: { type: 'wait' },
});

const { bossList, loading: loadingBoss, refresh: refreshWorldBossList } = useWorldBoss();
const battleAreaList = Object.values(allBattleAreas);

// ensure afterWin.config defaults
watch(
  () => form.value.afterWin?.type,
  (newType) => {
    if (newType === 'startBattle') {
      const cfg = (form.value.afterWin as any).config || {};
      if (!cfg.area) cfg.area = battleAreaList[0]?.id;
      if (typeof cfg.difficulty === 'undefined') cfg.difficulty = 0;
      if (typeof cfg.publicBattleLoot === 'undefined') cfg.publicBattleLoot = true;
      (form.value.afterWin as any).config = cfg;
    }
  }
);

watch(
  () => props.room,
  (val) => {
    if (val) {
      form.value.name = val.name || '';
      form.value.isPublic = val.isPublic || false;
      form.value.ownerId = val.ownerId;
      form.value.autoRestart = val.autoRestart;
      form.value.autoStartBattle = val.autoStartBattle;
        form.value.worldBossId = val.worldBossId || '';
        form.value.worldBossVersion = val.worldBossVersion;
        form.value.afterWin = (val as any).afterWin ?? { type: 'wait' };
    }
  },
  { immediate: true }
);

const currentSelectedBossBattle = computed(() => {
    return bossList.value.find((boss) => boss.id === form.value.worldBossId);
})

const canSubmit = computed(() => !!form.value.name && !!form.value.worldBossId);
const loading = computed(() => props.loading ?? false);

function onBossChange(bossId: string) {
  const boss = bossList.value.find(b => b.id === bossId);
  if (boss) {
    form.value.worldBossVersion = boss.version;
  }
}

function submit() {
  if (!canSubmit.value) return;
  emits('submit', {
    name: form.value.name,
    isPublic: form.value.isPublic,
    ownerId: form.value.ownerId,
    autoStartBattle: form.value.autoStartBattle,
    autoRestart: form.value.autoRestart,
    battleType: 'worldBoss',
    worldBossId: form.value.worldBossId,
    worldBossVersion: form.value.worldBossVersion,
    afterWin: form.value.afterWin,
  });
}

// useWorldBoss composable manages load/listeners
</script>
