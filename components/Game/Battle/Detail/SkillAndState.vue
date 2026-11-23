<template>
  <div v-if="battleInfo" class="flex flex-col text-gray-600 dark:text-gray-300 items-start w-full">
    <div class="w-full">
      <div class="flex flex-col gap-4 flex-1 w-full p-2">

        <template v-for="(unitIds, groupId) in battleInfo.groups" :key="groupId">
          <div class="flex-1  grid grid-cols-1 gap-2 text-sm">
            <template v-for="unit in getUnitsByGroups(groupId)" :key="unit.uuid">
              <el-card class="transition-all w-full"
              :class="{
                'current-turn-unit': unit.uuid == currentUnitUuid,
                'shadow-xs!': unit.uuid != currentUnitUuid
              }"
                body-class="flex flex-col gap-2 justify-start border border-gray-200 rounded-sm p-2!"
                >
                <!-- <div class="relative h-fit "> -->
                <div class="flex flex-row">
                  <div class="w-40">
                    <template v-if="unit.isPlayerUnit">
                      <GameUserAvatarAndName :uuid="unit.uuid" :specific-name="unit.name"></GameUserAvatarAndName>
                    </template>
                    <template v-else>
                      {{ unit.name }}
                    </template>
                  </div>
                  <template v-if="!isMobile">
                    <div class="flex-1 flex flex-row gap-2" v-if="Object.keys(unit.state ?? {}).length > 0" :class="{
                        'items-start': Object.keys(unit.skills).length > 1,
                        'items-center': Object.keys(unit.skills).length <= 1
                      }">
                      <div class="font-bold text-xs text-gray-600 dark:text-gray-400 work-keep whitespace-nowrap"
                        :class="{
                          'relative top-1': Object.keys(unit.skills).length > 1,
                        }">
                        状态</div>
                      <div class="inline-flex flex-wrap gap-2">
                        <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
                          :state-in-battle="state">
                        </GameCommonStateName>
                      </div>
                    </div>
                  </template>
                </div>
                <div class="flex flex-col gap-4">
                  <div class="flex flex-row items-center gap-2" v-if="Object.keys(unit.skills).length > 1">
                    <div class="font-bold text-xs mb-1 text-gray-600 dark:text-gray-400 work-keep whitespace-nowrap">
                      技能</div>
                    <div class="flex flex-wrap gap-1">
                      <template v-for="[skillId, skill] in getUnitSkills(unit)" :key="skillId">
                        <GameCommonBattleSkillName :skill-id="skillId" :level="skill?.level ?? 1"
                          :extra="skill?.extra ?? {}"
                          v-if="skillId != 'baseAttack'" :logic="unit?.ai?.[skillId as AllBattleSkillId] ?? []"
                          :in-cd="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                          <template v-if="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                            (cd: {{ (unit.skillColddown?.[(skillId as AllBattleSkillId)]
                            ?? 0) }})
                          </template>
                        </GameCommonBattleSkillName>
                      </template>
                    </div>
                  </div>

                  <template v-if="isMobile">
                    <div class="flex-1 flex flex-row items-center gap-2"
                      v-if="Object.keys(unit.state ?? {}).length > 0">
                      <div
                        class="font-bold text-xs mb-1 text-gray-600 dark:text-gray-400 work-keep whitespace-nowrap relative">
                        状态</div>
                      <div class="inline-flex flex-wrap gap-2">
                        <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
                          :state-in-battle="state">
                        </GameCommonStateName>
                      </div>
                    </div>
                  </template>

                </div>

              </el-card>
            </template>
          </div>
        </template>
      </div>
    </div>

  </div>
</template>

<script setup lang="tsx">
import { onTurnStart } from '~/api/game/socket/battle';
import type { FuncAction } from '~/shared/types';
import type { BaseBattleAction, BattleInfo } from '~/shared/types/battle';
import type { AllBattleSkillId } from '~/shared/types/skill';
import type { BaseBattleUnit } from '~/shared/types/unit';

const device = useDevice()

const isMobile = computed(() => device.isMobile)

const props = defineProps<{
  battleInfo?: BattleInfo | null;
}>();

const battleInfo = toRef(props, 'battleInfo');

function getUnitsByGroups(groupId: string) {
  if (!battleInfo.value) return [];
  const unitInGroup = battleInfo.value.groups[groupId];
  return battleInfo.value.members.filter(unit => unitInGroup.includes(unit.uuid));
}

const currentTurnUnitUuid = ref<string>()
const currentUnitUuid = computed(() => {
  if (currentTurnUnitUuid.value) return currentTurnUnitUuid.value;
  // if (thisRoundAction.value?.sourceUnitUuid) return thisRoundAction.value.sourceUnitUuid;
  return battleInfo.value?.turnOrder?.[battleInfo.value?.currentTurnIndex ?? 0];
});

function getUnitSkills(unit: BaseBattleUnit) {
  return Object.entries(unit?.skills ?? {})
    .filter(([id]) => id !== 'baseAttack')
    .toSorted((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
}

let off1: FuncAction
onMounted(() => {
    off1 = onTurnStart(data => {
      currentTurnUnitUuid.value = data.source
    })
});
onUnmounted(() => {
  off1?.()
});

</script>
<style lang="scss" scoped>
.current-turn-unit {
  box-shadow: 0 0 10px 3px rgba(0, 220, 90, 0.45), 0 0 0 2px #3cff7a inset !important;
  transition: box-shadow 0.4s, opacity 0.4s;
  opacity: 1;
}
</style>