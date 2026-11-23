<template>
  <div v-if="!inited">
    <div class="flex items-center justify-center h-64">
      准备中...
      <el-icon class="text-4xl text-gray-500 animate-spin">
        <loading />
      </el-icon>
    </div>
  </div>
  <div v-if="sended && !record">
    <div class="flex items-center justify-center h-64">
      强化准备中...
      <el-icon class="text-4xl text-gray-500 animate-spin">
        <loading />
      </el-icon>
    </div>
  </div>
  <div v-if="!sended && inited && !currentAutoEnhance" class="w-full flex flex-col gap-4">
    <!-- 装备选择区 -->
    <div class="flex items-center gap-3">
      <div
        class="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-100 relative flex items-center justify-center border-2 border-blue-400 shadow">
        <span v-if="selectedItem" class="text-3xl">
          <GameCommonSimpleResourceIconAndName :show-extra-text="true" :hide-name="true" :resource-id="selectedItem.id"
            :icon-size="8">
          </GameCommonSimpleResourceIconAndName>
        </span>
        <span v-else class="text-gray-400 text-xl">?</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-blue-700 truncate">
          {{ selectedItem?.name ? selectedItem.name : "请选择装备" }}
        </div>
      </div>

      <GameInventorySelector :only-enhanceable="true" :categoryGroups="[GameResourceCategory.Equipment, 'workEquipment', 'battleEquipment']" @select="onDialogSelect" title="选择强化装备">
        <template #trigger>
          <el-button type="primary" plain>
            <span v-if="selectedItem">更换</span>
            <span v-else>选择</span>
          </el-button>
        </template>
      </GameInventorySelector>

    </div>

    <!-- 材料区 -->
    <div>
      <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">所需材料</div>
      <div class="flex flex-wrap gap-2">
        <template
          v-if="selectedItem && enhanceInfo && enhanceInfo.enhanceRequireResource && enhanceInfo.enhanceRequireResource.length">
          <template v-for="req in enhanceInfo.enhanceRequireResource" :key="req.resourceId">
            <GameCommonResourceIconAndName :resource-id="req.resourceId" :count="req.count" :color="getEnhanceRequiredResourceColor(req)">({{ formatNumber(getEnhanceRequiredResourceCount(req)) }})</GameCommonResourceIconAndName>
          </template>
        </template>
        <template v-else>
          <span class="text-md text-gray-300">请选择装备后显示所需材料</span>
        </template>
      </div>
    </div>

    <!-- 保护装备区 -->
    <div>
      <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">保护装备（可选）</div>
      <el-dropdown trigger="click" :disabled="!selectedItem" @command="onProtectDropdownCommand"
        popper-class="protect-dropdown-popper">
        <div class="border px-3 py-1 flex justify-between items-center cursor-pointer h-8 w-48 rounded" :class="{
        'border-gray-300': !selectedItem,
        'border-gray-500': selectedItem,
      }">
          <span v-if="selectedProtectItem">
            <GameCommonSimpleResourceIconAndName :resource-id="selectedProtectItem.id">
            </GameCommonSimpleResourceIconAndName>
          </span>
          <span v-else class="text-gray-400">不使用保护装备</span>
        </div>
        <template #dropdown>
          <div class="flex flex-wrap gap-2 p-2 max-w-[340px]">
            <div class="cursor-pointer" @click.stop="onProtectDropdownCommand(null)">
              <el-card :class="{ 'border-blue-500 ring-2 ring-blue-400': !selectedProtectId }"
                class="min-w-[100px] max-w-[120px] flex-1 text-center" shadow="hover">
                <div class="flex flex-col items-center">
                  <span class="text-2xl text-gray-400">🚫</span>
                  <span class="mt-1 text-gray-400 text-xs">不使用</span>
                </div>
              </el-card>
            </div>
            <div v-for="pid in protectableIds" :key="pid" class="cursor-pointer"
              @click.stop="onProtectDropdownCommand(pid)">
              <el-card :class="{ 'border-blue-500 ring-2 ring-blue-400': selectedProtectId === pid }"
                class="w-24 h-24 flex-1 text-center" shadow="hover">
                <div class="flex flex-col items-center">
                  <GameCommonSimpleResourceIconAndName :resource-id="pid" :icon-size="8">
                  </GameCommonSimpleResourceIconAndName>
                  <span v-if="inventory[pid]?.count" class="text-green-600 text-xs">x{{ inventory[pid]?.count }}</span>
                  <span v-else class="text-red-400 text-xs">无库存</span>
                </div>
              </el-card>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>

    <div>
      <div class="flex h-8">
        <el-text class="mx-1 w-24">保护起始等级: </el-text>
        <el-input-number v-model="startProtectedWhen" class="mr-2 w-[200px]!" :controls="false" :min="0" :max="10"
          :step="1" step-strictly>
        </el-input-number>
      </div>
    </div>

    <div v-if="selectedItem">
      <div class="flex h-8">
        <el-text class="mx-1 w-24">目标:</el-text>
        <el-popover placement="bottom" width="340" trigger="click" ref="popoverRef2">
          <template #reference>
            <el-button type="primary" class="w-[200px]" plain>
              <span v-if="enhanceTarget">
                <GameCommonSimpleResourceIconAndName :resource-id="enhanceTarget"></GameCommonSimpleResourceIconAndName>
              </span>
              <span v-else>选择</span>
            </el-button>
          </template>
          <div class="flex flex-row flex-wrap p-1 pb-8 gap-x-4 gap-y-8 overflow-y-auto">
            <div
              class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
              @click="selectEnhanceTarget('')">
              <div class="w-full h-full flex flex-col items-center justify-center">
                <span class="text-2xl text-gray-400">🚫</span>
                <div
                  class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                  无
                </div>
              </div>
            </div>
            <template v-for="itemId in selectedItemCanEnhanceToItems" :key="itemId">
              <div
                class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                @click="selectEnhanceTarget(itemId)">
                <div class="relative w-full h-full flex items-center justify-center">
                  <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="itemId"
                    :icon-size="8" :show-extra-text="true" :hide-name="true">
                  </GameCommonSimpleResourceIconAndName>
                </div>
                <div
                  class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                  {{
                  // @ts-ignore
                  allGameResource[itemId].name
                  }}
                </div>
              </div>
            </template>
          </div>
        </el-popover>
      </div>
    </div>

    <div>
      <div class="flex h-8">
        <el-text class="mx-1 w-24">重复:</el-text>
        <el-input-number v-model="enhanceRepeatTimes" class="mr-2 w-[200px]!" :controls="false" :min="0" :max="1000000"
          :step="1" step-strictly
          :placeholder="selectedItemCount ? `${selectedItem!.name} 数量：` + selectedItemCount : '请选择装备'">
          <template #suffix>
            <template v-if="selectedItemCount">
              <span class="text-xs text-gray-500">次</span>
            </template>
          </template>
        </el-input-number>
      </div>
    </div>

    <el-divider class="my-2!"></el-divider>
    <!-- 强化概率与按钮 -->

    <div class="flex flex-col md:flex-row items-center gap-2">
      <div class="flex flex-row">
        <span class="text-gray-700 dark:text-gray-300 text-md">成功率：</span>
        <span class="font-bold text-green-600 text-base mr-4 flex flex-row items-center gap-1">
          {{ selectedItem && enhanceInfo ? enhanceSuccessPercent + '%' : '--' }}
          <el-popover :show-after="180" width="200px">
              <template #reference>
                <el-icon class="cursor-pointer text-gray-400!">
                  <Icon name="material-symbols:help"></Icon>
                </el-icon>
              </template>
              <div class="flex flex-col gap-2">
                <div v-if="baseEnhanceSuccessPercent">基础成功率：{{ (baseEnhanceSuccessPercent) }}% </div>
                <div v-if="enhanceSuccessPercentFromEnhanceLevel">强化等级加成：+{{ enhanceSuccessPercentFromEnhanceLevel }}% </div>
                <div v-if="enhanceSuccessPercentFromExperts">专家加成：+{{ enhanceSuccessPercentFromExperts }}% </div>
                <div v-if="enhanceSuccessPercentFromLuck">幸运值加成：+{{ enhanceSuccessPercentFromLuck }}% </div>
                <div v-if="enhanceSuccessPercentFromTitle">称号加成：+{{ enhanceSuccessPercentFromTitle }}% </div>
              </div>
          </el-popover>
        </span>
      </div>

      <el-button type="primary" :disabled="!selectedItemId || !canEnhance" @click="handleEnhance" class="flex-1 w-full">
        <span>强化</span>
      </el-button>
    </div>
  </div>

  <div v-if="inited && currentAutoEnhance && record">
    <div class="mb-2 flex justify-between">
      <span> 正在强化中... </span>
      <el-button size="small" type="warning" plain @click="handleStopEnhance">终止</el-button>
    </div>

    <GameEnhanceHistoryRecord :record="record" />

