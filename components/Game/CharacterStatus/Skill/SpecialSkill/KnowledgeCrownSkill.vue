<template>
  <el-button size="small" class="mt-2 w-full mx-0!" @click="openDialog" :disabled="!!battleInfo">组合</el-button>

  <el-dialog v-model="showDialog" title="集智" :width="isMobile ? 'auto' : '520px'" append-to-body>

    <div class="space-y-4">

      <div class="text-sm text-gray-600">
        可组合技能数量：{{ maxCombines }}（请选择 1 - {{ maxCombines }} 个技能）
      </div>

      <div class="space-y-3">
        <el-checkbox-group v-model="selected" :max="maxCombines" class="grid grid-cols-2 md:grid-cols-2">
          <template v-for="s in availableSkills" :key="s.skillId">
            <el-checkbox :label="s.skillId" :disabled="isDisabledOption(s.skillId)" class="w-1/2">
              <div class="flex items-center gap-3">
                <GameCommonBattleSkillName :skill-id="s.skillId" />
                <div class="ml-auto text-xs text-gray-500">等级: {{ s.level }}</div>
              </div>
            </el-checkbox>
          </template>
        </el-checkbox-group>
      </div>

      <div class="text-xs text-gray-500">
        已选：{{ selected.length }} / {{ maxCombines }}
      </div>

      <el-divider class="my-2!"></el-divider>

      <div class="text-[12px] text-gray-400 dark:text-gray-600">
        - “集智”无法融合物理伤害技能 <br/>
        - “集智”无法融合普通攻击<br/>
        - “集智”无法融合“集智”<br/>
        - “集智”不触发“回响铃饰”<br/>
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
import { ref, computed, watch } from 'vue'
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills';
import { DamageType, type AllBattleSkillId, type GameBattleSkill, type GameCharacterBattleSkillInfo } from '~/shared/types/skill';
import { allGameBattleSkills } from '~/shared/data/allGameBattleSkill';
import type { FuncAction } from '~/shared/types';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { emitGetKnowledgeCrownSkills, emitUpdateKnowledgeCrownSSkills, onGetKnowledgeCrownSkillsError, onGetKnowledgeCrownSkillsSuccess, onUpdateKnowledgeCrownSkillsError, onUpdateKnowledgeCrownSkillsSuccess } from '~/api/game/socket/skill/diySkill';
import { onUpdateSkillCastLogicSuccess } from '~/api/game/socket/skills';

const { isMobile } = useDevice()

const props = defineProps<{
    skill: GameCharacterBattleSkillInfo
}>()

const battleInfo = useBattleInfo()
const skillsState = useCharacterBattleSkills() // reactive array in pinia-like useState

const showDialog = ref(false)

// 最大可组合数：根据技能等级决定，至少1，至多5
const maxCombines = computed(() => {
  const lv = Number(props.skill?.level ?? 1)
  if (Number.isNaN(lv)) return 1

  return Math.min(4, Math.max(1, Math.floor(lv)))
})

/**
 * selected holds skillId strings user picked to combine with this skill.
 * Initialize from existing combo if present in skill object (loose handling).
 */
const selected = ref<AllBattleSkillId[]>([])

// available skills: from player's battle skills, exclude the skill itself
const availableSkills = computed(() => {
  let skills = (skillsState.value || [])
    .filter((s: GameCharacterBattleSkillInfo & any) => {
      if (selected.value.includes(s.skillId)) return true; // always include selected ones
      return s.skillId !== props.skill.skillId && s.enabled !== false
    })
    .filter(s => {
      const skillInfo = allGameBattleSkills[s.skillId] as GameBattleSkill;
      // 排除被动技能
      if (skillInfo?.passive) return false;
      let damageType = skillInfo.damageType
      const damageTypeArr = Array.isArray(damageType) ? damageType : [damageType]

      if (damageTypeArr.includes(DamageType.Physical)) {
        return false
      }

      return true;
    })
    .slice()
    .sort((a: any, b: any) => {
      const ao = typeof a.order === 'number' ? a.order : 9999
      const bo = typeof b.order === 'number' ? b.order : 9999
      return ao - bo
    })

    return skills;
})

// disable option when selecting it would exceed limit
const isDisabledOption = (id: AllBattleSkillId) => {
  // if already selected, it's not disabled (so you can uncheck)
  if (selected.value.includes(id)) return false
  // otherwise disable when at limit
  return selected.value.length >= maxCombines.value
}

const canSave = computed(() => {
  return selected.value.length >= 1 && selected.value.length <= maxCombines.value
})

const openDialog = () => {
  // init selected from stored combo if present
  const stored = (props.skill as any)?.combo
  if (Array.isArray(stored)) {
    // only accept valid ids and clamp to maxCombines
    const valid = stored.filter((id: string) => id && id !== props.skill.skillId)
    selected.value = valid.slice(0, maxCombines.value)
  } else {
    selected.value = []
  }
  showDialog.value = true

  emitGetKnowledgeCrownSkills();
}

const save = async () => {
  // persist selection into character battle skill state
  const arr = skillsState.value as any[]
  const idx = arr.findIndex(s => s.skillId === props.skill.skillId)
  if (idx !== -1) {
    // store as 'combo' - loose typed on purpose
    arr[idx] = { ...arr[idx], combo: [...selected.value] }
    // update state (useState reference is reactive, mutate to trigger reactivity)
    skillsState.value = [...arr]
  } else {
    // fallback: try to find by reference in props (unlikely)
    console.warn('cannot find skill in local state to save combo')
  }
  showDialog.value = false

  emitUpdateKnowledgeCrownSSkills(selected.value)
}

// keep selection length within allowed when maxCombines changes
watch(maxCombines, (v) => {
  if (selected.value.length > v) {
    selected.value = selected.value.slice(0, v)
  }
})

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
onMounted(async () => {
    await waitUtilConnected();
    off1 = onGetKnowledgeCrownSkillsSuccess(data => {
        selected.value = data.skills;
    })
    off2 = onGetKnowledgeCrownSkillsError(data => {
        ElNotification.error({ title: '获取“集智”技能失败', message: data.message });
    })

    off3 = onUpdateKnowledgeCrownSkillsSuccess(data => {
        ElNotification.success({ title: '更新成功' });
        showDialog.value = false;
    })
    off4 = onUpdateKnowledgeCrownSkillsError(data => {
        ElNotification.error({ title: '更新失败', message: data.message });
        // showDialog.value = false;
    })
})
onUnmounted(async () => {
    off1?.();
    off2?.();
    off3?.();
    off4?.();
})
</script>