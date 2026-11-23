<template>
  <div class="w-full flex flex-col gap-4">
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
        <div class="flex flex-col md:flex-row items-start md:items-center mt-1">
          <div v-if="enhanceToResourceId">
            <span class="text-gray-600 dark:text-gray-300">强化至：</span>
            <GameCommonResourceIconAndName :resource-id="enhanceToResourceId"></GameCommonResourceIconAndName>
          </div>
          <div v-else-if="selectedItem && !enhanceToResourceId">
            已强化至最高等级
          </div>
        </div>
      </div>

      <Comp :only-enhanceable="true" :categoryGroups="[GameResourceCategory.Equipment, 'workEquipment', 'battleEquipment']" @select="onDialogSelect" title="选择强化装备">
        <template #trigger>
          <el-button type="primary" plain>
            <span v-if="selectedItem">更换</span>
            <span v-else>选择</span>
          </el-button>
        </template>
      </Comp>
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

    <el-divider class="my-2!"></el-divider>
    <!-- 强化概率与按钮 -->

    <el-alert v-if="resultMsg" :title="resultMsg" :type="resultType" show-icon class="mt-2" @close="resultMsg = ''" />

    <div class="flex flex-col md:flex-row items-center gap-2">
      <div>
        <span class="text-gray-700 dark:text-gray-300 text-md">经验：</span>
        <span class="text-green-600 text-base mr-4"> +{{ enhanceRewardExp }} </span>
      </div>
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

      <el-button type="primary" :disabled="!selectedItemId || isEnhancing || !canEnhance" @click="handleEnhance"
        class="flex-1 w-full">
        <span v-if="!isEnhancing">强化</span>
        <span v-else>
          <el-icon>
            <loading />
          </el-icon> 强化中...
        </span>
      </el-button>
    </div>

    <transition name="enhance-flash">
      <div v-if="showFlash" class="text-center text-2xl font-bold text-yellow-400 animate-bounce mt-2">
        ✨强化中✨
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import allGameResource from "@/assets/resource/allGameResource.json"
import { formatNumber, ObjectKeys } from "~/shared/utils"
import { useInventory } from "~/composables/game/useInventory"
import { emitEnhanceRequire, onEnhanceResult, onEnhanceError } from "~/api/game/socket/enhance"
import { GameResourceCategory, type AllGameResourceID, type GameResource, type GameResourceEnhanceInfo } from "~/shared/types/gameResource"
import { ArrowDown, Loading } from "@element-plus/icons-vue"
import { GameCommonSimpleResourceIconAndName } from "#components"
import Comp from "../Inventory/Selector.vue"
import { useCharacterStatusInfo } from "~/composables/game/useCharacterStatusInfo"
import { ENHANCE_PERCENT_MODIFY_PER_LEVEL, EXTRA_ENHANCE_PERCENT_PER_LUCK } from "~/shared/data/constant"
import { useTavern, useWorkingTavern } from "~/composables/game/useTavern"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { emitRequestInventory } from "~/api/game/socket/inventory"
import { usePlayerProfile } from "~/composables/game/usePlayerProfile"
import { allTitles, type GameTitle } from "~/shared/data/allTitle"

const inventory = useInventory()
const characterStatus = useCharacterStatusInfo()

const profile = usePlayerProfile()

const props = defineProps<{
    initSelectResourceId?: AllGameResourceID; // Replace with actual type if available
}>();

const selectedItemId = ref<string | null>(null)
// @ts-ignore
const selectedItem = computed(() => selectedItemId.value ? allGameResource[selectedItemId.value] as GameResource : null)
// @ts-ignore
const enhanceInfo = computed(() => selectedItemId.value ? enhanceInfoJson[selectedItemId.value] as GameResourceEnhanceInfo : null)

// 保护装备相关
const selectedProtectId = ref<string | null>(null)
const selectedProtectItem = computed(() =>
  // @ts-ignore
  selectedProtectId.value ? allGameResource[selectedProtectId.value] : null
)

const enhanceRewardExp = computed(() => {
  if (!enhanceInfo.value) return 0
  // 每次强化都会获得经验
  return enhanceInfo.value.rewardEnhanceExp || 0
})

const enhanceToResourceId = computed(() => {
  // @ts-ignore
  return selectedItem.value ? enhanceInfoJson?.[selectedItem.value.id]?.enhanceSuccessTo : null
})

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

function selectEquip(id: string) {
  selectedItemId.value = id
  resultMsg.value = ""
  selectedProtectId.value = null // 切换装备时重置保护装备
}

function onDialogSelect(payload: { id: string | null }) {
  if (payload && payload.id) selectEquip(payload.id)
}
function selectProtect(id: string | null) {
  selectedProtectId.value = id
}
// 处理保护装备下拉菜单的选择（兼容el-dropdown的command机制）
function onProtectDropdownCommand(id: string | null) {
  selectProtect(id)
}

const resultMsg = ref("")
const resultType = ref<"success" | "error" | "info" | "warning">("info")
const isEnhancing = ref(false)
const showFlash = ref(false)

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

let offEnhanceResult: (() => void) | undefined
let offEnhanceError: (() => void) | undefined

onMounted(async () => {
  await waitUtilConnected()

  if (props.initSelectResourceId) {
    selectEquip(props.initSelectResourceId)
  }
  
  offEnhanceResult = onEnhanceResult((res) => {
      isEnhancing.value = false
      showFlash.value = false
      if (res.enhanceResultId) {
        selectedItemId.value = res.enhanceResultId
      }
      selectedProtectId.value = null

      if (res.success) {
        resultMsg.value = res.msg
        resultType.value = "success"
      } else {
        resultMsg.value = res.msg
        resultType.value = "error"
      }
  })
  offEnhanceError = onEnhanceError((err) => {
    selectedItemId.value = null
    selectedProtectId.value = null
    showFlash.value = false
    isEnhancing.value = false
    resultMsg.value = err.msg
    resultType.value = "error"

    emitRequestInventory()
  })
})

onUnmounted(() => {
  offEnhanceResult && offEnhanceResult()
  offEnhanceError && offEnhanceError()
})

async function handleEnhance() {
  if (!selectedItem.value || !enhanceInfo.value || isEnhancing.value || !canEnhance.value) return

  resultMsg.value = ""
  isEnhancing.value = true
  showFlash.value = true

  setTimeout(() => {
    emitEnhanceRequire(selectedItemId.value as AllGameResourceID, selectedProtectId.value || undefined)
  }, 3000)
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