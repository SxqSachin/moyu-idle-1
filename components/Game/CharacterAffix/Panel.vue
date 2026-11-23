<template>
  <!-- 词条总面板：组合 RollPanel + AffixList，保持低耦合 -->
  <div class="flex flex-col gap-4">
    <RollPanel @roll="roll" />

    <div class="flex flex-col md:flex-row items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">已拥有的祝福</h3>
      <div class="flex flex-col md:flex-row items-center gap-3">
        <div class="flex items-center gap-3 flex-col md:flex-row ">
          <div class="flex items-center gap-3">
            <el-tag size="small" type="info" effect="light">启用 {{ activeCount }}/{{ maxActive }}</el-tag>
            <el-popover :width="360" placement="bottom" trigger="click" v-model:visible="activeExpandPopoverVisible">
              <template #default>
                <div class="text-sm">
                  <div class="mb-2 font-medium">扩展启用上限 +1</div>
                  <div class="mb-3 text-xs text-gray-500 ">
                    • 每次操作将把可同时启用的祝福数量增加 1
                    <br />
                    • 每次提升将消耗：
                    <br />
                    <div class="space-y-1 my-1">
                      <div>
                        <template v-for="(count, status) of CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT">
                          <span
                            class="inline-block px-2 py-1 rounded text-sm bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ">
                            <GameCommonStatusIconAndName :status="status" suffix="等级"></GameCommonStatusIconAndName>
                            <span> : {{ count }} </span>
                          </span>
                        </template>
                      </div>
                      <div>
                        <template v-for="requirement of CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT">
                          <div class="mb-1">
                            <GameCommonResourceIconAndName :resource-id="requirement.id" :count="requirement.count"
                              :show-inventory-count="true" />
                          </div>
                        </template>
                      </div>
                    </div>
                    • 扩展上限时，将消耗相当于90级战斗等级的经验
                    • 消耗战斗等级后，当前经验将会保留
                    <br />
                  </div>
                  <div class="flex justify-end">
                    <el-button size="small" @click="activeExpandPopoverVisible = false">取消</el-button>
                    <el-button size="small" type="primary" :loading="expanding"
                      @click="onConfirmExpandActive">确认扩展</el-button>
                  </div>
                </div>
              </template>
              <template #reference>
                <el-button size="small" type="primary" plain @click.stop>
                  扩展启用上限
                </el-button>
              </template>
            </el-popover>
          </div>
          <div class="flex items-center gap-3">
            <el-tag size="small" type="info" effect="light">持有 {{ list.length }}/{{ maxOwned }}</el-tag>
            <el-popover v-if="!selectionMode" :width="320" placement="bottom" trigger="click"
              v-model:visible="expandPopoverVisible" :disabled="ownedExpandDisabled">
              <template #default>
                <div class="text-sm">
                  <div class="mb-2">选择升级方案，并确认消耗，将持有上限从 {{ maxOwned }} 扩展至 {{ maxOwned + 1 }}：</div>
                  <div class="mb-3">
                    <el-radio-group v-model="selectedSchemeId" size="small">
                      <div class="flex flex-col gap-2">
                        <template v-for="s in expansionSchemes" :key="s.id">
                          <label class="flex items-start gap-3 p-2 border rounded cursor-pointer"
                            :class="{ 'bg-gray-50': selectedSchemeId === s.id }">
                            <input type="radio" name="affixScheme" class="mt-1" :value="s.id"
                              v-model="selectedSchemeId" />
                            <div class="flex-1">
                              <div class="flex items-center justify-between">
                                <div class="text-sm font-bold">{{ s.name }}</div>
                                <div class="text-xs text-gray-500">可用: {{ getSchemeRemainingLabel(s.id) }}</div>
                              </div>
                              <div class="text-xs text-gray-400 mt-1">{{ getSchemeShortHint(s.id) }}</div>
                            </div>
                          </label>
                        </template>
                      </div>
                    </el-radio-group>
                  </div>
                  <div class="flex flex-row flex-wrap gap-2 mb-3">
                    <GameCommonItemCountInfoIconAndName :item-count-info="expandOwnedCost" :show-count="true"
                      :show-inventory-count="true" />
                  </div>
                  <div class="flex justify-end gap-2">
                    <el-button size="small" @click="expandPopoverVisible = false">取消</el-button>
                    <el-button size="small" type="primary" :loading="expanding" @click="onConfirmExpand">扩容</el-button>
                  </div>
                </div>
              </template>
              <template #reference>
                <el-button size="small" :disabled="ownedExpandDisabled || expanding" :loading="expanding">
                  扩展持有上限
                </el-button>
              </template>
            </el-popover>
          </div>
        </div>
        <div class="flex items-center gap-3">

          <template v-if="selectionMode">
            <el-popconfirm v-if="selectedIds.length" width="220" :title="`确认删除选中的 ${selectedIds.length} 条？`"
              confirm-button-text="删除" cancel-button-text="取消" confirm-button-type="danger" @confirm="onRemoveMany">
              <template #reference>
                <el-button size="small" type="danger" plain>删除已选 ({{ selectedIds.length }})</el-button>
              </template>
            </el-popconfirm>
            <el-button size="small" @click="onExitSelection">完成</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="danger" plain @click="onEnterSelection" class="ml-0!">批量删除</el-button>
          </template>
          <el-button size="small" @click="fetchList" class="ml-0!">刷新</el-button>
        </div>
      </div>
    </div>

    <AffixList :affixes="list" :selectable="selectionMode" v-model:selected-ids="selectedIds"
      @update:state="(item, s) => updateState(item.id!, s, item.version)" @remove="(item) => remove(item.id!)"
      @reroll="(item) => reroll(item.id!, item.version)" @reroll-up="(item) => rerollUp(item.id!, item.version)"
      @upgrade-rarity="(item) => upgradeRarity(item.id!, item.version)" />
  </div>
