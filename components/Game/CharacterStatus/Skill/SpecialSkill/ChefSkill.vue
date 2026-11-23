<template>
  <el-button
    size="small"
    class="mt-2 w-full mx-0!"
    @click="openDialog"
    :disabled="!!battleInfo"
  >组合</el-button>

  <el-dialog
    v-model="showDialog"
    title="爆炒"
    :width="isMobile ? 'auto' : '520px'"
    append-to-body
  >
    <div class="space-y-4">
      <!-- 组一：口味 -->
      <div class="text-sm text-gray-600">
        厨师等级：{{ cheifLevel }}
        <br />
        可组合口味数：{{ maxFlavorCount }}
        (每5级烹饪等级增加1点最大可组合口味数，每4级技能等级增加1点最大可组合口味数)
      </div>

      <div class="space-y-3">
        <div v-for="f in flavors" :key="f.key">
          <span class="flex items-center">
            <span>{{ f.label }} {{ f.emoji }}：</span>
            <el-tooltip placement="top">
              <template #content>
                <div class="space-y-1">
                  <div v-for="(line,i) in f.tips" :key="i">{{ line }}</div>
                </div>
              </template>
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </span>
          <el-slider
            v-model="f.count"
            :min="0"
            :max="flavorMax(f.key)"
            show-input
            :show-input-controls="false"
            :marks="{ 0: '0', [flavorMax(f.key)]: String(flavorMax(f.key)) }"
            @input="v => onFlavorInput(f.key, v)"
          />
        </div>
      </div>

      <div class="text-xs text-gray-500">
        已调配: {{ totalFlavorCount }} / {{ maxFlavorCount }}
      </div>

      <el-divider class="my-2!" />

      <!-- 组二：目标 -->
      <div class="text-sm text-gray-600">
        可选目标数：{{ maxTargetCount }}
        (每12级增加1点最大可选目标数)
      </div>

      <div class="space-y-3">
        <div v-for="t in targets" :key="t.key">
          <span class="flex items-center">
            <span>{{ t.label }}：</span>
          </span>
          <el-slider
            v-model="t.count"
            :min="0"
            :max="targetMax(t.key)"
            show-input
            :show-input-controls="false"
            :marks="{ 0: '0', [targetMax(t.key)]: String(targetMax(t.key)) }"
            @input="v => onTargetInput(t.key, v)"
          />
        </div>
      </div>

      <div class="text-xs text-gray-500">
        已选择: {{ totalTargetCount }} / {{ maxTargetCount }}
      </div>
    </div>

    <template #footer>
      <template v-if="!battleInfo?.battleStatus">
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canSave" @click="save">保存</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useBattleInfo } from '~/composables/game/useBattleInfo'
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo'
import { waitUtilConnected } from '~/api/game/socket/socket'
import {
  emitGetChefSkillCombination,
  emitGetKnowledgeCrownSkills,
  emitUpdateChefSkillCombination,
  emitUpdateKnowledgeCrownSSkills,
  onChefSkillGetFailed,
  onChefSkillGetSuccess,
  onChefSkillUpdateFailed,
  onChefSkillUpdateSuccess,
} from '~/api/game/socket/skill/diySkill'
import type { ChefSkillCombinationInfo, GameCharacterBattleSkillInfo } from '~/shared/types/skill'
import type { FuncReturnVoid } from '~/shared/types'
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills'
// 如果已有组合类型可引入：import type { ChefSkillCombinationPayload } from '~/shared/types/skill'

const { isMobile } = useDevice()

const props = defineProps<{
  skill: GameCharacterBattleSkillInfo
}>()

/* ---------------- Core State ---------------- */
const battleInfo = useBattleInfo()
const characterStatus = useCharacterStatusInfo()
const showDialog = ref(false)

/* 厨师等级 */
const cheifLevel = computed(() => Math.floor(characterStatus.value.cooking.final ?? 1))

