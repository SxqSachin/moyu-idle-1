<template>
    <component v-if="skill" :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps"
        @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
        <template v-if="shouldRenderPopover" #reference>
            <template v-if="plain">
                {{ level ? 'Lv.' + level + ' ' : ' ' }}{{ skill.name }}
                <slot></slot>
            </template>
            <template v-else>
                <el-tag :disable-transitions="true" :type="!inCd ? 'success' : 'warning'" class="cursor-pointer"
                    v-bind="$attrs">{{ level ? 'Lv.' + level + ' ' : ' ' }}{{ skill.name }}
                    <slot></slot>
                </el-tag>
            </template>
        </template>

        <!-- 当不是 popover 时的内容 -->
        <template v-if="!shouldRenderPopover">
            <template v-if="plain">
                {{ level ? 'Lv.' + level + ' ' : ' ' }}{{ skill.name }}
                <slot></slot>
            </template>
            <template v-else>
                <el-tag :disable-transitions="true" :type="!inCd ? 'success' : 'warning'" class="cursor-pointer"
                    v-bind="$attrs">{{ level ? 'Lv.' + level + ' ' : ' ' }}{{ skill.name }}
                    <slot></slot>
                </el-tag>
            </template>
        </template>

        <!-- popover 内容 -->
        <template v-if="shouldRenderPopover">
            <div>
                <div class="font-semibold text-base mb-1">{{ skill.name }}</div>
                <template v-for="category of skill.skillType" :key="category">
                    <el-tag size="small" class="mr-1 mb-1"
                        :style="{ backgroundColor: skillTypeMap[category]?.color, color: '#fff', border: 'none' }">
                        {{ skillTypeMap[category]?.label || category }}
                    </el-tag>
                </template>
                <template v-if="!skill.passive">
                    <template v-if="skill.damageType">
                        <div class="text-sm mb-1">
                            <span> 伤害类型： </span>
                            <span v-for="(type, index) in getSkillDamageTypes(skill.id as AllBattleSkillId)" :key="index" class="mr-1">
                                {{ damageTypeMap[type]?.label || type }}
                            </span>
                        </div>
                    </template>
                    <div class="text-sm mb-1">魔法消耗：{{ skill.mpCost }} </div>
                    <div class="text-sm mb-1">冷却：{{ skill.colddown }} 回合</div>
                </template>
                <div class="text-sm text-gray-700 dark:text-gray-300">效果：
                    <p v-for="desc in descriptionList" class="text-gray-500 dark:text-gray-400">
                        {{ desc }}
                    </p>
                </div>

                <div v-if="Object.keys(props.extra ?? {}).length" class="mt-4">
                    <template v-for="(value, key) in props.extra" :key="key">
                        <template v-if="key == 'knowledgeCrownSkills'">
                            <div class="text-sm text-gray-400 dark:text-gray-500">
                                <span>已组合:</span>
                                <span>{{ (value as AllBattleSkillId[]).map(skillId =>
                                    allGameBattleSkills[skillId]?.name).join("、") }}</span>
                            </div>
                        </template>
                        <template v-if="key == 'dominationSealSkills'">
                            <div class="text-sm text-gray-400 dark:text-gray-500">
                                <span>统御:</span>
                                <span>{{ (value as AllBattleSkillId[]).map(skillId =>
                                    allGameBattleSkills[skillId]?.name).join("、") }}</span>
                            </div>
                        </template>
                        <template v-if="key == 'chefSkill'">
                            <div class="text-sm text-gray-400 dark:text-gray-500 flex flex-col gap-1">
                                <span>风味:</span>
                                <template v-for="flavor in (value as ChefSkillCombinationInfo).flavors"
                                    :key="flavor.key">
                                    <template v-if="flavor.count > 0">
                                        <div class="flex items-center gap-2">
                                            <span>{{ CHEF_SKILL_FLAVOR_KEY_NAME_MAP[flavor.key] }}:</span>
                                            <span>{{ flavor.count }}</span>
                                        </div>
                                    </template>
                                </template>

                                <span>目标:</span>
                                <template v-for="target in (value as ChefSkillCombinationInfo).targets"
                                    :key="target.key">
                                    <template v-if="target.count > 0">
                                        <div class="flex items-center gap-2">
                                            <span>{{ CHEF_SKILL_TARGET_KEY_NAME_MAP[target.key] }}:</span>
                                            <span>{{ target.count }}</span>
                                        </div>
                                    </template>
                                </template>
                            </div>
                        </template>
                    </template>
                </div>
            </div>
            <template v-if="logic?.length">
                <el-divider class="my-2!"></el-divider>
                <el-button type="primary" size="small" class="w-full"
                    @click="showLogicDialog = true;">查看自动释放逻辑</el-button>
            </template>
        </template>
    </component>
    <el-tag v-else type="info" class="cursor-pointer">未知技能</el-tag>

    <el-dialog v-if="skill && logic?.length" v-model="showLogicDialog" title="自动释放逻辑设置" width="500px" append-to-body>
        <GameCharacterStatusSkillLogicEditor :readonly="true" v-model="logic!" />
    </el-dialog>
</template>

<script setup lang="ts">
import { ElPopover } from "element-plus";
import { computed } from "vue";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { CHEF_SKILL_FLAVOR_KEY_NAME_MAP, CHEF_SKILL_TARGET_KEY_NAME_MAP, DamageType, damageTypeMap, type GameBattleSkill, skillTypeMap, type AllBattleSkillId, type ChefSkillCombinationInfo, type GameBattleLogic, type GameCharacterBattleSkillInfo, type GameFullBattleLogic } from "~/shared/types/skill";

defineOptions({ inheritAttrs: false }); // 防止警告

const props = defineProps<{
    skillId: AllBattleSkillId | string
    level?: number

    inCd?: boolean

    logic?: GameFullBattleLogic

    plain?: boolean // 是否为纯文本显示

    extra?: GameCharacterBattleSkillInfo['extra']
}>();

const showLogicDialog = ref(false);
const skill = computed<GameBattleSkill>(() => allGameBattleSkills[props.skillId as AllBattleSkillId]);

const descriptionList = computed(() => {
    if (!skill.value) return '未知技能';
    return skill.value.effectStr.split('\n')
});

const shouldRenderPopover = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    
    return {
        placement: "bottom",
        trigger: "hover",
        transition: "el-fade-in",
        showAfter: 380,
        width: 320,
    }
})
function handleMouseEnter() {
    // 如果已经在显示或者禁用了额外内容，直接返回
    if (shouldRenderPopover.value) return
    
    // 延迟渲染 popover，避免快速划过时创建不必要的元素
    hoverTimer.value = setTimeout(() => {
        shouldRenderPopover.value = true
    }, 150) // 150ms 延迟
}

// 鼠标离开事件
function handleMouseLeave() {
    // 清除延迟渲染的定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
}

const getSkillDamageTypes = (skillId: AllBattleSkillId) => {
    const skill = allGameBattleSkills[skillId];
    if (!skill) return [];
    return Array.isArray(skill.damageType) ? skill.damageType : [skill.damageType];
};

onUnmounted(() => {
    // 清除定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
    shouldRenderPopover.value = false
})

</script>