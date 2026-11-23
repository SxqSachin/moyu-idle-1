<template>
  <div class="p-4 space-y-4">
    <el-card shadow="never">
      <div class="font-bold mb-3">创建/更新“大麻烦”战斗配置</div>
      <el-form :model="form" label-width="100px" class="space-y-2" @submit.prevent="onSubmit">
        <el-form-item label="配置ID" required>
          <el-input v-model="form.id" placeholder="唯一ID" clearable />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="显示名称" clearable />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选描述" />
        </el-form-item>
        <el-form-item label="状态" required>
          <el-radio-group v-model="form.state">
            <el-radio label="waiting">待开放</el-radio>
            <el-radio label="battling">进行中</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="隐藏" required>
          <el-radio-group v-model="form.hidden">
            <el-radio :label="true">是</el-radio>
            <el-radio :label="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="form.startAtDate"
            type="datetime"
            placeholder="不设开始时间"
            clearable
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="form.endAtDate"
            type="datetime"
            placeholder="不设结束时间"
            clearable
          />
        </el-form-item>
        <el-form-item label="Boss 阵营" required>
          <div class="space-y-2">
            <div class="flex gap-2">
              <el-button type="primary" size="small" @click="openCreateUnit">新增单位</el-button>
              <span class="text-xs text-gray-500 self-center">按需配置多个 Boss 单位</span>
            </div>
            <el-table :data="form.bossMembers" size="small" border>
              <el-table-column prop="name" label="名称" width="140" />
              <el-table-column prop="id" label="ID" width="160" />
              <el-table-column label="HP" width="140">
                <template #default="scope">
                  {{ scope.row.hp }} / {{ scope.row.maxHp }}
                </template>
              </el-table-column>
              <el-table-column prop="level" label="等级" width="80" />
              <el-table-column label="操作" width="230">
                <template #default="scope">
                  <el-button size="small" @click="editUnit(scope.$index)">编辑</el-button>
                  <el-button size="small" type="primary" @click="openDropEditor(scope.$index)">掉落</el-button>
                  <el-popconfirm title="确认删除该单位？" @confirm="removeUnit(scope.$index)">
                    <template #reference>
                      <el-button size="small" type="danger">删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="onSubmit">保存配置</el-button>
          <el-button type="success" :loading="submittingNoReset" @click="onSubmitNoReset">保存配置（不重置状态）</el-button>
          <el-button type="default" @click="loadList">刷新列表</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="errorMsg" type="error" :closable="false" class="mt-2" :title="errorMsg" />
      <el-alert v-if="successMsg" type="success" :closable="false" class="mt-2" :title="successMsg" />
    </el-card>

    <el-card shadow="never">
      <div class="font-bold mb-3">已配置的Boss战</div>
      <el-table :data="bossList" stripe size="small" height="320px">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="名称" width="120" />
        <el-table-column label="计划" width="220">
          <template #default="scope">
            <div v-if="scope.row.startAt || scope.row.endAt">
              <div v-if="scope.row.startAt">开始：{{ formatTime(scope.row.startAt) }}</div>
              <div v-if="scope.row.endAt">结束：{{ formatTime(scope.row.endAt) }}</div>
            </div>
            <div v-else class="text-gray-400">--</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            {{ scope.row.globalState?.status ?? scope.row.state }}
          </template>
        </el-table-column>
        <el-table-column label="隐藏" prop="hidden" width="100">
        </el-table-column>
        <el-table-column label="进度" width="120">
          <template #default="scope">
            <span v-if="scope.row.globalState">
              {{ scope.row.globalState.currentHp }} / {{ scope.row.globalState.totalHp }}
            </span>
            <span v-else class="text-gray-400">--</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="scope">
            {{ formatTime(scope.row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="Boss数量" width="90">
          <template #default="scope">
            {{ scope.row.bossMembers.length }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="220">
          <template #default="scope">
            <el-button
              size="small"
              :disabled="(scope.row.globalState?.status ?? scope.row.state) == 'battling'"
              @click="loadConfig(scope.row)"
            >
              编辑
            </el-button>
            <el-popconfirm
              title="确认重置该Boss状态？"
              @confirm="resetBoss(scope.row.id)"
            >
              <template #reference>
                <el-button size="small" type="warning" :loading="resetting">重置</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog
      v-model="unitEditorVisible"
      :title="unitEditorMode === 'create' ? '新增单位' : '编辑单位'"
      width="820px"
      @close="resetUnitEditor"
    >
      <game-battle-base-battle-unit-editor
        v-if="unitDraft"
        :value="unitDraft"
        @confirm="saveUnit"
        @cancel="unitEditorVisible = false"
      />
    </el-dialog>
    <el-dialog
      v-model="lootEditorVisible"
      title="配置单位掉落"
      width="520px"
      @close="resetLootEditor"
    >
      <div v-if="currentEditingUnit">
        <div class="mb-3 text-sm text-gray-500">{{ currentEditingUnit.name }} 的掉落</div>
        <el-table :data="currentDrops" size="small" border class="mb-3">
          <el-table-column prop="id" label="物品ID" width="140">
            <template #default="scope">
                <GameCommonSimpleResourceIconAndName :resource-id="scope.row.id" />
            </template>
          </el-table-column>
          <el-table-column label="数量范围">
            <template #default="scope">
              {{ scope.row.range.min }} - {{ scope.row.range.max }}
            </template>
          </el-table-column>
          <el-table-column label="掉落率" width="120">
            <template #default="scope">
              {{ (scope.row.percent * 100).toFixed(2) }}%
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="scope">
              <el-button size="small" @click="editDrop(scope.$index)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeDrop(scope.$index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-form :model="lootDraft" label-width="120px" @submit.prevent="saveDrop">
          <el-form-item label="物品ID" required>
            <el-select v-model="lootDraft.id" placeholder="请选择物品" filterable clearable>
              <el-option v-for="item in itemOptions" :key="item.id" :label="item.name" :value="item.id">
                <GameCommonSimpleResourceIconAndName :resource-id="item.id" />
                <!-- <span class="ml-2">{{ item.name }}</span> -->
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="最小数量" required>
            <el-input-number v-model="lootDraft.range.min" :min="0" />
          </el-form-item>
          <el-form-item label="最大数量" required>
            <el-input-number v-model="lootDraft.range.max" :min="lootDraft.range.min" />
          </el-form-item>
          <el-form-item label="掉落率(0~1)" required>
            <el-input-number v-model="lootDraft.percent" :min="0" :max="1" :step="0.01" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveDrop">{{ dropEditorMode === 'create' ? '新增' : '更新' }}</el-button>
            <el-button @click="resetDropDraft">重置</el-button>
            <el-button @click="lootEditorVisible = false">关闭</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import dayjs from "dayjs";
import type { FuncAction } from "~/shared/types";
import type { BaseBattleUnit } from "~/shared/types/unit";
import type { ItemDrop } from "~/shared/types/emeny";
import type { CreateWorldBossBattleConfigInput, WorldBossBattleConfig, WorldBossConfigWithState, WorldBossStateStatus } from "~/shared/types/worldBoss";
import {
  emitGmCreateWorldBossConfig,
  emitGmListWorldBossConfigs,
  emitGmResetWorldBoss,
  emitGmUpdateWorldBossConfigOnly,
  onGmCreateWorldBossConfigFail,
  onGmCreateWorldBossConfigSuccess,
  onGmListWorldBossConfigsFail,
  onGmListWorldBossConfigsSuccess,
  onGmResetWorldBossFail,
  onGmResetWorldBossSuccess,
  onGmUpdateWorldBossConfigOnlyFail,
  onGmUpdateWorldBossConfigOnlySuccess,
} from "~/api/game/socket/gm";
import GameBattleBaseBattleUnitEditor from "~/components/Game/Battle/BaseBattleUnitEditor.vue";
import { v4 as uuidv4 } from "uuid";
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';

type EditorMode = "create" | "edit";

type BossUnitWithDrops = BaseBattleUnit & { drops?: ItemDrop[] };

const form = ref<
  CreateWorldBossBattleConfigInput & {
    state: WorldBossStateStatus;
    startAtDate?: Date | undefined;
    endAtDate?: Date | undefined;
  }
>({
  id: "",
  name: "",
  description: "",
  state: "waiting",
  bossMembers: [],
  startAtDate: undefined,
  endAtDate: undefined,
  hidden: false,
});

const unitEditorVisible = ref(false);
const unitEditorMode = ref<EditorMode>("create");
const editingIndex = ref<number | null>(null);
const unitDraft = ref<BossUnitWithDrops | null>(null);

const lootEditorVisible = ref(false);
const dropEditorMode = ref<EditorMode>("create");
const editingUnitIndex = ref<number | null>(null);
const editingDropIndex = ref<number | null>(null);
const lootDraft = ref<ItemDrop>({ id: "", range: { min: 1, max: 1 }, percent: 0.1 });
const currentDrops = computed(() => {
  if (editingUnitIndex.value === null) return [] as ItemDrop[];
  return form.value.bossMembers[editingUnitIndex.value]?.drops || [];
});
const currentEditingUnit = computed(() => {
  if (editingUnitIndex.value === null) return null as BossUnitWithDrops | null;
  return form.value.bossMembers[editingUnitIndex.value] || null;
});

const bossList = ref<WorldBossConfigWithState[]>([]);
const submitting = ref(false);
const submittingNoReset = ref(false);
const successMsg = ref("");
const errorMsg = ref("");
const resetting = ref(false);

const onSubmit = () => {
  successMsg.value = "";
  errorMsg.value = "";
  submitting.value = true;
  try {
    if (!form.value.id.trim()) {
      throw new Error("配置ID不能为空");
    }
    if (!form.value.name.trim()) {
      throw new Error("名称不能为空");
    }
    if (!form.value.bossMembers.length) {
      throw new Error("至少添加一个Boss单位");
    }
    const payload: CreateWorldBossBattleConfigInput = {
      id: form.value.id.trim(),
      name: form.value.name.trim(),
      description: form.value.description?.trim() || undefined,
      state: form.value.state,
      hidden: form.value.hidden,
      bossMembers: form.value.bossMembers,
          startAt: form.value.startAtDate ? Number(new Date(form.value.startAtDate).getTime()) : undefined,
          endAt: form.value.endAtDate ? Number(new Date(form.value.endAtDate).getTime()) : undefined,
    };
    emitGmCreateWorldBossConfig(payload);
  } catch (e) {
    submitting.value = false;
    errorMsg.value = e instanceof Error ? e.message : "提交失败";
  }
};

const onSubmitNoReset = () => {
  successMsg.value = "";
  errorMsg.value = "";
  submittingNoReset.value = true;
  try {
    if (!form.value.id.trim()) {
      throw new Error("配置ID不能为空");
    }
    if (!form.value.name.trim()) {
      throw new Error("名称不能为空");
    }
    if (!form.value.bossMembers.length) {
      throw new Error("至少添加一个Boss单位");
    }
    const payload: CreateWorldBossBattleConfigInput = {
      id: form.value.id.trim(),
      name: form.value.name.trim(),
      description: form.value.description?.trim() || undefined,
      state: form.value.state,
      bossMembers: form.value.bossMembers,
      startAt: form.value.startAtDate ? Number(new Date(form.value.startAtDate).getTime()) : undefined,
      endAt: form.value.endAtDate ? Number(new Date(form.value.endAtDate).getTime()) : undefined,
    };
    emitGmUpdateWorldBossConfigOnly(payload);
  } catch (e) {
    submittingNoReset.value = false;
    errorMsg.value = e instanceof Error ? e.message : "提交失败";
  }
};

const loadList = () => {
  emitGmListWorldBossConfigs();
};

const resetBoss = (bossId: string) => {
  resetting.value = true;
  successMsg.value = "";
  errorMsg.value = "";
  emitGmResetWorldBoss(bossId);
};

const formatTime = (ts: number) => dayjs(ts).format("YYYY-MM-DD HH:mm:ss");

const loadConfig = (cfg: WorldBossConfigWithState) => {
  if ((cfg.globalState?.status ?? cfg.state) === "battling") {
    errorMsg.value = "当前Boss战正在进行中，无法编辑配置";
    return;
  }
  form.value = {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,
    state: cfg.state,
    bossMembers: JSON.parse(JSON.stringify(cfg.bossMembers)) as BossUnitWithDrops[],
    startAtDate: cfg.startAt ? new Date(cfg.startAt) : undefined,
    endAtDate: cfg.endAt ? new Date(cfg.endAt) : undefined,
  };
};

const createEmptyUnit = (): BossUnitWithDrops => ({
  uuid: uuidv4(),
  id: "boss_" + Math.random().toString(36).slice(2, 8),
  name: "Boss",
  description: "",
  hp: 100,
  maxHp: 100,
  mp: 0,
  maxMp: 0,
  level: 1,
  isPlayer: false,
  baseStatus: {
    strength: { level: 1 },
    dexterity: { level: 1 },
    intelligence: { level: 1 },
    stamina: { level: 1 },
    attacking: { level: 1 },
    defencing: { level: 1 },
    otherStatus: {},
  },
  status: {
    strength: { level: 1 },
    dexterity: { level: 1 },
    intelligence: { level: 1 },
    stamina: { level: 1 },
    attacking: { level: 1 },
    defencing: { level: 1 },
    otherStatus: {},
  },
  tmpShield: 0,
  skills: {},
  ai: {},
  state: {},
  affix: [],
  equipment: {},
  inventory: {},
  skillColddown: {},
  tmpOncePreBattleExtraTurnIndexList: [],
  triggerMark: {},
  ip: "",
  fp: "",
  stateWhenStartEachBattle: undefined,
  stateWhenStartFirstBattle: undefined,
  skillTreeNodes: [],
  drops: [],
});

const openCreateUnit = () => {
  unitEditorMode.value = "create";
  unitDraft.value = createEmptyUnit();
  unitEditorVisible.value = true;
};

const editUnit = (index: number) => {
  const target = form.value.bossMembers[index];
  unitEditorMode.value = "edit";
  editingIndex.value = index;
  unitDraft.value = JSON.parse(JSON.stringify(target)) as BossUnitWithDrops;
  unitEditorVisible.value = true;
};

const removeUnit = (index: number) => {
  form.value.bossMembers.splice(index, 1);
};

const saveUnit = (unit?: BossUnitWithDrops) => {
  const payload = unit || unitDraft.value;
  if (!payload) return;
  if (unitEditorMode.value === "create") {
    form.value.bossMembers.push(payload);
  } else if (unitEditorMode.value === "edit" && editingIndex.value !== null) {
    form.value.bossMembers.splice(editingIndex.value, 1, payload);
  }
  unitEditorVisible.value = false;
  editingIndex.value = null;
};

const resetUnitEditor = () => {
  unitDraft.value = null;
  editingIndex.value = null;
};

const defaultDropDraft = (): ItemDrop => ({ id: "", range: { min: 1, max: 1 }, percent: 0.1 });

const resetDropDraft = () => {
  lootDraft.value = defaultDropDraft();
  dropEditorMode.value = "create";
  editingDropIndex.value = null;
};

const openDropEditor = (unitIndex: number) => {
  editingUnitIndex.value = unitIndex;
  dropEditorMode.value = "create";
  editingDropIndex.value = null;
  lootDraft.value = defaultDropDraft();
  lootEditorVisible.value = true;
};

const itemOptions = computed(() => {
  return Object.values(allGameResourceWithInternal).map((item: any) => ({ id: item.id, name: item.name }));
});

const editDrop = (index: number) => {
  if (editingUnitIndex.value === null) return;
  const target = currentDrops.value[index];
  if (!target) return;
  dropEditorMode.value = "edit";
  editingDropIndex.value = index;
  lootDraft.value = JSON.parse(JSON.stringify(target)) as ItemDrop;
};

const removeDrop = (index: number) => {
  if (editingUnitIndex.value === null) return;
  const unit = form.value.bossMembers[editingUnitIndex.value];
  if (!unit?.drops) return;
  unit.drops.splice(index, 1);
};

const saveDrop = () => {
  if (editingUnitIndex.value === null) return;
  const unit = form.value.bossMembers[editingUnitIndex.value];
  if (!unit.drops) unit.drops = [];
  const next = { ...lootDraft.value, range: { ...lootDraft.value.range } } as ItemDrop;
  if (dropEditorMode.value === "create") {
    unit.drops.push(next);
  } else if (dropEditorMode.value === "edit" && editingDropIndex.value !== null) {
    unit.drops.splice(editingDropIndex.value, 1, next);
  }
  resetDropDraft();
};

const resetLootEditor = () => {
  resetDropDraft();
  editingUnitIndex.value = null;
  lootEditorVisible.value = false;
};

let offCreateOk: FuncAction | undefined;
let offCreateFail: FuncAction | undefined;
let offUpdateOnlyOk: FuncAction | undefined;
let offUpdateOnlyFail: FuncAction | undefined;
let offListOk: FuncAction | undefined;
let offListFail: FuncAction | undefined;
let offResetOk: FuncAction | undefined;
let offResetFail: FuncAction | undefined;

onMounted(() => {
  offCreateOk = onGmCreateWorldBossConfigSuccess((cfg) => {
    submitting.value = false;
    successMsg.value = `已保存：${cfg.name}`;
    loadList();
  });
  offCreateFail = onGmCreateWorldBossConfigFail((err) => {
    submitting.value = false;
    errorMsg.value = err.message || "创建失败";
  });
  offUpdateOnlyOk = onGmUpdateWorldBossConfigOnlySuccess((cfg) => {
    submittingNoReset.value = false;
    successMsg.value = `已保存（未重置状态）：${cfg.name}`;
    loadList();
  });
  offUpdateOnlyFail = onGmUpdateWorldBossConfigOnlyFail((err) => {
    submittingNoReset.value = false;
    errorMsg.value = err.message || "更新失败";
  });
  offListOk = onGmListWorldBossConfigsSuccess((resp) => {
    bossList.value = resp.list;
  });
  offListFail = onGmListWorldBossConfigsFail((err) => {
    errorMsg.value = err.message || "获取列表失败";
  });

  offResetOk = onGmResetWorldBossSuccess(() => {
    resetting.value = false;
    successMsg.value = "Boss 状态已重置";
    loadList();
  });
  offResetFail = onGmResetWorldBossFail((err) => {
    resetting.value = false;
    errorMsg.value = err.message || "重置失败";
  });

  loadList();
});

onUnmounted(() => {
  offCreateOk?.();
  offCreateFail?.();
  offUpdateOnlyOk?.();
  offUpdateOnlyFail?.();
  offListOk?.();
  offListFail?.();
  offResetOk?.();
  offResetFail?.();
});
</script>
