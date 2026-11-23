<template>
  <el-button size="small" class="mt-2 w-full mx-0!" @click="openDialog" :disabled="!!battleInfo">配置</el-button>

  <el-dialog v-model="showDialog" title="交织" :width="isMobile ? 'auto' : '520px'" append-to-body>

    <div class="space-y-4">
      <!-- 物理伤害区块 -->
      <div>
        <div class="text-sm font-medium mb-2">物理伤害</div>
        <el-checkbox-group v-model="selected" :max="maxSelectCount" class="grid grid-cols-2 md:grid-cols-3">
          <template v-for="s in physicalSkills" :key="s.id">
            <el-checkbox :label="s.id" :disabled="isDisabledOption(s.id as AllBattleSkillId)" class="w-full">
              <div class="flex items-center gap-3">
                <GameCommonBattleSkillName :skill-id="s.id" />
                <span v-if="selected.includes(s.id as AllBattleSkillId)" class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-gray-200 rounded-full text-gray-700">
                  {{ selected.indexOf(s.id as AllBattleSkillId) + 1 }}
                </span>
              </div>
            </el-checkbox>
          </template>
        </el-checkbox-group>
      </div>

      <!-- 魔法伤害区块 -->
      <div>
        <div class="text-sm font-medium mb-2">魔法伤害</div>
        <el-checkbox-group v-model="selected" :max="maxSelectCount" class="grid grid-cols-2 md:grid-cols-3">
          <template v-for="s in magicalSkills" :key="s.id">
            <el-checkbox :label="s.id" :disabled="isDisabledOption(s.id as AllBattleSkillId)" class="w-full">
              <div class="flex items-center gap-3">
                <GameCommonBattleSkillName :skill-id="s.id" />
                <span v-if="selected.includes(s.id as AllBattleSkillId)" class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-gray-200 rounded-full text-gray-700">
                  {{ selected.indexOf(s.id as AllBattleSkillId) + 1 }}
                </span>
              </div>
            </el-checkbox>
          </template>
        </el-checkbox-group>
      </div>

      <!-- 无伤害区块 -->
      <div>
        <div class="text-sm font-medium mb-2">无伤害</div>
        <el-checkbox-group v-model="selected" :max="maxSelectCount" class="grid grid-cols-2 md:grid-cols-3">
          <template v-for="s in noDamageSkills" :key="s.id">
            <el-checkbox :label="s.id" :disabled="isDisabledOption(s.id as AllBattleSkillId)" class="w-full">
              <div class="flex items-center gap-3">
                <GameCommonBattleSkillName :skill-id="s.id" />
                <span v-if="selected.includes(s.id as AllBattleSkillId)" class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-gray-200 rounded-full text-gray-700">
                  {{ selected.indexOf(s.id as AllBattleSkillId) + 1 }}
                </span>
              </div>
            </el-checkbox>
          </template>
        </el-checkbox-group>
      </div>

      <div class="text-xs text-gray-500">
        已选：{{ selected.length }} / {{ maxSelectCount }}（最多可从三个区块总共选择两个技能）
      </div>

      <div v-if="selected.length > 0" class="mt-2 text-sm">
        <div class="font-medium">选择顺序：</div>
        <div class="flex flex-wrap gap-2 mt-1">
          <template v-for="(id, idx) in selected" :key="id">
            <div class="px-2 py-1 bg-gray-100 rounded-md text-sm">
              <span class="font-semibold mr-1">{{ idx + 1 }}.</span>
              <span>{{ allGameBattleSkills[id]?.name || id }}</span>
            </div>
          </template>
        </div>
      </div>

      <el-divider class="my-2!"></el-divider>

      <div class="text-[12px] text-gray-400 dark:text-gray-600">
        - 你必须选择两个技能 <br/>
        - 在每个单位行动后，你将依次释放你选择的技能 <br/>
        - 你不能选择“普通攻击”
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
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills';
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { type AllBattleSkillId, type GameBattleSkill, type GameCharacterBattleSkillInfo } from '~/shared/types/skill';
import { allGameBattleSkills } from '~/shared/data/allGameBattleSkill';
import type { FuncAction } from '~/shared/types';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { emitGetIntertwinedCatEyeGenesisEssenceStaffSkill, emitUpdateIntertwinedCatEyeGenesisEssenceStaffSkill, onGetIntertwinedCatEyeGenesisEssenceStaffSkillError, onGetIntertwinedCatEyeGenesisEssenceStaffSkillSuccess, onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillError, onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillSuccess } from '~/api/game/socket/skill/diySkill';

const { isMobile } = useDevice()

const props = defineProps<{
    skill: GameCharacterBattleSkillInfo
}>()

const battleInfo = useBattleInfo()
const skillsState = useCharacterBattleSkills() // reactive array in pinia-like useState

const showDialog = ref(false)