</template>

<script setup lang="ts">
import RollPanel from './RollPanel.vue'
import AffixList from './AffixList.vue'
import { useCharacterAffix } from '~/composables/game/useCharacterAffix'
import { computed, ref, onMounted } from 'vue'
import { CHARACTER_AFFIX_OWNED_EXPANSION_MAX, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE, type AffixOwnedExpansionSchemeId, CHARACTER_AFFIX_MAX_OWNED_DEFAULT, getCharacterAffixSchemeLimitMessage, CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT, CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT } from '~/shared/data/characterAffixConstants'
import { getCharacterAffixOwnedExpansionRequirement } from '~/shared/utils/characterAffixOwnedExpansion'
import { ElMessage } from 'element-plus'

const { list, fetchList, roll, updateState, remove, removeMany, reroll, rerollUp, upgradeRarity, maxActive, maxOwned, schemeRemaining, schemeUsage, schemeLimitMessage, expanding, expandOwned, expandActive } = useCharacterAffix()

const activeCount = computed(() => list.value.filter((a) => a.state === 'ACTIVE').length)
const selectedIds = ref<number[]>([])
const selectionMode = ref(false)

const ownedExpandDisabled = computed(() => maxOwned.value >= CHARACTER_AFFIX_OWNED_EXPANSION_MAX)
const expansionSchemes = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES
const selectedSchemeId = ref<AffixOwnedExpansionSchemeId>('schemeA')
const expansionsDone = computed(() => Math.max(0, maxOwned.value - CHARACTER_AFFIX_MAX_OWNED_DEFAULT))
const isSchemeAllowed = (id: string | undefined) => {
  if (!id) return false
  const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id as AffixOwnedExpansionSchemeId]
  // If server provided per-scheme remaining, prefer that
  if (schemeRemaining?.value) {
    const rem = schemeRemaining.value[id as string]
    if (rem === 'infinity') return true
    return (rem ?? 0) > 0
  }
  if (cap === 'infinity') return true
  return expansionsDone.value < (cap as number)
}
function getSchemeCapLabel(id: string | undefined) {
  if (!id) return ''
  const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id as AffixOwnedExpansionSchemeId]
  if (cap === 'infinity') return ''
  return `总共可用 ${cap} 次`;
}
const expandOwnedRequirement = computed(() => {
  const schemeId = selectedSchemeId.value
  const usage = schemeUsage?.value ? (schemeUsage.value[schemeId] ?? 0) : undefined
  return getCharacterAffixOwnedExpansionRequirement(maxOwned.value, schemeId, usage)
})
// 转为 ItemCountInfo 用于现有展示组件
const expandOwnedCost = computed(() => {
  const obj: Record<string, { count: number }> = {}
  for (const r of expandOwnedRequirement.value) obj[r.id] = { count: r.count }
  return obj
})

const expandPopoverVisible = ref(false)
const activeExpandPopoverVisible = ref(false)

function onRemoveMany() {
  if (!selectedIds.value.length) return
  removeMany(selectedIds.value)
  selectedIds.value = []
  selectionMode.value = false
}

function onEnterSelection() {
  selectionMode.value = true
  selectedIds.value = []
}

function onExitSelection() {
  selectionMode.value = false
  selectedIds.value = []
}

function onExpandOwned() {
  if (ownedExpandDisabled.value || expanding.value) return
  expandOwned()
}

function onConfirmExpand() {
  if (ownedExpandDisabled.value || expanding.value) return
  if (!isSchemeAllowed(selectedSchemeId.value)) {
    ElMessage.error('所选方案当前不可用，请选择其他方案或先完成前置扩展')
    return
  }
  expandOwned(selectedSchemeId.value)
  expandPopoverVisible.value = false
}

function onConfirmExpandActive() {
  if (expanding.value) return
  // close popover first, then call composable action; server will handle business validation
  activeExpandPopoverVisible.value = false
  expandActive()
}

// New helpers for UI: show remaining and short hint; allow selection but surface reason in UI
function getSchemeShortHint(id: string | undefined) {
  if (!id) return ''
  const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id as AffixOwnedExpansionSchemeId]
  if (cap === 'infinity') return '无限使用'
  // prefer server-provided remaining
    if (schemeRemaining?.value) {
    const rem = schemeRemaining.value[id as string]
    if (rem === 'infinity') return '无限使用'
    if ((rem ?? 0) <= 0) return ((schemeLimitMessage?.value?.[id as string]) ?? (getCharacterAffixSchemeLimitMessage(id as any) || '该方案已超出使用次数限制，选择后会显示不可用原因'))
    return `剩余 ${rem} 次可用`
  }
  if (expansionsDone.value >= (cap as number)) return '该方案已超出使用次数限制，选择后会显示不可用原因'
  return `总共可用 ${cap} 次`
}

function getSchemeRemainingLabel(id: string | undefined) {
  if (!id) return '-'
  const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id as AffixOwnedExpansionSchemeId]
  if (cap === 'infinity') return '∞'
  if (schemeRemaining?.value) {
    const rem = schemeRemaining.value[id as string]
    return String(rem === 'infinity' ? '∞' : Math.max(0, Number(rem ?? 0)))
  }
  const remain = (cap as number) - expansionsDone.value
  return String(Math.max(0, remain))
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
</style>
