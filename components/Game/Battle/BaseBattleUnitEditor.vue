<template>
  <el-form :model="local" label-width="110px" class="space-y-2" @submit.prevent>
    <el-form-item label="UUID" required>
      <el-input v-model="local.uuid" placeholder="唯一UUID" />
    </el-form-item>
    <el-form-item label="单位ID" required>
      <el-input v-model="local.id" placeholder="配置ID" />
    </el-form-item>
    <el-form-item label="名称" required>
      <el-input v-model="local.name" placeholder="名称" />
    </el-form-item>
    <el-form-item label="描述">
      <el-input v-model="local.description" type="textarea" :rows="2" />
    </el-form-item>
    <el-form-item label="等级" required>
      <el-input-number :controls="false" v-model="local.level" :min="1" />
    </el-form-item>
    <el-form-item label="Boss单位">
      <el-switch v-model="local.isBoss" />
    </el-form-item>
    <el-form-item label="生命" required>
      <div class="flex gap-2 w-full">
        <el-input-number :controls="false" v-model="local.hp" :min="0" class="w-36" />
        <span class="self-center">/</span>
        <el-input-number :controls="false" v-model="local.maxHp" :min="1" class="w-36" />
      </div>
    </el-form-item>
    <el-form-item label="魔法" required>
      <div class="flex gap-2 w-full">
        <el-input-number :controls="false" v-model="local.mp" :min="0" class="w-36" />
        <span class="self-center">/</span>
        <el-input-number :controls="false" v-model="local.maxMp" :min="0" class="w-36" />
      </div>
    </el-form-item>
    <el-form-item label="基础属性" required>
      <div class="grid grid-cols-2 gap-2 w-full">
        <div v-for="key in mainStatusKeys" :key="key" class="flex items-center gap-2">
          <span class="w-16 text-right">{{ allCharacterStatus[key].name }}</span>
          <el-input-number :controls="false" v-model="local.baseStatus[key].level" :min="0" class="w-36" />
        </div>
      </div>
    </el-form-item>
    <el-form-item label="技能选择" required>
      <el-select
        v-model="selectedSkillIds"
        multiple
        filterable
        placeholder="选择技能"
        class="w-full"
      >
        <el-option
          v-for="opt in skillOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <div v-if="skillRows.length" class="mt-2 w-full">
        <el-table :data="skillRows" border :fit="true">
          <el-table-column prop="id" label="技能ID" width="100" />
          <el-table-column prop="name" label="名称" />
          <el-table-column label="等级">
            <template #default="scope">
              <el-input-number :controls="false" v-model="scope.row.level" :min="1" @change="onSkillRowChange(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column label="优先级">
            <template #default="scope">
              <el-input-number :controls="false" v-model="scope.row.order" :min="1" @change="onSkillRowChange(scope.row)" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-form-item>
    <el-form-item label="状态选择">
      <el-select
        v-model="selectedStateIds"
        multiple
        filterable
        placeholder="选择状态"
        class="w-full"
      >
        <el-option v-for="opt in stateOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <div v-if="stateRows.length" class="mt-2">
        <el-table :data="stateRows" size="small" border>
          <el-table-column prop="id" label="状态ID" min-width="200" />
          <el-table-column prop="name" label="名称" min-width="160" />
        </el-table>
      </div>
    </el-form-item>
    <el-form-item label="装备配置">
      <div class="grid grid-cols-2 gap-3 w-full">
        <div v-for="part in equipmentParts" :key="part" class="flex items-center gap-2">
          <span class="w-20 text-right text-sm text-gray-500">{{ partLabel(part) }}</span>
          <el-select
            v-model="selectedEquipment[part]
            "
            filterable
            clearable
            placeholder="选择装备"
            class="flex-1"
          >
            <el-option
              v-for="opt in equipmentOptions[part] ?? []"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
      </div>
    </el-form-item>
    <el-form-item>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" @click="onConfirm">确定</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BaseBattleUnit, BaseUnitStatusInfo, BattleSkillInfo, UnitBattleState } from "~/shared/types/unit";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { allBattleState } from "~/shared/data/allBattleState";