// 最大可组合数：固定为2（跨三个区块总和最多两个）
const maxSelectCount = computed(() => 2)

/**
 * selected holds skillId strings user picked to combine with this skill.
 * Initialize from existing combo if present in skill object (loose handling).
 */
const selected = ref<AllBattleSkillId[]>([])

// 三个区块的技能列表：物理、魔法、无伤害
const allSkills = computed(() => Object.values(allGameBattleSkills) as GameBattleSkill[])
// 玩家已学习且启用的技能集合（按 skillId）
const characterBattleSkills = useCharacterBattleSkills();

const baseFilter = (s: GameBattleSkill) => {
  // 保留已选以便能取消选择；排除当前技能本身；排除未启用
  const skillId = s.id as AllBattleSkillId 
  const keepSelected = selected.value.includes(skillId)
  const notSelf = skillId !== props.skill.skillId && skillId !== 'intertwinedCatEyeGenesisEssenceStaffSkill'
  const learnedEnabled = characterBattleSkills.value.find(cs => cs.skillId === skillId && cs.enabled);
  return (keepSelected || (notSelf && learnedEnabled)) && !s.passive
}

// 普通攻击识别与排除（兼容可能的标识方式）
const isNormalAttack = (s: any) => {
  const id = s?.id || s?.skillId
  const name = s?.name?.toLowerCase?.()
  const types = s?.skillType || []
  if (id === 'normalAttack' || id === 'basicAttack') return true
  if (name && (name.includes('普通攻击') || name.includes('normal') && name.includes('attack'))) return true
  if (Array.isArray(types) && types.includes('NormalAttack' as any)) return true
  return false
}

const physicalSkills = computed(() => {
  return allSkills.value
    .filter(baseFilter)
    .filter(s => Array.isArray(s.damageType) ? s.damageType.includes('physical' as any) : s.damageType === 'physical')
    .filter(s => !isNormalAttack(s))
    .sort((a: any, b: any) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999))
})

const magicalSkills = computed(() => {
  return allSkills.value
    .filter(baseFilter)
    .filter(s => Array.isArray(s.damageType) ? s.damageType.includes('magical' as any) : s.damageType === 'magical')
    .sort((a: any, b: any) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999))
})

const noDamageSkills = computed(() => {
  return allSkills.value
    .filter(baseFilter)
    .filter(s => Array.isArray(s.damageType) ? s.damageType.includes('no_damage' as any) : s.damageType === 'no_damage')
    .sort((a: any, b: any) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999))
})

// disable option when selecting it would exceed limit (总数限制)
const isDisabledOption = (id: AllBattleSkillId) => {
  // if already selected, it's not disabled (so you can uncheck)
  if (selected.value.includes(id)) return false
  // otherwise disable when at limit
  return selected.value.length >= maxSelectCount.value
}

const canSave = computed(() => {
  return selected.value.length >= 1 && selected.value.length <= maxSelectCount.value
})

const openDialog = () => {
  // init selected from stored combo if present
  const stored = (props.skill as any)?.combo
  if (Array.isArray(stored)) {
    // only accept valid ids and clamp to maxCombines
    const valid = stored.filter((id: string) => id && id !== props.skill.skillId)
    selected.value = valid.slice(0, maxSelectCount.value)
  } else {
    selected.value = []
  }
  showDialog.value = true

  // 拉取已配置的“交织”组合
  emitGetIntertwinedCatEyeGenesisEssenceStaffSkill();
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

  // 更新“交织”组合到后端
  emitUpdateIntertwinedCatEyeGenesisEssenceStaffSkill(selected.value);
}

// keep selection length within allowed when maxCombines changes
watch(maxSelectCount, (v) => {
  if (selected.value.length > v) {
    selected.value = selected.value.slice(0, v)
  }
})

let offGetOk: FuncAction
let offGetFail: FuncAction
let offUpdateOk: FuncAction
let offUpdateFail: FuncAction
onMounted(async () => {
    await waitUtilConnected();
  offGetOk = onGetIntertwinedCatEyeGenesisEssenceStaffSkillSuccess(data => {
    selected.value = (data.skills || []).filter(id => id && id !== props.skill.skillId && id !== 'intertwinedCatEyeGenesisEssenceStaffSkill').slice(0, maxSelectCount.value) as AllBattleSkillId[]
  })
  offGetFail = onGetIntertwinedCatEyeGenesisEssenceStaffSkillError(data => {
    ElNotification.error({ title: '获取“交织”技能失败', message: data.message });
  })

  offUpdateOk = onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillSuccess(() => {
    ElNotification.success({ title: '更新成功' });
    showDialog.value = false;
  })
  offUpdateFail = onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillError(data => {
    ElNotification.error({ title: '更新失败', message: data.message });
  })
})
onUnmounted(async () => {
  offGetOk?.();
  offGetFail?.();
  offUpdateOk?.();
  offUpdateFail?.();
})
</script>