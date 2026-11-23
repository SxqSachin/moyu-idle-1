<template>
  <el-card class="mb-2" shadow="never">
    <div class="font-bold mb-2">自动使用逻辑
      <el-tooltip widt="400" placement="top">
        <template #content>
          每个分组内的链接条件为“并且”，分组间的链接条件为“或”。
          <br/>
          在同一个分组内，当所有逻辑均符合要求时，则此技能、物品的自动使用逻辑便视为通过，将会触发此技能、物品的自动使用。
          <br/>
          如果存在多个分组，则只要存在一个分组，其内的逻辑完全符合要求，则此技能、物品的自动使用逻辑便视为通过。
        </template>
        <el-icon class="cursor-pointer text-gray-400">
          <Icon name="material-symbols:help"></Icon>
        </el-icon>
      </el-tooltip>
    </div>
    <!-- 分组tab形式 -->
    <el-tabs v-model="activeTab" type="card" addable @tab-add="addGroup" @tab-remove="removeGroupTab"
      closable>
      <el-tab-pane v-for="(group, groupIdx) in normalizedGroupList" :key="groupIdx" :label="'组' + (groupIdx + 1)"
        :name="groupIdx.toString()" :closable="editable && normalizedGroupList.length > 1">
        <el-form label-position="left" :disabled="!editable">
          <el-form-item v-for="(logic, idx) in group" :key="idx" class="mb-4 logic-block"
            style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px;">
            <div class="flex flex-col gap-2 w-full">
              <el-form-item label="判断类型">
                <el-select v-model="logic.compareType" placeholder="判断类型" style="width: 100%;"
                  @change="onCompareTypeChange(groupIdx, idx, logic)">
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
                  <el-select v-model="logic.valueCompareAction" placeholder="比较" style="width: 100%;"
                    @change="emitChange">
                    <el-option v-for="(label, val) in compareActionOptions" :key="val" :label="label" :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="条件">
                  <el-input v-model="logic.valueConditionValue" style="width: 180px" placeholder="如 百分比50% 或 具体数值30"
                    :formatter="formatConditionValue" :parser="parseConditionValue" @input="emitChange" />
                </el-form-item>
              </template>
              <!-- 状态判断 -->
              <template v-else-if="logic.compareType === 'stateStack'">
                <el-form-item label="状态">
                  <el-select :filterable="true" v-model="logic.stateCompareStateId" placeholder="选择状态"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="item in stackableStateIdOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="比较">
                  <el-select v-model="logic.valueCompareAction" placeholder="比较" style="width: 100%;"
                    @change="emitChange">
                    <el-option v-for="(label, val) in compareActionOptions" :key="val" :label="label" :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="条件">
                  <el-input-number v-model="logic.valueConditionValue"  style="width: 100%;" placeholder="具体数值：如5、10"
                    @input="emitChange" :step="1" :step-strictly="true" :controls="false" />
                </el-form-item>
              </template>
              <template v-else-if="logic.compareType === 'unitExistState'">
                <el-form-item label="目标中">
                  <el-select :filterable="true" v-model="logic.unitExistCompareAction" placeholder="选择状态"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="(label, val) in unitExistStateCheckAction" :key="val" :label="label" :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="单位">
                  <el-select :filterable="true" v-model="logic.unitId" placeholder="选择单位"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="item in allUnit" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </el-select>
                </el-form-item>
              </template>
              <template v-else-if="logic.compareType === 'state'">
                <el-form-item label="状态判断">
                  <el-select v-model="logic.stateCompareAction" placeholder="状态判断" style="width: 100%;"
                    @change="emitChange">
                    <el-option v-for="(label, val) in stateCompareActionOptions" :key="val" :label="label"
                      :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="状态ID">
                  <el-select :filterable="true" v-model="logic.stateCompareStateId" placeholder="选择状态"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="item in stateIdOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </el-select>
                </el-form-item>
              </template>
              <template v-else-if="logic.compareType === 'cooldown'">
                <el-form-item label="冷却判断">
                  <el-select v-model="logic.cooldownCompareAction" placeholder="冷却判断" style="width: 100%;"
                    @change="emitChange">
                    <el-option v-for="(label, val) in cooldownCompareActionOptions" :key="val" :label="label"
                      :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="技能">
                  <el-select v-model="logic.cooldownSkillIds" multiple filterable placeholder="选择技能"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="item in skillIdOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </el-select>
                </el-form-item>
              </template>
              <template v-else-if="logic.compareType === 'itemCooldown'">
                <el-form-item label="冷却判断">
                  <el-select v-model="logic.cooldownCompareAction" placeholder="冷却判断" style="width: 100%;"
                    @change="emitChange">
                    <el-option v-for="(label, val) in cooldownCompareActionOptions" :key="val" :label="label"
                      :value="val" />
                  </el-select>
                </el-form-item>
                <el-form-item label="物品">
                  <el-select v-model="logic.cooldownItemIds" multiple filterable placeholder="选择物品"
                    style="width: 100%;" @change="emitChange">
                    <el-option v-for="item in itemIdOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
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
                  <el-button type="danger" circle @click="removeLogic(groupIdx, idx)">
                    <Icon name="material-symbols:delete-outline-rounded"></Icon>
                  </el-button>
                </div>
              </template>
            </div>
          </el-form-item>
        </el-form>
        <template v-if="editable">
          <el-button type="primary" size="small" @click="addLogic(groupIdx)">添加逻辑</el-button>
        </template>
      </el-tab-pane>
    </el-tabs>
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
  GameBattleLogicUnitExistStateCompareAction,
} from "~/shared/types/skill";
import { allBattleState } from "~/shared/data/allBattleState";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import type { TabPaneName } from "element-plus";
import type { BattleState } from "~/shared/types/BattleState";
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import { allGameUnit } from "~/shared/types/emeny";
import { allGameResource } from "~/shared/data/allGameResources";