<!-- 
    <div class="text-xs text-gray-600 dark:text-gray-400 mb-6 space-y-2">
      <div v-if="record.targetResourceId">
        <span> 目标： </span>
        <GameCommonResourceIconAndName :resource-id="record.targetResourceId"> </GameCommonResourceIconAndName>
      </div>
      <div v-if="record.targetRepeatCount"> 目标强化次数：{{ record.targetRepeatCount }} </div>
    </div>

    <div class="text-xs text-gray-500 flex gap-4">
      <span> 共强化：{{ record.repeatCount }} 次</span>
      <span> 开始时间：{{ formatTimeToStr(record.startAt) }} </span>
      <span v-if="record.endAt">结束时间：{{ formatTimeToStr(record.endAt) }}</span>
    </div>
    <div class="flex items-center gap-2 mt-2">
      <span class="text-xs text-gray-600 dark:text-gray-400 w-16"> 共获得： </span>
      <div class="flex gap-2 flex-wrap">
        <template v-for="(count, id) in currentEnhanceTotalGetResource" :key="id">
          <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
          </GameCommonResourceIconAndName>
        </template>
      </div>
    </div>
    <div class="text-xs flex items-center gap-2 mt-6 md:mt-4 pb-4 border-b border-gray-200 dark:border-gray-600">
      <span class="text-xs text-gray-600 dark:text-gray-400 w-18"> 共消耗： </span>
      <div class="flex gap-2 flex-wrap">
        <template v-for="(count, id) in currentEnhanceTotalUsedResource" :key="id">
          <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
          </GameCommonResourceIconAndName>
        </template>
      </div>
    </div>
    <div class="flex flex-col gap-2 max-h-128 overflow-y-auto dark:border-gray-600 pt-4">

      <div class="flex flex-col gap-1">
        <template v-for="(res, i) in record.eachResult.toReversed()" :key="i">
          <template v-if="res.result == 'restart'">
            <div
              class="relative flex flex-col md:flex-row items-center gap-2 text-sm  border-b border-gray-200 dark:border-gray-600 py-4">
              <span class="relative text-gray-600 dark:text-gray-400 text-xs md:mb-0 mr-0 md:mr-3">
                第 {{ record.eachResult.length - i }} 次:
                <span class="inline-block w-12">强化</span>
                <div class="inline-flex flex-row items-center text-md ml-4 gap-4">
                  <span>{{ res.reason }}</span>
                  <GameCommonResourceIconAndName :resource-id="res.currentItemId" />
                </div>
              </span>
            </div>

          </template>
          <template v-else-if="res.result !== 'error'">

            <div
              class="relative flex flex-col md:flex-row items-start gap-2 text-sm  border-b border-gray-200 dark:border-gray-600 py-4">
              <span class="relative text-gray-600 dark:text-gray-400 text-xs top-1.5 mb-2 md:mb-0 mr-0 md:mr-3">
                第 {{ record.eachResult.length - i }} 次:
                <span :class="{
                  'text-green-600': res.result === 'success',
                  'text-red-600': res.result === 'failed',
                }">
                  强化{{ getRecordResultText(res) }}
                </span>
              </span>

              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs w-10 text-gray-600 dark:text-gray-400"> 获得： </span>
                  <div class="flex-1">
                    <GameCommonResourceIconAndName :resource-id="res.increaseItemId">
                    </GameCommonResourceIconAndName>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-3 md:mt-0">
                  <span class="text-xs w-10 text-gray-600 dark:text-gray-400"> 消耗： </span>
                  <div class="flex-1 flex flex-wrap gap-2">
                    <template v-for="(count, id) in res.decreaseItemId" :key="id">
                      <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
                      </GameCommonResourceIconAndName>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex gap-4 items-center py-4">
              <el-tag type="info" class="mt-1">
                {{ getRecordResultText(res) }}
              </el-tag>
              <span>{{ res.reason }}</span>
            </div>
          </template>
        </template>
      </div>
    </div> -->

  </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import allGameResource from "@/assets/resource/allGameResource.json"