import type { AllBattleSkillId } from "~/shared/types/skill";
import { clone, ObjectKeysTyped } from "~/shared/utils";
import { allCharacterStatus } from "~/shared/data/allCharacterStatus";
import { allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { CharacterEquipmentPart, allCharacterEquipmentPart } from "~/shared/types/characterInfo";
import { parseEquimentPartToString } from "~/shared/utils/game/equipment";

const props = defineProps<{ value: BaseBattleUnit }>();
const emit = defineEmits<{
  (e: "confirm", value: BaseBattleUnit): void;
  (e: "cancel"): void;
}>();

const mainStatusKeys = [
  "strength",
  "dexterity",
  "intelligence",
  "stamina",
  "attacking",
  "defencing",
] as const;

const equipmentParts = allCharacterEquipmentPart;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneUnit = (unit: BaseBattleUnit) => deepClone(unit);

const local = ref<BaseBattleUnit>(cloneUnit(props.value));
local.value.skills = local.value.skills ?? ({} as BattleSkillInfo);
local.value.state = local.value.state ?? ({} as UnitBattleState);
const syncing = ref(false);

type OptionItem = { label: string; value: string };

const selectedSkillIds = ref<AllBattleSkillId[]>([]);
const selectedStateIds = ref<string[]>([]);
const selectedEquipment = ref<Record<string, string | undefined>>(local.value.equipment ?? {});
const skillRows = computed(() => {
  return selectedSkillIds.value.map((id, idx) => {
    const existing = local.value.skills?.[id];
    const meta = skillOptions.value.find((s) => s.value === id);
    return {
      id,
      name: meta?.label ?? id,
      level: existing?.level ?? 1,
      order: existing?.order ?? idx + 1,
    };
  });
});

const stateRows = computed(() => {
  return selectedStateIds.value.map((id) => {
    const meta = stateOptions.value.find((s) => s.value === id);
    return {
      id,
      name: meta?.label ?? id,
    };
  });
});
const skillOptions = computed<OptionItem[]>(() => {
  const dict = allGameBattleSkills;
  return Object.values(dict).map((s) => ({ label: `${s.name}`, value: s.id }));
});

const stateOptions = computed<OptionItem[]>(() => {
  const dict = allBattleState;
  const seen = new Set<string>();
  const list: OptionItem[] = [];
  Object.values(dict).forEach((s) => {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      list.push({ label: `${s.name}`, value: s.id });
    }
  });
  return list;
});

const equipmentOptions = computed(() => {
  const list = Object.values(allGameResourceWithInternal);
  const byPart: Record<string, { label: string; value: string }[]> = {};
  equipmentParts.forEach((p) => (byPart[p] = []));
  list.forEach((item: any) => {
    if (!item) return;
    if (item.category && !item.category.includes("Equipment")) return;
    if (!item.equipPart) return;
    const part = item.equipPart as CharacterEquipmentPart;
    const partKey = part.toString();
    // 饰品槽：任意 decorate* 都可放入任意 decorate 槽
    if (partKey.startsWith("decorate")) {
      equipmentParts
        .filter((p) => p.toString().startsWith("decorate"))
        .forEach((slot) => {
          byPart[slot]?.push({ label: `${item.name} (${item.id})`, value: item.id });
        });
      return;
    }
    if (!byPart[part]) return;
    byPart[part].push({ label: `${item.name} (${item.id})`, value: item.id });
  });
  Object.keys(byPart).forEach((k) => {
    byPart[k].sort((a, b) => a.label.localeCompare(b.label));
  });
  return byPart;
});

const partLabel = (part: CharacterEquipmentPart) => parseEquimentPartToString(part) || part;

const syncFromProps = (v: BaseBattleUnit) => {
  syncing.value = true;
  local.value = cloneUnit(v);
  local.value.skills = local.value.skills ?? ({} as BattleSkillInfo);
  local.value.state = local.value.state ?? ({} as UnitBattleState);
  local.value.equipment = local.value.equipment ?? {};
  selectedSkillIds.value = ObjectKeysTyped(local.value.skills ?? {});
  selectedStateIds.value = ObjectKeysTyped(local.value.state ?? {});
  selectedEquipment.value = { ...(local.value.equipment ?? {}) };
  syncing.value = false;
};

syncFromProps(props.value);

watch(
  () => props.value,
  (v) => {
    syncFromProps(v);
  },
  { deep: true }
);

watch(
  selectedSkillIds,
  (ids) => {
    if (syncing.value) return;
    const skills: BattleSkillInfo = {};
    ids.forEach((id, idx) => {
      const row = skillRows.value.find((r) => r.id === id);
      skills[id as keyof BattleSkillInfo] = {
        level: row?.level ?? 1,
        order: row?.order ?? idx + 1,
      } as BattleSkillInfo[keyof BattleSkillInfo];
    });
    local.value.skills = skills;
  },
  { deep: true }
);

watch(
  selectedStateIds,
  (ids) => {
    if (syncing.value) return;
    const next: UnitBattleState = {};
    ids.forEach((id) => {
      const meta = allBattleState[id as keyof typeof allBattleState];
      const duration = meta?.duration ?? 1;
      next[id as keyof UnitBattleState] = {
        id: id as never,
        addBy: local.value.uuid,
        duration,
        remainingDuration: duration,
        triggered: false,
        extra: {},
      };
    });
    local.value.state = next;
  },
  { deep: true }
);

const onSkillRowChange = (row: { id: string; level: number; order: number }) => {
  if (!local.value.skills) local.value.skills = {} as BattleSkillInfo;
  local.value.skills[row.id as keyof BattleSkillInfo] = {
    level: row.level,
    order: row.order,
  } as BattleSkillInfo[keyof BattleSkillInfo];
};

// states are selection-only; no extra editors needed

const onConfirm = () => {
  local.value.status = clone(local.value.status)
  local.value.equipment = { ...selectedEquipment.value };
  local.value.isPlayer = false;

  emit("confirm", cloneUnit(local.value));
};

const onCancel = () => {
  emit("cancel");
};
</script>
