<template>
    <div class="space-y-2">
        <ul class="space-y-1 text-sm">
            <li><span class="font-semibold">等级：</span>{{ unit.level }}</li>
            <li><span class="font-semibold">生命：</span>{{ unit.maxHp }}</li>
            <li><span class="font-semibold">魔法：</span>{{ unit.maxMp }}</li>
            <!-- <li><span class="font-semibold">攻击：</span>{{ enemyDetail.attack }}</li>
                    <li><span class="font-semibold">防御：</span>{{ enemyDetail.defense }}</li> -->
            <li><span class="font-semibold">力量：</span>{{ unit.status.strength.level }}</li>
            <li><span class="font-semibold">敏捷：</span>{{ unit.status.dexterity.level }}</li>
            <li><span class="font-semibold">智力：</span>{{ unit.status.intelligence.level }}</li>
            <li><span class="font-semibold">耐力：</span>{{ unit.status.stamina.level }}</li>
            <li><span class="font-semibold">攻击属性：</span>{{ unit.status.attacking.level }}</li>
            <li><span class="font-semibold">防御属性：</span>{{ unit.status.defencing.level }}</li>
            <el-divider class="my-2!"></el-divider>
            <li class="mb-1"><span class="font-semibold" v-if="unit.description">描述：</span>{{ unit.description }}</li>
            <li v-if="unit.skills && Object.keys(unit.skills).length" class="mb-1">
                <span class="font-semibold">技能：</span>
                <span>
                    <span v-for="(skill, skillId) in unit.skills" :key="skillId" class="mr-1">
                        <GameCommonBattleSkillName :skill-id="skillId" :level="skill!.level" />
                    </span>
                </span>
            </li>
            <li v-if="unit.state && Object.keys(unit.state).length" class="mb-1">
                <span class="font-semibold">状态：</span>
                <span>
                    <span v-for="(state, stateId) in unit.state" :key="stateId" class="mr-1">
                        <GameCommonStateName :state-id="stateId"></GameCommonStateName>
                    </span>
                </span>
            </li>
            <li v-if="unit.equipment && Object.keys(unit.equipment).length" class="mb-1">
                <span class="font-semibold">装备：</span>
                <span>
                    <span v-for="(equipmentId, part) in unit.equipment" :key="part" class="mr-1">
                        <template v-if="equipmentId">
                            <GameCommonResourceIconAndName :resource-id="equipmentId" />
                        </template>
                    </span>
                </span>
            </li>
        </ul>
    </div>
</template>
<script setup lang="tsx">
import type { BaseBattleUnit } from '~/shared/types/unit';


const props = defineProps<{
    unit: BaseBattleUnit
}>();

</script>