import { formatNumber, formatTimeToStr, ObjectKeys } from "~/shared/utils"
import { useInventory } from "~/composables/game/useInventory"
import { emitEnhanceRequire, onEnhanceResult, onEnhanceError, emitAutoEnhanceRequire, onAutoEnhanceCreateSuccess, onAutoEnhanceCreateError, emitGetCurrentAutoEnhance, onGetCurrentAutoEnhanceSuccess, emitStopAutoEnhanceRequire, onStopAutoEnhanceError, onStopAutoEnhanceSuccess, } from "~/api/game/socket/enhance"
import { GameResourceCategory, type AllGameResourceID, type GameResource, type GameResourceEnhanceInfo } from "~/shared/types/gameResource"
import { ArrowDown, Loading } from "@element-plus/icons-vue"
import { GameCommonSimpleResourceIconAndName } from "#components"
import { useCharacterStatusInfo } from "~/composables/game/useCharacterStatusInfo"
import { ENHANCE_PERCENT_MODIFY_PER_LEVEL, EXTRA_ENHANCE_PERCENT_PER_LUCK } from "~/shared/data/constant"
import { useTavern, useWorkingTavern } from "~/composables/game/useTavern"
import type { ElPopover } from "element-plus"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { en } from "element-plus/es/locale/index.mjs"
import type { FuncAction } from "~/shared/types"
import type { AutoEnhanceRequestResult, AutoEnhanceResult } from "~/shared/types/enhance"
import type { ItemCountInfo } from "~/shared/types/gameInventory"
import { allTitles, type GameTitle } from "~/shared/data/allTitle"
import { usePlayerProfile } from "~/composables/game/usePlayerProfile"