/* 口味上限：保证最少 1，最多 5（与原注释语义对齐） */
const maxFlavorCount = computed(() => {
  const raw = Math.floor(cheifLevel.value / 5) + Math.floor(props.skill.level / 4)
  return Math.max(1, raw)
})

/* 目标上限：保持原逻辑（可为 0）。若需最少 1，可包 Math.max(1, ...) */
const maxTargetCount = computed(() => Math.floor(cheifLevel.value / 12))

/* 五种口味数据 */
interface FlavorMeta {
  key: string
  label: string
  emoji: string
  tips: string[]
  count: number
}
const flavors = ref<FlavorMeta[]>([
  {
    key: 'sour',
    label: '酸味',
    emoji: '🍋',
    tips: ['每1份，增加1%造成的伤害，增加1%伤害减免', '持续2回合'],
    count: 0
  },
  {
    key: 'sweet',
    label: '甜味',
    emoji: '🍬',
    tips: ['每1份，恢复受影响目标5%已损失生命'],
    count: 0
  },
  {
    key: 'bitter',
    label: '苦味',
    emoji: '🤢',
    tips: ['每1份，使受到的伤害增加1.5%', '持续1回合'],
    count: 0
  },
  {
    key: 'spicy',
    label: '辣味',
    emoji: '🌶️',
    tips: ['每1份，造成(烹饪等级200%的伤害)'],
    count: 0
  },
  {
    key: 'salty',
    label: '咸味',
    emoji: '🧂',
    tips: ['每1份，使其他效果的数值影响提升10%', '每4份，使其他效果持续回合提升1回合'],
    count: 0
  }
])

/* 目标分配 */
interface TargetMeta {
  key: string
  label: string
  count: number
}
const targets = ref<TargetMeta[]>([
  { key: 'ally', label: '友军数量', count: 0 },
  { key: 'enemy', label: '敌军数量', count: 0 }
])

/* ---------------- Derived ---------------- */
const totalFlavorCount = computed(() =>
  flavors.value.reduce((s, f) => s + f.count, 0)
)
const totalTargetCount = computed(() =>
  targets.value.reduce((s, t) => s + t.count, 0)
)

/* 保存按钮条件：必须>0 且 不超过上限 */
const canSave = computed(() =>
  totalFlavorCount.value > 0 &&
  totalFlavorCount.value <= maxFlavorCount.value &&
  totalTargetCount.value > 0 &&
  totalTargetCount.value <= maxTargetCount.value
)

/* ---------------- Max Calculation ---------------- */
/* 通用：当前项最大值 = 组上限 - (组当前总 - 本项当前值) */
function flavorMax(key: string) {
  const groupMax = maxFlavorCount.value
  const list = flavors.value
  const item = list.find(f => f.key === key)!
  const others = totalFlavorCount.value - item.count
  const m = groupMax - others
  return m < 0 ? 0 : m
}

function targetMax(key: string) {
  const groupMax = maxTargetCount.value
  // 若上限是 0，直接 0
  if (groupMax <= 0) return 0
  const list = targets.value
  const item = list.find(t => t.key === key)!
  const others = totalTargetCount.value - item.count
  const m = groupMax - others
  return m < 0 ? 0 : m
}

/* ---------------- Input Handlers ---------------- */
function normalizeInput(v: number | number[]): number {
  if (Array.isArray(v)) return v[0] || 0
  return v || 0
}

function onFlavorInput(key: string, v: number | number[]) {
  const val = normalizeInput(v)
  const item = flavors.value.find(f => f.key === key)
  if (!item) return
  const mx = flavorMax(key)
  item.count = val > mx ? mx : val
  clampAllFlavors()
}

function onTargetInput(key: string, v: number | number[]) {
  const val = normalizeInput(v)
  const item = targets.value.find(t => t.key === key)
  if (!item) return
  const mx = targetMax(key)
  item.count = val > mx ? mx : val
  clampAllTargets()
}

