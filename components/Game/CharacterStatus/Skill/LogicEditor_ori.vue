<template>
  <el-card class="mb-2" shadow="never">
    <div class="font-bold mb-2">自动使用逻辑</div>
    <el-form label-position="left" :disabled="!editable">
      <el-form-item
        v-for="(logic, idx) in normalizedLogicList"
        :key="idx"
        class="mb-4 logic-block"
        style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px;"
      >
        <div class="flex flex-col gap-2 w-full">
          <el-form-item label="判断类型">
            <el-select v-model="logic.compareType" placeholder="判断类型" style="width: 100%;" @change="onCompareTypeChange(idx, logic)">
              <el-option v-for="(label, val) in compareTypeOptions" :key="val" :label="label" :value="val" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标">
            <el-select v-model="logic.target" placeholder="目标" style="width: 100%;" @change="emitChange">
              <el-option v-for="(label, val) in targetOptions" :key="val" :label="label" :value="val" />
            </el-select>
          </el-form-item>
          <!-- 数值判断 -->
          <template v-if="logic.compareType === 'value'">
            <el-form-item label="数据类型">
              <el-select v-model="logic.dataType" placeholder="数据类型" style="width: 100%;" @change="emitChange">
                <el-option v-for="(label, val) in dataTypeOptions" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="比较">
              <el-select v-model="logic.valueCompareAction" placeholder="比较" style="width: 100%;" @change="emitChange">
                <el-option v-for="(label, val) in compareActionOptions" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="条件">
              <el-input
                v-model="logic.valueConditionValue"
                style="width: 180px"
                placeholder="如 百分比50% 或 具体数值30"
                :formatter="formatConditionValue"
                :parser="parseConditionValue"
                @input="emitChange"
              />
            </el-form-item>
          </template>
          <!-- 状态判断 -->
          <template v-else-if="logic.compareType === 'state'">
            <el-form-item label="状态判断">
              <el-select v-model="logic.stateCompareAction" placeholder="状态判断" style="width: 100%;" @change="emitChange">
                <el-option v-for="(label, val) in stateCompareActionOptions" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态ID">
              <el-select :filterable="true" v-model="logic.stateCompareStateId" placeholder="选择状态" style="width: 100%;" @change="emitChange">
                <el-option v-for="item in stateIdOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </template>
          <template v-else-if="logic.compareType === 'cooldown'">
            <el-form-item label="冷却判断">
              <el-select v-model="logic.cooldownCompareAction" placeholder="冷却判断" style="width: 100%;" @change="emitChange">
                <el-option v-for="(label, val) in cooldownCompareActionOptions" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="技能">
              <el-select
                v-model="logic.cooldownSkillIds"
                multiple
                filterable
                placeholder="选择技能"
                style="width: 100%;"
                @change="emitChange"
              >
                <el-option v-for="item in skillIdOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </template>
          <!-- 特殊判断 -->
          <template v-else-if="logic.compareType === 'special'">
            <el-form-item label="特殊判断">
              <el-select v-model="logic.specialAction" placeholder="特殊判断" style="width: 100%;" @change="emitChange">
                <el-option v-for="(label, val) in specialActionOptions" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
          </template>
          <template v-if="editable">
            <div class="flex justify-end">
              <el-button type="danger" circle @click="removeLogic(idx)">
                <Icon name="material-symbols:delete-outline-rounded"></Icon>
              </el-button>
            </div>
          </template>
        </div>
      </el-form-item>
    </el-form>
    <template v-if="editable">
      <el-button type="primary" size="small" @click="addLogic">添加逻辑</el-button>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { computed, watch, ref } from "vue";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import {
  GameBattleLogicValueCompareAction,
  GameBattleLogicDataType,
  GameBattleLogicTarget,
  GameBattleLogicStateCompareAction,
  GameBattleLogicSpecialAction,
  type GameBattleLogic,
  GameBattleLogicCooldownCompareAction,
} from "~/shared/types/skill";
import { allBattleState } from "~/shared/data/allBattleState";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";

// 动态获取所有状态ID和名称
const stateIdOptions = computed(() =>
  Object.values(allBattleState).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);

const battleInfo = useBattleInfo();

const props = defineProps<{
  modelValue: any[],
  readonly?: boolean
}>();
const emit = defineEmits(["update:modelValue"]);