// 动态获取所有状态ID和名称
const stateIdOptions = computed(() =>
  Object.values(allBattleState).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);

const stackableStateIdOptions = computed(() =>
  Object.values(allBattleState).filter(state => {
    return (state as BattleState).stackable
  }).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);

const allUnit = computed(() =>
  Object.values(allGameUnit).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);

const battleInfo = useBattleInfo();

const props = defineProps<{
  modelValue: any[] | any[][],
  readonly?: boolean
}>();
const emit = defineEmits(["update:modelValue"]);

const editable = computed(() => !props.readonly && !battleInfo.value?.battleStatus);

const targetOptions = {
  self: "自身",
  selfSummonedUnit: "属于自己的召唤单位",
  allies: "某个友方",
  enemies: "某个敌方",
  eachAllies: "全部友方",
  eachEnemies: "全部敌方",
  all: "全部",
  none: "无"
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
  [GameBattleLogicDataType.PassedTurn]: "经过回合数",
  [GameBattleLogicDataType.FurryStaticElectricityStack]: "静电层数",
  [GameBattleLogicDataType.FurryStaticElectricityOverloadStack]: "超压层数",
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
  unitExistState: "单位存在状态判断",
  stateStack: "状态层数判断",
  cooldown: "技能冷却判断",
  itemCooldown: "物品冷却判断",
  special: "特殊判断"
};
const stateCompareActionOptions = {
  someoneHasState: "任一目标拥有该状态",
  AllHasState: "全部目标拥有该状态",
  someoneNotHasState: "任一目标没有该状态",
  allNotHasState: "全部目标没有该状态"
};
const cooldownCompareActionOptions = {
  allInCooldown: "所有指定对象均在冷却",
  allNotInCooldown: "所有指定对象均不在冷却",
  someoneInCooldown: "至少一个指定对象在冷却",
  someoneNotInCooldown: "至少一个指定对象不在冷却",
  inCooldown: "指定对象在冷却",
  notInCooldown: "指定对象不在冷却"
};

const unitExistStateCheckAction = {
  [GameBattleLogicUnitExistStateCompareAction.Exist]: "存在",
  [GameBattleLogicUnitExistStateCompareAction.NotExist]: "不存在"
}

const skillIdOptions = computed(() =>
  Object.values(allGameBattleSkills).map((s: any) => ({
    value: s.id,
    label: s.name,
  }))
);
const itemIdOptions = computed(() =>
  Object.values(allGameResource).filter(r => {
    return r.inBattleEffect
  }).map((s) => ({
    value: s.id,
    label: s.name,
  }))
);
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