/* ---------------- Clamp (Fast Correction) ---------------- */
function clampAllFlavors() {
  // 二次校正，防止顺序输入导致短暂溢出
  const groupMax = maxFlavorCount.value
  if (totalFlavorCount.value <= groupMax) return
  // 简单策略：按出现顺序裁减（可改为按最近修改 / 优先级）
  let over = totalFlavorCount.value - groupMax
  for (const f of flavors.value) {
    if (over <= 0) break
    const reducible = Math.min(f.count, over)
    f.count -= reducible
    over -= reducible
  }
}

function clampAllTargets() {
  const groupMax = maxTargetCount.value
  if (groupMax < 0) return
  if (totalTargetCount.value <= groupMax) return
  let over = totalTargetCount.value - groupMax
  for (const t of targets.value) {
    if (over <= 0) break
    const reducible = Math.min(t.count, over)
    t.count -= reducible
    over -= reducible
  }
}

/* 当上限变化时自动收缩（等级变化引起） */
watch(maxFlavorCount, clampAllFlavors)
watch(maxTargetCount, clampAllTargets)

/* ---------------- Dialog Lifecycle ---------------- */
const openDialog = () => {
  // 预留：从技能中恢复已存组合（如果后端有）
  const stored = (props.skill as any)?.combo
  if (Array.isArray(stored)) {
    // TODO: 根据实际结构恢复。当前占位。
  }
  showDialog.value = true
  emitGetKnowledgeCrownSkills()
}

const save = async () => {
  // 序列化
  const payload = {
    flavors: flavors.value.map(f => ({ key: f.key, count: f.count })),
    targets: targets.value.map(t => ({ key: t.key, count: t.count }))
  }
  // 发送（当前后端接口留空，放占位）
  emitUpdateChefSkillCombination(payload as any)
  showDialog.value = false
}

/* ---------------- Socket Hooks (占位保留) ---------------- */
let off1: FuncReturnVoid
let off2: FuncReturnVoid
let off3: FuncReturnVoid
let off4: FuncReturnVoid

onMounted(async () => {
  await waitUtilConnected()

  // 应用服务器返回的组合数据（flavors / targets）
  function applyServerCombination(combo: ChefSkillCombinationInfo) {
    if (!combo || typeof combo !== 'object') return
    const flavorMap: Record<string, number> = {}
    const targetMap: Record<string, number> = {}
    if (Array.isArray(combo.flavors)) {
      for (const f of combo.flavors) {
        if (f && typeof f.key === 'string') {
          const n = Number(f.count)
          if (Number.isFinite(n) && n >= 0) flavorMap[f.key] = n
        }
      }
    }
    if (Array.isArray(combo.targets)) {
      for (const t of combo.targets) {
        if (t && typeof t.key === 'string') {
          const n = Number(t.count)
          if (Number.isFinite(n) && n >= 0) targetMap[t.key] = n
        }
      }
    }
    // 写入口味
    flavors.value.forEach(f => {
      const val = flavorMap[f.key] ?? 0
      const mx = flavorMax(f.key)
      f.count = val > mx ? mx : val
    })
    // 写入目标
    targets.value.forEach(t => {
      const val = targetMap[t.key] ?? 0
      const mx = targetMax(t.key)
      t.count = val > mx ? mx : val
    })
    // 最终二次收敛，防止级联超标
    clampAllFlavors()
    clampAllTargets()
  }

  off1 = onChefSkillGetSuccess(res => {
    applyServerCombination(res.info)
  })
  off2 = onChefSkillGetFailed(data => {
    ElNotification.error({ title: '获取“爆炒”技能失败', message: data.message })
  })

  off3 = onChefSkillUpdateSuccess(() => {
    ElNotification.success({ title: '保存成功' })
  })
  off4 = onChefSkillUpdateFailed(err => {
    ElNotification.error({ title: '保存失败', message: err.message }) 
  })

  emitGetChefSkillCombination();
})

onUnmounted(() => {
  off1?.()
  off2?.()
  off3?.()
  off4?.()
})
</script>