const editable = computed(() => !props.readonly && !battleInfo.value?.battleStatus);

const targetOptions = {
  self: "自身",
  allies: "友军",
  enemies: "敌军",
  all: "全部"
};
const dataTypeOptions = {
  lostHp: "损失生命",
  lostMp: "损失魔法",
  hp: "当前生命",
  mp: "当前魔法",
  count: "数量",
  totalHp: "总生命",
  [GameBattleLogicDataType.BuffCount]: "增益状态数量",
  [GameBattleLogicDataType.DebuffCount]: "减益状态数量",
  [GameBattleLogicDataType.FurryStaticElectricityStack]: "静电层数",
};
const compareActionOptions = {
  ">": "大于",
  ">=": "大于等于",
  "<": "小于",
  "<=": "小于等于",
  "=": "等于"
};
const compareTypeOptions = {
  value: "数值判断",
  state: "状态判断",
  cooldown: "技能冷却判断", // 新增
  special: "特殊判断"
};
// 新的状态判断选项，和 skill.ts 保持一致
const stateCompareActionOptions = {
  someoneHasState: "任一目标拥有该状态",
  AllHasState: "全部目标拥有该状态",
  someoneNotHasState: "任一目标没有该状态",
  allNotHasState: "全部目标没有该状态"
};

const cooldownCompareActionOptions = {
  allInCooldown: "所有指定技能均在冷却",
  allNotInCooldown: "所有指定技能均不在冷却",
  someoneInCooldown: "至少一个指定技能在冷却",
  someoneNotInCooldown: "至少一个指定技能不在冷却",
  inCooldown: "指定技能在冷却",
  notInCooldown: "指定技能不在冷却"
};
const skillIdOptions = computed(() =>
  Object.values(allGameBattleSkills).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);

// 特殊判断选项
const specialActionOptions = {
  [GameBattleLogicSpecialAction.EnemyHasBoss]: "中存在Boss",
  [GameBattleLogicSpecialAction.EnemyNotHasBoss]: "中不存在Boss"
};

function formatConditionValue(val: string | number) {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.endsWith("%")) return val;
  if (typeof val === "string" && /^\d+$/.test(val)) return val;
  return "";
}
function parseConditionValue(val: string) {
  if (val.endsWith("%")) return val;
  if (/^\d+$/.test(val)) return Number(val);
  return val;
}

// 兼容旧数据：如果没有 compareType，自动补全为 value 类型
function normalizeLogic(logic: any): GameBattleLogic {
  if (!logic) return {
    target: GameBattleLogicTarget.Self,
    compareType: "value",
    dataType: GameBattleLogicDataType.Hp,
    valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
    valueConditionValue: "50%"
  };
  if (!logic.compareType) {
    // 旧数据，推断为 value 类型
    return {
      target: logic.target ?? GameBattleLogicTarget.Self,
      compareType: "value",
      dataType: logic.dataType ?? GameBattleLogicDataType.Hp,
      valueCompareAction: logic.compareAction ?? logic.valueCompareAction ?? GameBattleLogicValueCompareAction.SmallThan,
      valueConditionValue: logic.conditionValue ?? logic.valueConditionValue ?? "50%"
    };
  }
  if (logic.compareType === "value") {
    return {
      target: logic.target ?? GameBattleLogicTarget.Self,
      compareType: "value",
      dataType: logic.dataType ?? GameBattleLogicDataType.Hp,
      valueCompareAction: logic.valueCompareAction ?? logic.compareAction ?? GameBattleLogicValueCompareAction.SmallThan,
      valueConditionValue: logic.valueConditionValue ?? logic.conditionValue ?? "50%"
    };
  }
  if (logic.compareType === "state") {
    // 兼容旧数据，如果没有stateCompareStateId，默认第一个
    return {
      target: logic.target ?? GameBattleLogicTarget.Self,
      compareType: "state",
      stateCompareAction: logic.stateCompareAction ?? GameBattleLogicStateCompareAction.SomeoneHasState,
      stateCompareStateId: logic.stateCompareStateId ?? stateIdOptions.value[0]?.value
    };
  }
  if (logic.compareType === "cooldown") {
    return {
      target: logic.target ?? GameBattleLogicTarget.Self,
      compareType: "cooldown",
      cooldownCompareAction: logic.cooldownCompareAction ?? "allInCooldown",
      cooldownSkillIds: logic.cooldownSkillIds ?? []
    };
  }
  if (logic.compareType === "special") {
    return {
      target: logic.target ?? GameBattleLogicTarget.Enemies,
      compareType: "special",
      specialAction: logic.specialAction ?? GameBattleLogicSpecialAction.EnemyHasBoss
    };
  }
  // fallback
  return logic;
}