function normalizeLogic(logic: any): GameBattleLogic {
  if (!logic) return {
    target: GameBattleLogicTarget.Self,
    compareType: "value",
    dataType: GameBattleLogicDataType.Hp,
    valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
    valueConditionValue: "50%"
  };
  if (!logic.compareType) {
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
  if (logic.compareType === "itemCooldown") {
    return {
      target: logic.target ?? GameBattleLogicTarget.Self,
      compareType: "itemCooldown",
      cooldownCompareAction: logic.cooldownCompareAction ?? "allInCooldown",
      cooldownItemIds: logic.cooldownItemIds ?? []
    };
  }
  if (logic.compareType === "special") {
    return {
      target: logic.target ?? GameBattleLogicTarget.Enemies,
      compareType: "special",
      specialAction: logic.specialAction ?? GameBattleLogicSpecialAction.EnemyHasBoss
    };
  }
  return logic;
}

function denormalizeLogic(logic: GameBattleLogic): GameBattleLogic {
  if (logic.compareType === "value") {
    return {
      target: logic.target,
      compareType: "value",
      dataType: logic.dataType,
      valueCompareAction: logic.valueCompareAction,
      valueConditionValue: logic.valueConditionValue,
      stateCompareAction: undefined,
      stateCompareStateId: undefined
    };
  }
  if (logic.compareType === 'stateStack') {
    return {
      target: logic.target,
      compareType: 'stateStack',
      stateCompareStateId: logic.stateCompareStateId,
      valueCompareAction: logic.valueCompareAction,
      valueConditionValue:logic.valueConditionValue, 
    };
  }
  if (logic.compareType === 'unitExistState') {
    return {
      target: logic.target,
      compareType: 'unitExistState',
      unitExistCompareAction: logic.unitExistCompareAction,
      unitId: logic.unitId
    };
  }
  if (logic.compareType === "state") {
    return {
      target: logic.target,
      compareType: "state",
      stateCompareAction: logic.stateCompareAction,
      stateCompareStateId: logic.stateCompareStateId,
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
      dataType: undefined,
      valueCompareAction: undefined,
      valueConditionValue: undefined,
      stateCompareAction: undefined,
      stateCompareStateId: undefined
    };
  }
  return logic;
}

// 归一化为二维数组
const normalizedGroupList = ref<GameBattleLogic[][]>(
  Array.isArray(props.modelValue[0])
    ? props.modelValue.map((group: any[]) => group.map(normalizeLogic))
    : [props.modelValue.map(normalizeLogic)]
);

const activeTab = ref("0");

watch(
  () => props.modelValue,
  (val) => {
    normalizedGroupList.value = Array.isArray(val[0])
      ? val.map((group: any[]) => group.map(normalizeLogic))
      : [val.map(normalizeLogic)];
    // 保证activeTab始终有效
    if (parseInt(activeTab.value) >= normalizedGroupList.value.length) {
      activeTab.value = "0";
    }
  },
  { deep: true }
);

function emitChange() {
  // 如果只有一个分组，降为一维数组，兼容老数据
  if (normalizedGroupList.value.length === 1) {
    emit("update:modelValue", normalizedGroupList.value[0].map(denormalizeLogic));
  } else {
    emit("update:modelValue", normalizedGroupList.value.map(group => group.map(denormalizeLogic)));
  }
}

function addLogic(groupIdx: number) {
  normalizedGroupList.value[groupIdx].push({
    target: GameBattleLogicTarget.Self,
    compareType: "value",
    dataType: GameBattleLogicDataType.Hp,
    valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
    valueConditionValue: '50%'
  });
  emitChange();
}
function removeLogic(groupIdx: number, idx: number) {
  normalizedGroupList.value[groupIdx].splice(idx, 1);
  // 如果分组被清空，自动删除该分组
  if (normalizedGroupList.value[groupIdx].length === 0 && normalizedGroupList.value.length > 1) {
    normalizedGroupList.value.splice(groupIdx, 1);
    // 切换到第一个tab
    activeTab.value = "0";
  }
  emitChange();
}
function addGroup() {
  normalizedGroupList.value.push([
    {
      target: GameBattleLogicTarget.Self,
      compareType: "value",
      dataType: GameBattleLogicDataType.Hp,
      valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
      valueConditionValue: '50%'
    }
  ]);
  activeTab.value = (normalizedGroupList.value.length - 1).toString();
  emitChange();
}
function removeGroupTab(targetName: TabPaneName) {
  const idx = typeof targetName === "number" ? targetName : parseInt(targetName);
  if (idx < 1) {
    return;
  }
  ElMessageBox.confirm(
    '删除此逻辑分组吗',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    if (normalizedGroupList.value.length > 1) {
      normalizedGroupList.value.splice(idx, 1);
      // 切换到第一个tab
      activeTab.value = "0";
      emitChange();
    }
  }).catch(() => { })
}

// 切换判断类型时，重置无关字段
function onCompareTypeChange(groupIdx: number, idx: number, logic: GameBattleLogic) {
  if (logic.compareType === "value") {
    normalizedGroupList.value[groupIdx][idx] = {
      target: logic.target,
      compareType: "value",
      dataType: GameBattleLogicDataType.Hp,
      valueCompareAction: GameBattleLogicValueCompareAction.SmallThan,
      valueConditionValue: "50%"
    };
  } else if (logic.compareType === "state") {
    normalizedGroupList.value[groupIdx][idx] = {
      target: logic.target,
      compareType: "state",
      stateCompareAction: GameBattleLogicStateCompareAction.SomeoneHasState,
      stateCompareStateId: stateIdOptions.value[0]?.value
    };
  } else if (logic.compareType === "special") {
    normalizedGroupList.value[groupIdx][idx] = {
      target: GameBattleLogicTarget.Enemies,
      compareType: "special",
      specialAction: GameBattleLogicSpecialAction.EnemyHasBoss
    };
  } else if (logic.compareType === "cooldown") {
    normalizedGroupList.value[groupIdx][idx] = {
      target: logic.target,
      compareType: "cooldown",
      cooldownCompareAction: GameBattleLogicCooldownCompareAction.AllInCooldown,
      cooldownSkillIds: [skillIdOptions.value[0]?.value]
    };
  } else if (logic.compareType === "itemCooldown") {
    normalizedGroupList.value[groupIdx][idx] = {
      target: logic.target,
      compareType: "itemCooldown",
      cooldownCompareAction: GameBattleLogicCooldownCompareAction.AllInCooldown,
      cooldownItemIds: [itemIdOptions.value[0]?.value]
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