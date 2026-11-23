<template>
    <div class="">
        <div v-if="!hideName" class="font-bold mb-2 text-center">{{ unit.name }}</div>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">等级：</span>{{ unit.level ?? '-' }}</li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">生命：</span>{{ (unit.hp).toFixed(0) }} / {{
                unit.maxHp.toFixed(0) }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">魔法：</span>{{ (unit.mp ?? 0).toFixed(0) }} / {{
                (unit.maxMp ?? 0).toFixed(0) }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">攻击：</span>{{
                unit.status?.attacking?.level?.toFixed(1) ?? '-' }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">防御：</span>{{
                unit.status?.defencing?.level?.toFixed(1) ?? '-' }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">敏捷：</span>{{
                unit.status?.dexterity?.level?.toFixed(1) ?? '-' }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">力量：</span>{{
                unit.status?.strength?.level?.toFixed(1) ?? '-' }}
            </li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">智力：</span>{{
                unit.status?.intelligence?.level?.toFixed(1) ?? '-'
                }}</li>
            <li><span class="font-semibold text-gray-600 dark:text-gray-400">耐力：</span>{{ unit.status?.stamina?.level?.toFixed(1)
                ?? '-' }}
            </li>

            <li v-if="unit.status.otherStatus?.luck?.level"><span class="font-semibold text-gray-600">幸运：</span>{{
                unit.status?.otherStatus?.luck?.level?.toFixed(1) ?? '-'
                }}
            </li>
        </ul>
        <div v-if="!isPlayerUnit" class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ unitDesc }}</div>

        <div class="flex flex-col">
            <div class="mt-2" v-if="Object.keys(skills).length > 0">
                <div class="font-bold text-xs mb-1 text-gray-600 dark:text-gray-400">技能</div>
                <div class="flex flex-wrap gap-1">
                    <template v-for="[skillId, skill] in skills" :key="skillId">
                        <GameCommonBattleSkillName :skill-id="skillId" :level="skill?.level ?? 1"
                            v-if="skillId != 'baseAttack'" :logic="unit?.ai?.[skillId as AllBattleSkillId] ?? []"
                            :extra="skill.extra"
                            :in-cd="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                            <template v-if="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                                (cd: {{ (unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) }})
                            </template>
                        </GameCommonBattleSkillName>
                    </template>
                </div>
            </div>

            <div class="mt-2" v-if="Object.keys(unit.state ?? {}).length > 0">
                <div class="font-bold text-xs mb-1 text-gray-600 dark:text-gray-400">状态</div>
                <div class="inline-flex flex-wrap gap-2">
                    <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
                        :state-in-battle="state">
                    </GameCommonStateName>
                </div>
            </div>
        </div>

        <div v-if="Object.keys(unit.inventory ?? {}).length" class="mt-2">
            <div class="font-bold text-xs mb-1 text-gray-600 dark:text-gray-400">物品袋</div>
            <div class="text-xs text-gray-500 flex flex-row flex-wrap gap-2">
                <template v-for="item in inventory" :key="item.id">
                    <GameCommonResourceIconAndName :resource-id="item.id">
                        <span>
                            ({{ item?.remainingCount }}/{{ item?.prepareCount }})
                        </span>
                        <span v-if="item?.cooldown">
                            (冷却: {{ item.cooldown }})
                        </span>
                    </GameCommonResourceIconAndName>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="tsx">
import { allGameEnemies } from '~/shared/data/allGameEnemy';
import type { AllBattleSkillId } from '~/shared/types/skill';
import type { BaseBattleUnit } from '~/shared/types/unit';

const props = defineProps<{
  unit: BaseBattleUnit
  hideName?: boolean
}>()

const isPlayerUnit = computed(() => props.unit.isPlayerUnit)

const skills = computed(() => {
  return Object.entries(props.unit?.skills ?? {})
    .filter(([id]) => id !== 'baseAttack')
    .toSorted((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
});

const unitDesc = computed(() => {
  if (props.unit.isPlayer) return '';
  let desc = allGameEnemies[props.unit.id as keyof typeof allGameEnemies]?.description;
  return desc;
});

const inventory = computed(() => {
  let inventory = props.unit.inventory;
  if (!inventory) return [];
  return Object.entries(inventory).map(([itemId, item]) => {
    return {
      id: itemId,
      ...item
    };
  }).toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
})
</script>