const inventory = useInventory()
const characterStatus = useCharacterStatusInfo()
const popoverRef2 = ref()

const profile = usePlayerProfile()

const currentAutoEnhance = ref<AutoEnhanceRequestResult | null>(null)
const record = computed(() => {
  return currentAutoEnhance.value || null
})

const props = defineProps<{
    initSelectResourceId?: AllGameResourceID; // Replace with actual type if available
}>();

const selectedItemCanEnhanceToItems = computed<AllGameResourceID[]>(() => {
  if (!selectedItemId.value) return [];
  const result: AllGameResourceID[] = [];
  let currentId = selectedItemId.value;
  // @ts-ignore
  while (enhanceInfoJson[currentId]?.enhanceSuccessTo) {
    // @ts-ignore
    const nextId = enhanceInfoJson[currentId].enhanceSuccessTo;
    result.push(nextId);
    currentId = nextId;
  }
  return result;
})

const selectedItemCount = computed(() => {
  if (!selectedItemId.value) return 0
  return inventory.value[selectedItemId.value]?.count || 0
})

const selectedItemId = ref<string | null>(null)
// @ts-ignore
const selectedItem = computed(() => selectedItemId.value ? allGameResource[selectedItemId.value] as GameResource : null)
// @ts-ignore
const enhanceInfo = computed(() => selectedItemId.value ? enhanceInfoJson[selectedItemId.value] as GameResourceEnhanceInfo : null)

const enhanceTarget= ref<AllGameResourceID>('')
const enhanceRepeatTimes = ref()
const startProtectedWhen = ref(0)

// 保护装备相关
const selectedProtectId = ref<string | null>(null)
const selectedProtectItem = computed(() =>
  // @ts-ignore
  selectedProtectId.value ? allGameResource[selectedProtectId.value] : null
)

const baseEnhanceSuccessPercent = computed(() => {
  if (!enhanceInfo?.value) return 0
  // 基础成功率 + 强化等级加成
  let res = enhanceInfo.value.enhanceBasePercent;
  return +(res * 100).toFixed(2)
})

