<template>
    <el-card class="skill-card h-full" shadow="hover" body-class="p-2! h-full">
        <div class="flex flex-col items-start justify-between h-full w-26 md:w-full">
            <div class="w-full h-full flex-1">
            <BattleSkillName :skill-id="skill.skillId" :extra="skill.extra" />
            <div class="mt-1 text-xs text-gray-600">等级：<span class="font-bold">{{ skill.level }}</span></div>
            <div class="w-full mt-1">
                <template v-if="skill.skillId != 'baseAttack'">
                    <el-progress :percentage="getExpPercent(skill.level, skill.exp)" :stroke-width="10" color="#67c23a"
                        :show-text="false" />
                    <div class="text-xs text-gray-600 mt-1">
                        经验：<span class="font-mono">{{ showCurrentExp(skill.exp) }}</span>
                        <span class="hidden md:inline" v-if="getLevelExp(skill.level) > 0"> / {{
                            getLevelExp(skill.level) }}</span>
                    </div>
                </template>
            </div>
            </div>

            <div class="w-32">
                <el-button class="mt-2 w-full mx-0!" size="small" type="primary"
                    @click="showLogicDialog = true">调整自动释放逻辑</el-button>

                <template v-if="skill.skillId != 'baseAttack'">
                    <div class="flex flex-row gap-2">
                        <el-button :disabled="!!battleInfo?.battleStatus" v-if="skill.enabled" class="mt-2 w-full mx-0!"
                            size="small" type="success" @click="disableSkill">已启用</el-button>
                        <el-button :disabled="!!battleInfo?.battleStatus" v-if="!skill.enabled" class="mt-2 w-full mx-0!"
                            size="small" type="warning" @click="enableSkill">已禁用</el-button>

                        <template v-if="isKnowledgeCrownSkill">
                            <GameCharacterStatusSkillSpecialSkillKnowledgeCrownSkill :skill="skill"></GameCharacterStatusSkillSpecialSkillKnowledgeCrownSkill>
                        </template>

                        <template v-if="isChefSkill">
                            <GameCharacterStatusSkillSpecialSkillChefSkill :skill="skill"></GameCharacterStatusSkillSpecialSkillChefSkill>
                        </template>

                        <template v-if="isDominationSealSkill">
                            <GameCharacterStatusSkillSpecialSkillDominationSealSkill :skill="skill"></GameCharacterStatusSkillSpecialSkillDominationSealSkill>
                        </template>

                        <template v-if="isIntertwinedCatEyeGenesisEssenceStaffSkill">
                            <GameCharacterStatusSkillSpecialSkillIntertwinedCatEyeGenesisEssenceStaffSkill :skill="skill"></GameCharacterStatusSkillSpecialSkillIntertwinedCatEyeGenesisEssenceStaffSkill>
                        </template>

                        <template v-if="isBlinkshadowGirdleSkill">
                            <GameCharacterStatusSkillSpecialSkillBlinkshadowGirdleSkill :skill="skill"></GameCharacterStatusSkillSpecialSkillBlinkshadowGirdleSkill>
                        </template>
                    </div>
                </template>
            </div>
        </div>
    </el-card>

    <el-dialog v-model="showLogicDialog" title="自动释放逻辑设置" width="380px" append-to-body>
        <GameCharacterStatusSkillLogicEditor v-model="localLogic" />
        <template #footer>
            <template v-if="!battleInfo?.battleStatus">
                <el-button @click="showLogicDialog = false">取消</el-button>
                <el-button type="primary" @click="saveLogic">保存</el-button>
            </template>
        </template>
    </el-dialog>

</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills'
import { levelExpTable } from '~/shared/data/levelExpTable'
import type { GameBattleLogic, GameCharacterBattleSkillInfo } from '~/shared/types/skill';
import BattleSkillName from '../../Common/BattleSkillName.vue';
import { emitUpdateSkillCastLogic, onUpdateSkillCastLogicSuccess, onUpdateSkillCastLogicError, emitDisableSkill, emitEnableSkill } from '~/api/game/socket/skills'
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { formatCountToStr } from '~/shared/utils';

defineComponent({
  inheritAttrs: false
})

const battleInfo = useBattleInfo()

const props = defineProps<{
    skill: GameCharacterBattleSkillInfo
}>()

const isKnowledgeCrownSkill = computed(() => props.skill.skillId === 'knowledgeCrownSkill')
const isChefSkill = computed(() => props.skill.skillId === 'chefSkill')
const isDominationSealSkill = computed(() => props.skill.skillId === 'dominationSealSkill')
const isIntertwinedCatEyeGenesisEssenceStaffSkill = computed(() => props.skill.skillId === 'intertwinedCatEyeGenesisEssenceStaffSkill')
const isBlinkshadowGirdleSkill = computed(() => props.skill.skillId === 'blinkshadowGirdleSkill')

function getLevelExp(level: number) {
    // levelExpTable[level] 表示当前等级升到下一级所需经验
    return levelExpTable[level] ?? 0
}

function getExpPercent(level: number, exp: number) {
    const need = getLevelExp(level)
    if (!need || need === 0) return 100
    return Math.min(100, Math.round((exp / need) * 100))
}

const showLogicDialog = ref(false)
const localLogic = ref<GameBattleLogic[]>([])

watch(
    () => props.skill.logic,
    (val) => {
        localLogic.value = JSON.parse(JSON.stringify(val || []))
    },
    { immediate: true }
)

function saveLogic() {
    emitUpdateSkillCastLogic(props.skill.skillId, localLogic.value)

    showLogicDialog.value = false
}
function disableSkill() {
    emitDisableSkill(props.skill.skillId)
}
function enableSkill() {
    emitEnableSkill(props.skill.skillId)
}

function showCurrentExp(exp: number) {
    if(exp == ~~exp){
        return exp
    }

    return +exp.toFixed(2)
}
</script>