// 反归一化，确保只保留当前 compareType 相关字段
function denormalizeLogic(logic: GameBattleLogic): GameBattleLogic {
  if (logic.compareType === "value") {
    return {
      target: logic.target,
      compareType: "value",
      dataType: logic.dataType,
      valueCompareAction: logic.valueCompareAction,
      valueConditionValue: logic.valueConditionValue,
      // 禁止状态字段
      stateCompareAction: undefined,
      stateCompareStateId: undefined
    };
  }
  if (logic.compareType === "state") {
    return {
      target: logic.target,
      compareType: "state",
      stateCompareAction: logic.stateCompareAction,
      stateCompareStateId: logic.stateCompareStateId,
      // 禁止数值字段
      dataType: undefined,
      valueCompareAction: undefined,
      valueConditionValue: undefined
    };
  }
  if (logic.compareType === "cooldown") {
    return {
      target: logic.target,
      compareType: "cooldown",
      cooldownCompareAction: logic.cooldownCompareAction,
      cooldownSkillIds: logic.cooldownSkillIds,
      // 禁止其它字段
      dataType: undefined,
      valueCompareAction: undefined,
      valueConditionValue: undefined,
      stateCompareAction: undefined,
      stateCompareStateId: undefined,
      specialAction: undefined
    };
  }
  if (logic.compareType === "special") {
    return {
      target: logic.target,
      compareType: "special",
      specialAction: logic.specialAction,
      // 禁止其它字段
      dataType: undefined,
      valueCompareAction: undefined,
      valueConditionValue: undefined,
      stateCompareAction: undefined,
      stateCompareStateId: undefined
    };
  }
  return logic;
}

// 归一化后的逻辑列表，双向绑定
const normalizedLogicList = ref<GameBattleLogic[]>(props.modelValue.map(normalizeLogic));

watch(
  () => props.modelValue,
  (val) => {
    normalizedLogicList.value = val.map(normalizeLogic);
  },
  { deep: true }
);

// 不再 watch normalizedLogicList，避免递归

function emitChange() {
  emit("update:modelValue", normalizedLogicList.value.map(denormalizeLogic));
}

function addLogic() {
  normalizedLogicList.value.push({
    target: GameBattleLogicTarget.Self,
    compareType: "value",
    dataType: GameBattleLogicDataType.Hp,
    valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
    valueConditionValue: '50%'
  });
  emitChange();
}
function removeLogic(idx: number) {
  normalizedLogicList.value.splice(idx, 1);
  emitChange();
}

// 切换判断类型时，重置无关字段
function onCompareTypeChange(idx: number, logic: GameBattleLogic) {
  if (logic.compareType === "value") {
    normalizedLogicList.value[idx] = {
      target: logic.target,
      compareType: "value",
      dataType: GameBattleLogicDataType.Hp,
      valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
      valueConditionValue: "50%"
    };
  } else if (logic.compareType === "state") {
    normalizedLogicList.value[idx] = {
      target: logic.target,
      compareType: "state",
      stateCompareAction: GameBattleLogicStateCompareAction.SomeoneHasState,
      stateCompareStateId: stateIdOptions.value[0]?.value
    };
  } else if (logic.compareType === "special") {
    normalizedLogicList.value[idx] = {
      target: GameBattleLogicTarget.Enemies,
      compareType: "special",
      specialAction: GameBattleLogicSpecialAction.EnemyHasBoss
    };
  } else if (logic.compareType === "cooldown") {
    normalizedLogicList.value[idx] = {
      target: logic.target,
      compareType: "cooldown",
      cooldownCompareAction: GameBattleLogicCooldownCompareAction.AllInCooldown,
      cooldownSkillIds: [skillIdOptions.value[0]?.value]
    };
  }
  emitChange();
}
</script>

<style scoped>
.logic-block + .logic-block {
  margin-top: 16px;
}
</style>