const enhanceSuccessPercentFromEnhanceLevel = computed(() => {
  if (!enhanceInfo?.value) return 0
  // 基础成功率 + 强化等级加成
  let res = (characterStatus.value.enhance.final ?? characterStatus.value.enhance.level) * ENHANCE_PERCENT_MODIFY_PER_LEVEL;
  return +(res * 100).toFixed(2)
})

const enhanceSuccessPercentFromLuck = computed(() => {
  if (!enhanceInfo?.value) return 0
  let luck = characterStatus.value.luck?.final ?? 1

  let extraPercentFromLuck = +(luck - 1) * EXTRA_ENHANCE_PERCENT_PER_LUCK;

  if (extraPercentFromLuck <= 0) {
    extraPercentFromLuck = 0;
  }
  return +(extraPercentFromLuck * 100).toFixed(2)
}) 

const enhanceSuccessPercentFromExperts = computed(() => {
  const experts = useWorkingTavern()
  if (experts.some(expert => expert.type === "enhanceExpert")) {
    // 强化专家猫猫提升20%成功率
    let res = (baseEnhanceSuccessPercent.value + enhanceSuccessPercentFromEnhanceLevel.value) * 0.2

    return +res.toFixed(2)
  }

  return 0
})

const enhanceSuccessPercentFromTitle = computed(() => {
  if (!profile.value.title) return 0;

  const titleConf = allTitles[profile.value.title] as GameTitle;

  if (titleConf.enhanceExtraSuccessPercent) {
    return +(titleConf.enhanceExtraSuccessPercent * 100).toFixed(2);
  }

  return 0;
})

const enhanceSuccessPercent = computed(() => {
  if (!enhanceInfo?.value) return '--'

  let totalPercent = baseEnhanceSuccessPercent.value
    + enhanceSuccessPercentFromEnhanceLevel.value
    + enhanceSuccessPercentFromLuck.value
    + enhanceSuccessPercentFromExperts.value
    + enhanceSuccessPercentFromTitle.value;

  return +(totalPercent).toFixed(2)
})

function onDialogSelect(payload: { id: string | null }) {
  if (payload && payload.id) selectEquip(payload.id)
}
function selectEquip(id: string) {
  selectedItemId.value = id
  selectedProtectId.value = null // 切换装备时重置保护装备
  enhanceTarget.value = '' // 切换装备时清空目标
}
function selectEnhanceTarget(id: string) {
  enhanceTarget.value = id

  popoverRef2.value?.hide()
}
function selectProtect(id: string | null) {
  selectedProtectId.value = id
}

// 处理保护装备下拉菜单的选择（兼容el-dropdown的command机制）
function onProtectDropdownCommand(id: string | null) {
  selectProtect(id)
}

const canEnhance = computed(() => {
  if (!enhanceInfo.value) return false
  // 检查材料
  if (Array.isArray(enhanceInfo.value.enhanceRequireResource)) {
    for (const req of enhanceInfo.value.enhanceRequireResource) {
      const inventoryCount = inventory.value[req.resourceId]?.count || 0
      if (!inventory.value[req.resourceId] || inventoryCount < req.count) {
        return false
      }

      if (req.resourceId == selectedItemId.value) {
        // 主装备已经检查过了，这里要额外减去1
        if (inventoryCount - 1 < req.count) {
          return false
        }
      }
    }
  }
  // 检查主装备
  if (!selectedItemId.value || !inventory.value[selectedItemId.value] || inventory.value[selectedItemId.value]!.count < 1) {
    return false
  }
  // 检查保护装备（如果选择了）
  if (
    selectedProtectId.value &&
    (!inventory.value[selectedProtectId.value] || inventory.value[selectedProtectId.value]!.count < 1)
  ) {
    return false
  }
  return true
})

const getEnhanceRequiredResourceColor = function(req: { resourceId: AllGameResourceID; count: number }) {
  if (getEnhanceRequiredResourceCount(req) < req.count) {
    return 'danger'
  }

  return undefined
}

const getEnhanceRequiredResourceCount = function(req: { resourceId: AllGameResourceID; count: number }) {
  if (req.resourceId === selectedItemId.value) {
    return inventory.value[req.resourceId]?.count ? inventory.value[req.resourceId]!.count - 1 : 0
  }
  return inventory.value[req.resourceId]?.count ?? 0
}

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction

const inited = ref(false)
const sended = ref(false)

onMounted(async () => {
  await waitUtilConnected()

  if (props.initSelectResourceId) {
    selectEquip(props.initSelectResourceId)
  }
  
  off1 = onAutoEnhanceCreateSuccess((res) => {
    ElMessage({
      message: "自动强化任务创建成功",
      type: "success",
    })

    sended.value = true;
  })
  off2 = onAutoEnhanceCreateError((err) => {
    ElNotification({
      title: "自动强化失败",
      message: err.msg,
      type: "error",
    })
  })

  off3 = onGetCurrentAutoEnhanceSuccess(data => {
    currentAutoEnhance.value = data.res

    inited.value = true;
    sended.value = false;
  })

  off4 = onStopAutoEnhanceError((err) => {
    ElMessageBox.alert(err.msg, "终止强化失败", {
      type: "error",
    })
  })
  off5 = onStopAutoEnhanceSuccess(() => {
    ElMessage({
      message: "当前强化任务已终止",
      type: "success",
    })
    currentAutoEnhance.value = null
    sended.value = false;
  })

  emitGetCurrentAutoEnhance()
})

onUnmounted(() => {
  off1?.();
  off2?.();
  off3?.();

  popoverRef2.value = null
})

const currentEnhanceTotalUsedResource = computed(() => {
  if (!currentAutoEnhance.value) return {}

  const totalUsed: ItemCountInfo = {};
  currentAutoEnhance.value.eachResult.forEach(result => {
    if (result.result === 'success' || result.result === 'failed') {
      Object.entries(result.decreaseItemId).forEach(([id, info]) => {
        if (!totalUsed[id]) totalUsed[id] = { count: 0 };
        totalUsed[id].count += (info?.count ?? 0);
      });
    }
  });
  return totalUsed;
})

const currentEnhanceTotalGetResource = computed(() => {
  const totalUsed: ItemCountInfo = {};
  currentAutoEnhance.value?.eachResult.forEach(result => {
    if (result.result === 'success' || result.result === 'failed') {
      let id = result.increaseItemId
      if (!totalUsed[id]) totalUsed[id] = { count: 0 };
      totalUsed[id].count += 1
    }
  });
  return totalUsed;
});

const getRecordResultText = (record: AutoEnhanceResult) => {
  if (record.result === 'success') {
    return `成功`;
  } else if (record.result === 'failed') {
    return `失败`;
  } else {
    return `错误`;
  }
}

async function handleEnhance() {
  if (!selectedItem.value || !enhanceInfo.value || !canEnhance.value) return

  emitAutoEnhanceRequire({
    resourceId: selectedItemId.value as AllGameResourceID,
    protectedResourceId: selectedProtectId.value || undefined,
    repeatCount: enhanceRepeatTimes.value ?? 9999999,
    stopWhenGetResource: enhanceTarget.value || undefined,
    startProtectedWhen: startProtectedWhen.value,
  })
}
async function handleStopEnhance() {
  if (!currentAutoEnhance.value) return

  ElMessageBox.confirm("确定要终止当前强化任务吗？", "终止强化", {
    confirmButtonText: "终止",
    cancelButtonText: "取消",
    type: "warning",
  }).then(() => {
    emitStopAutoEnhanceRequire(currentAutoEnhance.value!.uuid);
  }).catch(() => {
    // 用户取消操作
  })
}

const protectableIds = computed(() => {
  // 排除主装备
  if (!enhanceInfo.value || !Array.isArray(enhanceInfo.value.enhanceProtecteResourceIds)) return []
  return enhanceInfo.value.enhanceProtecteResourceIds.filter(pid => pid !== selectedItemId.value)
})

</script>

<style scoped>
.enhance-flash-enter-active,
.enhance-flash-leave-active {
  transition: opacity 0.5s;
}

.enhance-flash-enter-from,
.enhance-flash-leave-to {
  opacity: 0;
}

/* 让下拉卡片更宽一些，适合卡片布局 */
.protect-dropdown-popper {
  min-width: 260px !important;
  max-width: 360px !important;
}
</style>