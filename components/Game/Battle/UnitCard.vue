<template>
  <el-popover placement="top" :width="260" trigger="hover" :show-after="180">
    <template #reference>
      <div class="relative h-fit" :class="{ 'dead-unit': unit.hp <= 0 }">
        <div class="unit-card" :data-unit-id="unit.uuid">
          <div class="relative rounded-xl dark:bg-gray-800 p-3 w-32 md:w-50 shadow battle-unit-card"
            :class="[cardClass, { 'world-boss-card': isWorldBossCard }]"
            :style="cardStyle">
            <div class="battle-unit-card__bg w-full h-full absolute left-0 top-0 rounded-xl"></div>

            <div class="relative flex flex-col gap-1 md:gap-2">
              <!-- 角色基础信息 -->
              <div class="relative flex items-center gap-3 battle-unit-card__unit-name" :class="{
                'h-10': isPlayerUnit
              }">
                <template v-if="isPlayerUnit">
                  <GameUserAvatarAndName :uuid="unit.uuid" :specific-name="unit.name" :avatar-size="52"></GameUserAvatarAndName>
                </template>
                <template v-else>
                  {{ unit.name }}
                </template>
              </div>

              <!-- Boss HP 同步浮动数字 -->
              <div v-for="float in bossHpSyncFloatItems" :key="float.key" class="boss-hp-float"
                :class="{
                  'boss-hp-float--heal': float.delta > 0,
                  'boss-hp-float--boss': isWorldBossCard,
                }">
                <template v-if="float.delta > 0">+{{ float.value }}</template>
                <template v-else>-{{ float.value }}</template>
              </div>

              <!-- 浮动数字 -->
              <div v-for="float in damageFloats || []" :key="float.key" class="damage-float" :class="{
                'damage-float-heal': float.type === 'heal',
                'damage-float-restore-mp': float.type === 'restoreMp',
                'damage-float-loss-mp': float.type === 'lossMp',
                'damage-shield-damage': float.type === 'shieldDamage',
              }">
                <template v-if="float.type === 'heal'">
                  +{{ (float.value).toFixed(0) }}
                </template>
                <template v-else-if="float.type === 'lossMp'">
                  -{{ (float.value).toFixed(0) }}
                </template>
                <template v-else-if="float.type === 'restoreMp'">
                  +{{ (float.value).toFixed(0) }}
                </template>
                <template v-else>
                  -{{ (float.value).toFixed(0) }}
                </template>
              </div>

              <div v-if="skillCastFloats?.length" v-for="(skill, index) of skillCastFloats" :key="skill.key"
                :ref="el => setSkillFloatRef(el, index)" class="skill-cast-float bg-white dark:bg-gray-700 min-w-24"
                :class="getSkillChatBoxClass(skill.skillId)"
                :style="{ ...getSkillChatBoxStyle(skill.skillId), ...getFloatPositionStyle('skill', index) }">
                <span class="text-xs w-full">
                  <GameCommonBattleSkillName :plain="true" :skill-id="skill.skillId">
                  </GameCommonBattleSkillName>
                </span>
              </div>

              <div v-if="mergedTextFloats?.length" v-for="(text, index) of mergedTextFloats" :key="text.key"
                :ref="el => setTextFloatRef(el, index)" class="text-float bg-white dark:bg-gray-700 min-w-24"
                :style="{ ...getTextBoxStyle(), ...getFloatPositionStyle('text', index) }">
                <span class="text-xs w-full">
                  {{ text.text }}
                </span>
              </div>

              <div v-if="itemUseFloats[unit.uuid]" :key="itemUseFloats[unit.uuid].key"
                class="item-use-float bg-white dark:bg-gray-700 w-36">
                <span class="ml-1 text-xs text-blue-600">使用
                  <GameCommonSimpleResourceIconAndName :resource-id="itemUseFloats[unit.uuid].itemId" :icon-size="10" />
                </span>
              </div>

              <!-- 属性区 -->
              <div class="mt-2 relative battle-unit-card__hp-mp">
                <div class="flex items-center mb-1">
                  <span class="text-xs text-gray-500 mr-2">HP</span>
                  <div class="relative hidden md:block flex-1" style="height: 8px;">
                    <!-- HP条 -->
                    <el-progress :percentage="getHpPercent(unit)" :stroke-width="8" status="success" :show-text="false"
                      style="position:absolute; left:0; top:0; width:100%;" class="hp-bar" />
                    <!-- 护盾条（在HP条下方，短短的淡灰色） -->
                    <div v-if="unit.tmpShield > 0"
                      class="-bottom-[2px] left-0 absolute hidden md:block w-2/3 mx-auto mt-[-6px] shield-bar">
                      <div :style="{
                        width: Math.min(100, Math.round((unit.tmpShield / (unit.maxHp || 1)) * 100)) + '%',
                        height: '4px',
                        backgroundColor: '#f7d047',
                        borderRadius: '6px',
                        transition: 'width 0.3s'
                      }"></div>
                    </div>
                  </div>

                  <span class="ml-0 md:ml-2 text-xs font-bold text-green-700 battle-unit-card__hp-current">{{ (unit.hp
                    ??
                    0).toFixed(0) }}</span>
                  <span
                    class="block md:hidden ml-0 md:ml-2 text-xs font-bold text-green-700 battle-unit-card__hp-max">/{{
                    (unit.maxHp ?? 0).toFixed(0) }}</span>

                  <span v-if="unit.tmpShield > 0"
                    class="ml-2 flex items-center text-xs font-bold text-yellow-600  battle-unit-card__shield-current">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#f7d047" class="mr-0"
                      style="vertical-align:middle">
                      <path d="M10 2l7 4v5c0 5-3.5 8-7 8s-7-3-7-8V6l7-4z" />
                    </svg>
                    {{ unit.tmpShield.toFixed(0) }}
                  </span>

                </div>

                <div class="flex items-center mt-0">
                  <span class="text-xs text-blue-500 mr-2">MP</span>
                  <div class="hidden md:block flex-1">
                    <el-progress class="mp-bar" :percentage="getMpPercent(unit)" :stroke-width="8" color="#409EFF"
                      :show-text="false" />
                  </div>
                  <span class="ml-0 md:ml-2 text-xs font-bold text-blue-700 battle-unit-card__mp-current">{{ (unit.mp ??
                    0).toFixed(0) }}</span>
                  <span
                    class="block md:hidden ml-0 md:ml-2 text-xs font-bold text-blue-700 battle-unit-card__mp-max">/{{
                    (unit.maxMp ?? 0).toFixed(0) }}</span>
                </div>
              </div>

              <div class="flex md:hidden mt-2 gap-2 battle-unit-card__skill-and-state">
                <div class="font-bold text-xs mb-1 battle-unit-card__skill-count">技能:{{ skills.length }}</div>

                <div class="font-bold text-xs mb-1" v-if="Object.keys((unit.state ?? {})).length">
                  <div class="flex items-center gap-1">
                    <div class="inline-block font-bold"> 状态: </div>
                    <div class="flex flex-row items-center gap-1 battle-unit-card__state-count">
                      <template v-if="!!buffCount">
                        <span class="battle-unit-card__state-count--buff">{{ buffCount }}</span>
                      </template>
                      <template v-if="buffCount && !!debuffCount">
                        <span class="battle-unit-card__state-count--buff-divider"> / </span>
                      </template>
                      <template v-if="!!debuffCount">
                        <span class="battle-unit-card__state-count--debuff">{{ debuffCount }}</span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <div class="hidden md:flex flex-row items-center gap-4 text-[12px] battle-unit-card__skill-and-state">
                <div v-if="skills.length">

                  <el-popover placement="top" trigger="hover" :width="260">
                    <template #reference>
                      <div class="flex items-center gap-1">
                        <div class="inline-block font-bold">技能: </div>
                        <div type="primary" :underline="false" class="battle-unit-card__skill-count">{{
                          skills.length }}
                          <span class="text-xs battle-unit-card__skill-count--colddown" v-if="colddownSkillCount">(冷却中:
                            {{
                            colddownSkillCount }})</span>
                        </div>
                      </div>
                    </template>
                    <div class="flex flex-wrap gap-2">
                      <template v-for="([skillId, skill]) in skills" :key="skillId">
                        <GameCommonBattleSkillName :skill-id="skillId" :level="skill?.level ?? 1"
                          :extra="skill?.extra ?? {}"
                          :logic="unit?.ai?.[skillId as AllBattleSkillId] ?? []"
                          :in-cd="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                          <template v-if="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                            (cd: {{ (unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) }})
                          </template>
                        </GameCommonBattleSkillName>
                      </template>
                    </div>
                  </el-popover>
                </div>

                <!-- 状态区 -->
                <div v-if="Object.keys((unit.state ?? {})).length">
                  <div v-if="!showAllState">
                    <el-popover placement="top" trigger="hover" :width="260" :show-after="380">
                      <template #reference>
                        <div class="flex items-center gap-1">
                          <div class="inline-block font-bold"> 状态: </div>
                          <div class="flex flex-row items-center gap-1 battle-unit-card__state-count">
                            <template v-if="!!buffCount">
                              <span class="battle-unit-card__state-count--buff">{{ buffCount }}</span>
                            </template>
                            <template v-if="buffCount && !!debuffCount">
                              <span class="battle-unit-card__state-count--buff-divider"> / </span>
                            </template>
                            <template v-if="!!debuffCount">
                              <span class="battle-unit-card__state-count--debuff">{{ debuffCount }}</span>
                            </template>
                          </div>
                        </div>
                      </template>
                      <div class="inline-flex flex-wrap gap-2">
                        <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
                          :state-in-battle="state">
                        </GameCommonStateName>
                      </div>
                    </el-popover>
                  </div>
                </div>
              </div>

              <div v-if="showAllState" class="text-xs" @click="showAllState = false">
                <div class="inline-block font-bold text-gray-600 dark:text-gray-400 mb-2"> 状态: </div>
                <div class="flex flex-row flex-wrap gap-2">
                  <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
                    :state-in-battle="state">
                  </GameCommonStateName>
                </div>
              </div>

              <el-tag v-if="unit.uuid === currentUnitId" type="success"
                class="hidden! md:flex! absolute right-0 top-0">行动中</el-tag>
            </div>

          </div>
        </div>
      </div>
    </template>

    <div class="p-2 max-h-62 overflow-y-auto">
      <div class="font-bold mb-2 text-center">{{ unit.name }}</div>
      <ul class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <li><span class="font-semibold text-gray-600">等级：</span>{{ unit.level ?? '-' }}</li>
        <li><span class="font-semibold text-gray-600">生命：</span>{{ (unit.hp).toFixed(0) }} / {{
          unit.maxHp.toFixed(0) }}
        </li>
        <li><span class="font-semibold text-gray-600">魔法：</span>{{ (unit.mp ?? 0).toFixed(0) }} / {{
          (unit.maxMp ?? 0).toFixed(0) }}
        </li>
        <li><span class="font-semibold text-gray-600">攻击：</span>{{
          unit.status?.attacking?.level?.toFixed(1) ?? '-' }}
        </li>
        <li><span class="font-semibold text-gray-600">防御：</span>{{
          unit.status?.defencing?.level?.toFixed(1) ?? '-' }}
        </li>
        <li><span class="font-semibold text-gray-600">敏捷：</span>{{
          unit.status?.dexterity?.level?.toFixed(1) ?? '-' }}
        </li>
        <li><span class="font-semibold text-gray-600">力量：</span>{{
          unit.status?.strength?.level?.toFixed(1) ?? '-' }}
        </li>
        <li><span class="font-semibold text-gray-600">智力：</span>{{
          unit.status?.intelligence?.level?.toFixed(1) ?? '-'
          }}</li>
        <li><span class="font-semibold text-gray-600">耐力：</span>{{ unit.status?.stamina?.level?.toFixed(1)
          ?? '-' }}
        </li>

        <li v-if="unit.status.otherStatus?.luck?.level"><span class="font-semibold text-gray-600">幸运：</span>{{
          unit.status?.otherStatus?.luck?.level?.toFixed(1) ?? '-'
          }}
        </li>
      </ul>
      <div v-if="!isPlayerUnit" class="mt-2 text-xs text-gray-500">{{ unitDesc }}</div>

      <div class="flex flex-col">
        <div class="mt-2" v-if="Object.keys(unit.skills).length > 1">
          <div class="font-bold text-xs mb-1 text-gray-600">技能</div>
          <div class="flex flex-wrap gap-1">
            <template v-for="[skillId, skill] in skills" :key="skillId">
              <GameCommonBattleSkillName :skill-id="skillId" :level="skill?.level ?? 1" v-if="skillId != 'baseAttack'"
                :logic="unit?.ai?.[skillId as AllBattleSkillId] ?? []"
                :in-cd="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                <template v-if="(unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) > 0">
                  (cd: {{ (unit.skillColddown?.[(skillId as AllBattleSkillId)] ?? 0) }})
                </template>
              </GameCommonBattleSkillName>
            </template>
          </div>
        </div>

        <div class="mt-2" v-if="Object.keys(unit.state ?? {}).length > 0">
          <div class="font-bold text-xs mb-1 text-gray-600">状态</div>
          <div class="inline-flex flex-wrap gap-2">
            <GameCommonStateName v-for="(state, stateId) in unit.state" :key="stateId" :state-id="stateId"
              :state-in-battle="state">
            </GameCommonStateName>
          </div>
        </div>
      </div>

      <div class="mt-2" v-if="!isPlayerUnit && Object.values(unit.equipment ?? {}).length">
        <span class="font-semibold">装备：</span>
        <span>
          <span v-for="(equipmentId, part) in unit.equipment" :key="part" class="mr-1">
            <template v-if="equipmentId">
                <GameCommonResourceIconAndName :resource-id="equipmentId" />
            </template>
          </span>
        </span>
      </div>

      <div v-if="Object.keys(unit.inventory ?? {}).length" class="mt-2">
        <div class="font-bold text-xs mb-1 text-gray-600">物品袋</div>
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
  </el-popover>
</template>

<script setup lang="tsx">
import { emitGetUserCustomStyle } from '~/api/game/socket/style';
import { useUserStyleStore } from '~/composables/game/useUserStyleStore';
import { allBattleState } from '~/shared/data/allBattleState';
import { type AllBattleStateId } from '~/shared/types/BattleState';
import type { AllBattleSkillId } from '~/shared/types/skill';
import type { BaseBattleUnit } from '~/shared/types/unit';
import { ObjectKeys } from '~/shared/utils';
import type { allBattleStyle } from '~/shared/data/allStyle';
import { allGameBattleSkills } from '~/shared/data/allGameBattleSkill';

import battleUnitCard_Magical from '~/assets/battleUnitCard/battleUnitCard:magical.png'
import battleUnitCard_Warrior from '~/assets/battleUnitCard/battleUnitCard:warrior.png'
import battleUnitCard_Cleric from '~/assets/battleUnitCard/battleUnitCard:cleric.png'
import battleUnitCard_Ninja from '~/assets/battleUnitCard/battleUnitCard:ninja.png'

import battleUnitCard_Magical_SkillCastChatBox from '~/assets/chatbox/battleUnitCard_magical_skillCast.png'
import battleUnitCard_Cleric_SkillCastChatBox from '~/assets/chatbox/battleUnitCard_cleric_skillCast.png'
import battleUnitCard_Warrior_SkillCastChatBox from '~/assets/chatbox/battleUnitCard_warrior_skillCast.png'
import battleUnitCard_Ninja_SkillCastChatBox from '~/assets/chatbox/battleUnitCard_ninja_skillCast.png'

import { allGameEnemies } from '~/shared/data/allGameEnemy';

const bgMap: Record<keyof typeof allBattleStyle, string> = {
  "": "",
  magical: battleUnitCard_Magical,
  warrior: battleUnitCard_Warrior,
  cleric: battleUnitCard_Cleric,
  ninja: battleUnitCard_Ninja,
}

const skillCastChatBox: Record<keyof typeof allBattleStyle, string> = {
  "": "",
  magical: battleUnitCard_Magical_SkillCastChatBox,
  warrior: battleUnitCard_Warrior_SkillCastChatBox,
  cleric: battleUnitCard_Cleric_SkillCastChatBox,
  ninja:  battleUnitCard_Ninja_SkillCastChatBox,
}

const props = defineProps<{
  unit: BaseBattleUnit;
  currentUnitId?: string;
  skillCastFloats: { key: any; skillId: AllBattleSkillId }[] | undefined
  textFloats: { key: any; text: string }[] | undefined
  itemUseFloats: Record<string, { key: any; itemId: string }>;
  damageFloats: { value: number, key: number, type: 'damage' | 'shieldDamage' | 'heal' | 'restoreMp' | 'lossMp' }[] | undefined

  isWorldBossUnit?: boolean
  bossHpSyncFloats?: Array<{ thisClientOriHp: number, latestHp: number, key: number}> | undefined
}>();

// 用于存储浮动元素的引用（保留，但不使用GSAP）
const skillFloatRefs = ref<(HTMLElement | null)[]>([])
const textFloatRefs = ref<(HTMLElement | null)[]>([])

// 设置浮动元素引用
const setSkillFloatRef = (el: any, index: number) => {
  if (el) {
    skillFloatRefs.value[index] = el
  }
}

const setTextFloatRef = (el: any, index: number) => {
  if (el) {
    textFloatRefs.value[index] = el
  }
}

// 计算浮动元素的位置偏移
const getFloatPositionStyle = (type: 'skill' | 'text', index: number) => {
  const baseTop = type === 'skill' ? 8 : 0
  let spacing = 35 // 减少垂直间距
  
  // 限制显示数量，避免超出卡片
  const maxVisibleFloats = 3
  
  if (type === 'text') {
    const skillCount = props.skillCastFloats?.length || 0
    const adjustedTop = baseTop + skillCount * spacing
    
    // 如果超过最大显示数量，使用更紧凑的布局
    if (index >= maxVisibleFloats) {
      spacing = 25 // 更紧凑的间距
      return {
        top: `${adjustedTop + (maxVisibleFloats - 1) * 35 + (index - maxVisibleFloats + 1) * spacing}%`,
        opacity: Math.max(0.3, 1 - (index - maxVisibleFloats + 1) * 0.2) // 后面的元素逐渐透明
      }
    }
    
    return {
      top: `${adjustedTop + index * spacing}%`
    }
  } else {
    // 技能浮动也应用相同的限制
    if (index >= maxVisibleFloats) {
      spacing = 25
      return {
        top: `${baseTop + (maxVisibleFloats - 1) * 35 + (index - maxVisibleFloats + 1) * spacing}%`,
        opacity: Math.max(0.3, 1 - (index - maxVisibleFloats + 1) * 0.2)
      }
    }
    
    return {
      top: `${baseTop + index * spacing}%`
    }
  }
}

// 添加文本浮动合并逻辑（可选）
const mergedTextFloats = computed(() => {
  if (!props.textFloats || props.textFloats.length <= 4) {
    return props.textFloats
  }
  
  // 如果文本浮动超过4个，将多余的合并为一个"..."提示
  const visibleFloats = props.textFloats.slice(0, 3)
  const remainingCount = props.textFloats.length - 3
  
  return [
    ...visibleFloats,
    {
      key: 'merged-text-float',
      text: `...还有${remainingCount}条消息`
    }
  ]
})

// Boss HP 同步浮动：基于本地旧值和最新值计算 delta，负为掉血，正为治疗
const bossHpSyncFloatItems = computed(() => {
  if (!props.bossHpSyncFloats || !props.bossHpSyncFloats.length) return [] as Array<{ key: number; delta: number; value: number }>;
  return props.bossHpSyncFloats
    .map((f) => {
      const delta = (f.latestHp ?? 0) - (f.thisClientOriHp ?? 0);
      return {
        key: f.key,
        delta,
        value: Math.abs(Math.round(delta)),
      };
    })
    .filter((f) => f.value > 0);
});

// 清理引用
watch(() => props.skillCastFloats?.length, (newLength) => {
  if (newLength === 0) {
    skillFloatRefs.value = []
  }
})

watch(() => props.textFloats?.length, (newLength) => {
  if (newLength === 0) {
    textFloatRefs.value = []
  }
})



const styleStore = useUserStyleStore()

const showAllState = ref(false);

const isPlayerUnit = computed(() => {
  return props.unit.isPlayerUnit;
})

const isWorldBossCard = computed(() => props.isWorldBossUnit && !!props.unit.isBoss);

const unitUuid = computed(() => {
  return props.unit.uuid;
})

const style = computed(() => {
  return styleStore.value[unref(unitUuid)]
})

const cardClass = computed(() => {
  let cls = "";

  if (props.unit.uuid == props.currentUnitId) {
    cls += " glow-current-unit "
  }

  if (showAllState.value) {
    cls += " battle-unit-card--show-all-state "
  }

  if (style?.value?.currentBattleCardStyle) {
    return cls + "battle-unit-card--" + style.value.currentBattleCardStyle;
  }

  return cls + " bg-white "
})

const cardStyle = computed(() => {
  let res = {
    "--bg-image": ""
  }
  if (style?.value?.currentBattleCardStyle) {
    res['--bg-image'] = `url(${bgMap[style.value.currentBattleCardStyle]})`;
  }

  return res
})

const buffCount = computed(() => {
  return ObjectKeys<AllBattleStateId>(props.unit.state ?? {}).filter(id => {
    return !allBattleState[id].isDebuff
  }).length
})

const debuffCount = computed(() => {
  return ObjectKeys<AllBattleStateId>(props.unit.state ?? {}).filter(id => {
    return allBattleState[id].isDebuff
  }).length
})

const skills = computed(() => {
  return Object.entries(props.unit?.skills ?? {})
    .filter(([id]) => id !== 'baseAttack')
    .toSorted((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
});
const colddownSkillCount = computed(() => {
  return Object.values(props.unit?.skillColddown ?? {}).filter(c => c > 0).length
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

onMounted(() => {
  let uuid = unref(unitUuid)
  if (props.unit.isPlayerUnit && uuid) {
    if (!styleStore.value[uuid]) {
      emitGetUserCustomStyle(uuid)
    }
  }
})

onUnmounted(() => {
  skillFloatRefs.value = []
  textFloatRefs.value = []
})

const getSkillChatBoxClass = (skillId: AllBattleSkillId) => {
  let skillTags: string[] = [];

  let skill = allGameBattleSkills[skillId]
  if (!skill) {
    return ""
  }

  for (const skillType of skill.skillType) {
    skillTags.push(`skill--${skillType}`);
  }

  if (Array.isArray(skill.damageType)) {
    for (const damageType of skill.damageType) {
      skillTags.push(`skill-damage--${damageType}`);
    }
  } else {
    skillTags.push(`skill-damage--${skill.damageType}`);
  }

  return skillTags.join(' ');
}

const getTextBoxStyle = () => {
  let s = {
    "--bg-image": ""
  };
  if (skillCastChatBox[style?.value?.currentBattleCardStyle]) {
    s['--bg-image'] = `url(${skillCastChatBox[style.value.currentBattleCardStyle]})`;
  }
  return s;
}
const getSkillChatBoxStyle = (skillId: AllBattleSkillId) => {
  let s = {
    "--bg-image": ""
  };
  if (skillCastChatBox[style?.value?.currentBattleCardStyle]) {
    s['--bg-image'] = `url(${skillCastChatBox[style.value.currentBattleCardStyle]})`;
  }
  return s;
}

function getHpPercent(unit: any) {
  if (!unit || !unit.maxHp) return 0;
  if (unit.hp <= 0) return 0;
  let p = Math.round((unit.hp / unit.maxHp) * 100);

  if (p > 100) {
    return 100
  }

  return p
}
function getMpPercent(unit: any) {
  if (!unit || !unit.maxMp) return 0;
  if (unit.mp <= 0) return 0;
  let p = Math.round((unit.mp / unit.maxMp) * 100);

  if (p > 100) {
    return 100
  }

  return p
}

const unitDesc = computed(() => {
  if (props.unit.isPlayer) return '';
  let desc = allGameEnemies[props.unit.id as keyof typeof allGameEnemies]?.description;
  return desc;
});
</script>

<style scoped>
/* 动画相关样式请放在 style 块最前面 */
.fade-line-enter-active,
.fade-line-leave-active {
  transition: opacity 0.4s;
}

.fade-line-enter-from,
.fade-line-leave-to {
  opacity: 0;
}

.damage-float {
  position: absolute;
  right: 15%;
  top: 15%;
  transform: translate(-50%, -60%);
  /* 居中稍微偏上 */
  color: #e34141;
  font-size: 1rem;
  font-weight: bold;
  pointer-events: none;
  animation: damage-float-up 1s ease-in-out forwards;
  text-shadow: 0 2px 8px #fff, 0 0 2px #bb6565;
  z-index: 30;
}

.damage-float-heal {
  color: #4fa72f;
  text-shadow: 0 2px 8px #fff, 0 0 2px #0e6e40;
}

.boss-hp-float {
  position: absolute;
  right: 3%;
  top: 3%;
  transform: translate(0, -50%);
  color: #eaa0a0; /* 淡红 */
  font-size: 0.95rem;
  font-weight: bold;
  pointer-events: none;
  animation: damage-float-up 1s ease-in-out forwards;
  text-shadow: 0 2px 8px #fff, 0 0 2px rgba(242, 140, 140, 0.8);
  z-index: 29;
}

.boss-hp-float--heal {
  color: #7ac97a; /* 淡绿 */
  text-shadow: 0 2px 8px #fff, 0 0 2px rgba(122, 201, 122, 0.9);
}

.boss-hp-float--boss {
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.damage-float-restore-mp {
  color: #2f6da7;
  text-shadow: 0 2px 8px #fff, 0 0 2px #0e2e6e;

  top: 25%;
}

.damage-float-loss-mp {
  color: #2f6da7;
  text-shadow: 0 2px 8px #fff, 0 0 2px #0e2e6e;

  right: 45%;
}

.damage-float-self {
  right: 15%;
  top: 15%;
  transform: translate(-50%, 0) scale(1.1);
  z-index: 20;
  filter: drop-shadow(0 0 6px #fff);
}

@keyframes damage-float-up {
  0% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.2);
  }

  50% {
    opacity: 1;
    transform: translate(-50%, -30px) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -60px) scale(0.9);
  }
}

.glow-current-unit {
  box-shadow: 0 0 10px 3px rgba(0, 220, 90, 0.45), 0 0 0 2px #3cff7a inset;
  transition: box-shadow 0.4s, opacity 0.4s;
  opacity: 1;
}

.glow-heal-target {
  box-shadow: 0 0 14px 4px rgba(0, 220, 90, 0.55), 0 0 0 2px #3cff7a inset;
  transition: box-shadow 0.4s, opacity 0.4s;
  opacity: 1;
}

.glow-damage-target {
  box-shadow: 0 0 7px 2px rgba(255, 56, 56, 0.18), 0 0 0 1px #ffbaba inset;
  transition: box-shadow 0.4s, opacity 0.4s;
  opacity: 1;
}

.dead-unit {
  filter: grayscale(1) brightness(0.7) !important;
  opacity: 0.8 !important;
  /* 可选：让字体颜色更淡 */
  color: #aaa !important;
  /* pointer-events: none; */
}

.fade-mask-enter-active,
.fade-mask-leave-active {
  transition: opacity 0.38s;
}

.fade-mask-enter-from,
.fade-mask-leave-to {
  opacity: 0;
}

.fade-mask-enter-to,
.fade-mask-leave-from {
  opacity: 0.8;
}

.item-use-float {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, 0);
  border-radius: 8px;
  padding: 2px 8px;
  box-shadow: 0 2px 8px #aaa;
  z-index: 40;
  display: flex;
  align-items: center;
  font-weight: bold;
  animation: item-use-float-up 1.2s forwards;
}

@keyframes item-use-float-up {
  0% {
    opacity: 0;
    transform: translate(-50%, 10px);
  }

  20% {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  80% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
}

/* 恢复原有的CSS动画，但调整位置 */
.text-float {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 0);
  border-radius: 8px;
  padding: 6px 8px; /* 减少内边距 */
  text-align: center;
  box-shadow: 0 2px 8px #aaa;
  z-index: 40;
  display: flex;
  align-items: center;
  font-weight: bold;
  animation: text-float-up 1.2s forwards; /* 稍微加快动画 */
  max-width: 120px; /* 限制最大宽度 */
  word-break: break-word; /* 允许换行 */
  line-height: 1.2; /* 紧凑行高 */
}

.skill-cast-float {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 0);
  border-radius: 8px;
  padding: 6px 8px; /* 减少内边距 */
  text-align: center;
  box-shadow: 0 2px 8px #aaa;
  z-index: 40;
  display: flex;
  align-items: center;
  font-weight: bold;
  animation: skill-cast-float-up 1.2s forwards; /* 稍微加快动画 */
  max-width: 120px; /* 限制最大宽度 */
}

/* 优化动画时间，让浮动消失得更快 */
@keyframes text-float-up {
  0% {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
}

@keyframes skill-cast-float-up {
  0% {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
}
</style>

<style lang="scss" scoped>
.battle-unit-card {

  &.world-boss-card {
    transform: scale(1.06);
    // @media (min-width: 768px) {
    //   min-width: 13rem;
    // }
  }

  &.glow-current-unit {
    box-shadow: 0 0 10px 3px rgba(0, 220, 90, 0.45), 0 0 0 2px #69fc98 inset;
    transition: box-shadow 0.4s, opacity 0.4s;
    opacity: 1;
  }

  .battle-unit-card__bg {
    pointer-events: none;
    background-repeat: no-repeat;
  }

  .battle-unit-card__skill-and-state {
    white-space: nowrap;
    word-break: keep-all;

    .battle-unit-card__skill-count {
      color: #3b82f6;

      @at-root .dark & {
        color: #6da3fb;
      }
    }

    .battle-unit-card__skill-count--colddown {
      color: #478bf8;
    }

    .battle-unit-card__state-count {
      .battle-unit-card__state-count--buff {
        color: #49b160;
      }

      .battle-unit-card__state-count--buff-divider {
        color: gray;
      }

      .battle-unit-card__state-count--debuff {
        color: #d6674d;
      }
    }
  }
}


.battle-unit-card--warrior {
  &.glow-current-unit {
    box-shadow: 0 0 6px 2px rgb(255 86 86 / 45%), 0 0 0px 2px #ff4f4f inset;

    .battle-unit-card__bg {
      box-shadow: 0 0 4px 2px #ff3815 inset;
    }
  }

  .battle-unit-card__bg {
    background-image: var(--bg-image);
    opacity: 0.7;
    background-size: 205px;
    background-position: -5px -5px;
    box-shadow: 0 0 6px 1px rgb(248 11 11 / 45%);

    @media (max-width: 768px) {
      background-size: 195px;
      background-position: -45px -2px;
    }
  }

  .battle-unit-card__unit-name {
    :deep(.player-name) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #ff8585;
      }

    :deep(.player-title) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #ff8585;
      }

    :deep(.player-avatar) {
        opacity: 0.88;
        filter: drop-shadow(0px 0px 6px #ff8585);
      }
  }

  .battle-unit-card__hp-mp {

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max,
    .battle-unit-card__mp-current,
    .battle-unit-card__mp-max,
    .battle-unit-card__shield-current {
      opacity: 0.8;
      text-shadow: 0 0 2px #d6ffa1;

      @at-root .dark & {
        opacity: 1;
        text-shadow: 0 0 2px #d6ffa1;
      }
    }

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max {
      text-shadow: 0 0 2px #0d5a00;
      color: #4bff73;

      @at-root .dark & {
        text-shadow: 0 0 6px #5d3535;
        color: #97f0ab;
      }
    }

    .battle-unit-card__shield-current {
      @at-root .dark & {
        opacity: 1;
        text-shadow: 0 0 2px #d40000
      }
    }

    .hp-bar,
    .mp-bar,
    .shield-bar {
      opacity: 0.6;

      @at-root .dark & {
        opacity: 0.7;
      }
    }

  }

  .battle-unit-card__skill-and-state {
    text-shadow: 0 0 4px #630000;
    color: #ffffff;

    .battle-unit-card__skill-count {
      color: #fff;
    }

    .battle-unit-card__skill-count--colddown {
      color: #efefef;
    }

    .battle-unit-card__state-count {

      .battle-unit-card__state-count--buff,
      .battle-unit-card__state-count--buff-divider,
      .battle-unit-card__state-count--debuff {
        color: #fff;
      }
    }

    @at-root .dark & {

      .battle-unit-card__skill-count {
        text-shadow: 0 0 4px #630000;
        color: #fff;
      }
    }
  }

  .text-float,
  .skill-cast-float {
    background-image: var(--bg-image);
    color: #ffffff;
    text-shadow: 0 0 4px #9a0000;
    border-radius: 8px;
    filter: drop-shadow(0px 1px 4px #9a3333);
    background-size: 110px 51px;
    background-position: top;
    width: 110px;
    height: 44px;
    background-repeat: no-repeat;
    box-shadow: none;
    background-color: transparent;
    padding-top: 10px;
  }
}

.battle-unit-card--magical {
  &.glow-current-unit {
    box-shadow: 0 0 6px 2px rgb(46 113 255 / 45%), 0 0 0px 2px #4fbbff inset;

    .battle-unit-card__bg {
      box-shadow: 0 0 4px 2px #4fbbff inset;
    }
  }

  .battle-unit-card__bg {
    background-image: var(--bg-image);
    opacity: 0.8;
    background-size: 310px;
    background-position: -40px -50px;

    box-shadow: 0 0 4px 1px rgb(46 113 255);

    @media (max-width: 768px) {
      background-position: -50px -50px;
    }
  }

  .battle-unit-card__unit-name {
      :deep(.player-name) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #0796ff;
      }

      :deep(.player-title) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #0796ff;
      }

      :deep(.player-avatar) {
        opacity: 0.88;
        filter: drop-shadow(0px 0px 6px #0796ff);
      }
  }

  .battle-unit-card__hp-mp {

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max,
    .battle-unit-card__mp-current,
    .battle-unit-card__mp-max,
    .battle-unit-card__shield-current {
      opacity: 0.8;
      text-shadow: 0 0 2px #e9f2ff;
    }

    .hp-bar,
    .mp-bar,
    .shield-bar {
      opacity: 0.5;
    }

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max {
      opacity: 1;
      text-shadow: 0 0 2px #008d59;
      color: #bdff75;

      @at-root .dark & {
        opacity: 0.8;
        text-shadow: 0 0 2px #008d59;
        color: #bdff75;
      }

      @media (max-width: 768px) {
        opacity: 1;
        text-shadow: 0 0 2px #004bff;
        color: #ffffff;

        @at-root .dark & {
          opacity: 0.8;
          text-shadow: 0 0 2px #67a6ee;
          color: #fff;
        }
      }
    }
  }

  .battle-unit-card__skill-and-state {
    color: white;
    text-shadow: 0 0 4px #0052ff;

    @at-root .dark & {
      text-shadow: 0 0 2px #b3a8ff;
      color: #242424;
    }

    .battle-unit-card__skill-count {
      color: #fff;
    }

    .battle-unit-card__skill-count--colddown {
      color: #efefef;
    }

    .battle-unit-card__state-count {

      .battle-unit-card__state-count--buff,
      .battle-unit-card__state-count--buff-divider,
      .battle-unit-card__state-count--debuff {
        color: #fff;
      }
    }

    @at-root .dark & {
      .battle-unit-card__skill-count {
        text-shadow: 0 0 4px #0b4c61;
        color: #fff;
      }
    }
  }

  .text-float,
  .skill-cast-float {
    background-image: var(--bg-image);
    color: #ffffff;
    text-shadow: 0 0 4px #afc2ff;
    border-radius: 8px;
    filter: drop-shadow(0px 1px 6px #badeff);
    background-size: cover;
    background-position: center;
    width: 115px;
    height: 38px;
    box-shadow: none;
    background-repeat: no-repeat;
    background-color: transparent;
  }
}


.battle-unit-card--cleric {
  &.glow-current-unit {
    box-shadow: 0 0 6px 2px rgb(76 214 197 / 45%), 0 0 0px 2px #4acbc5 inset;


    .battle-unit-card__bg {
      box-shadow: 0 0 6px 3px #61ffe1c4;
    }
  }

  .battle-unit-card__bg {
    background-image: var(--bg-image);
    opacity: 0.8;
    background-size: 205px;
    background-position: -5px -5px;
    box-shadow: 0 0 6px 1px rgb(97 255 225 / 45%);

    @media (max-width: 768px) {
      background-size: 190px;
      background-position: -15px 0px;
    }
  }

    .battle-unit-card__unit-name {
      :deep(.player-name) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #64ecda;
      }
  
      :deep(.player-title) {
        color: #326bb0;
        text-shadow: 0 0 4px #64e0ec;
  
        @at-root .dark & {
          text-shadow: 0 0 2px #4dffff;
          color: #ffffff;
        }
      }
  
      :deep(.player-avatar) {
        opacity: 0.88;
        filter: drop-shadow(0px 0px 6px #64ecda);
      }
    }

  .battle-unit-card__hp-mp {

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max,
    .battle-unit-card__mp-current,
    .battle-unit-card__mp-max,
    .battle-unit-card__shield-current {
      opacity: 0.8;
      text-shadow: 0 0 2px #e9f2ff;

      @at-root .dark & {
        opacity: 1;
        text-shadow: 0 0 2px #ababab;
      }
    }

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max {
      text-shadow: 0 0 2px #45ff6b;
      color: #ffffff;

      @at-root .dark & {
        text-shadow: 0 0 2px #86ffd1;
        color: white;
      }
    }

    .battle-unit-card__shield-current {
      text-shadow: 0 0 4px #ecbd64;
      color: yellow;
    }

    @media (max-width: 768px) {

      .battle-unit-card__hp-current,
      .battle-unit-card__hp-max {
        opacity: 1;
        text-shadow: 0 0 2px #ffffff;
        color: #00701d;

        @at-root .dark & {
          text-shadow: 0 0 2px #007e4e;
          color: #ffffff;
        }
      }
    }

    .hp-bar,
    .mp-bar,
    .shield-bar {
      opacity: 0.7;

      @at-root .dark & {
        opacity: 0.7;
      }
    }

  }

  .battle-unit-card__skill-and-state {
    text-shadow: 0 0 4px #0b4c61;
    color: #ffffff;

    .battle-unit-card__skill-count {
      color: #fff;
    }

    .battle-unit-card__skill-count--colddown {
      color: #efefef;
    }

    .battle-unit-card__state-count {

      .battle-unit-card__state-count--buff,
      .battle-unit-card__state-count--buff-divider,
      .battle-unit-card__state-count--debuff {
        color: #fff;
      }
    }

    @at-root .dark & {
      .battle-unit-card__skill-count {
        text-shadow: 0 0 4px #0b4c61;
        color: #fff;
      }
    }
  }

  .text-float,
  .skill-cast-float {
    background-image: var(--bg-image);
    color: #ffffff;
    text-shadow: 0 0 4px #afffc1;
    border-radius: 8px;
    filter: drop-shadow(0px 1px 6px #afffc1);
    background-size: cover;
    background-position: center;
    width: 115px;
    height: 38px;
    background-repeat: no-repeat;
    box-shadow: none;
    background-color: transparent;
  }
}


.battle-unit-card--ninja {
  &.glow-current-unit {
    box-shadow: 0 0 6px 2px rgb(116 76 214 / 45%), 0 0 0px 2px #5e1a8b inset;


    .battle-unit-card__bg {
      box-shadow: 0 0 6px 3px rgb(152 98 202 / 77%);
    }
  }

  .battle-unit-card__bg {
    background-image: var(--bg-image);
    opacity: 0.9;
    background-size: 200px;
    background-position: 0px -5px;
    box-shadow: 0 0 6px 3px rgb(152 98 202 / 77%);

    @media (max-width: 768px) {
      background-size: 190px;
      background-position: -30px 0px;
    }
  }

    .battle-unit-card__unit-name {
      :deep(.player-name) {
        color: #f3f1ff;
        text-shadow: 0 0 4px #9c64ec;
      }
  
      :deep(.player-title) {
        color: #d6d6d6;
        text-shadow: 0 0 4px #914edc;
  
        @at-root .dark & {
          color: #d6d6d6;
          text-shadow: 0 0 4px #914edc;
        }
      }
  
      :deep(.player-avatar) {
        opacity: 0.88;
        filter: drop-shadow(0px 0px 6px #a570e1);
      }
    }

  .battle-unit-card__hp-mp {

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max,
    .battle-unit-card__mp-current,
    .battle-unit-card__mp-max,
    .battle-unit-card__shield-current {
      opacity: 0.8;
      text-shadow: 0 0 2px #e9f2ff;

      @at-root .dark & {
        opacity: 1;
        text-shadow: 0 0 2px #ababab;
      }
    }

    .battle-unit-card__hp-current,
    .battle-unit-card__hp-max {
      text-shadow: 0 0 2px #45ff6b;
      color: #ffffff;

      @at-root .dark & {
        text-shadow: 0 0 2px #86ffd1;
        color: white;
      }
    }

    .battle-unit-card__shield-current {
      text-shadow: 0 0 4px #ecbd64;
      color: yellow;
    }

    @media (max-width: 768px) {

      .battle-unit-card__hp-current,
      .battle-unit-card__hp-max {
        opacity: 1;
        text-shadow: 0 0 2px #ffffff;
        color: #00701d;

        @at-root .dark & {
          text-shadow: 0 0 2px #007e4e;
          color: #ffffff;
        }
      }
    }

    .hp-bar,
    .mp-bar,
    .shield-bar {
      opacity: 0.7;

      @at-root .dark & {
        opacity: 0.7;
      }
    }

  }

  .battle-unit-card__skill-and-state {
    text-shadow: 0 0 4px #8805b6;
    color: #eeecec;

    .battle-unit-card__skill-count {
      color: #fff;
    }

    .battle-unit-card__skill-count--colddown {
      color: #efefef;
    }

    .battle-unit-card__state-count {

      .battle-unit-card__state-count--buff,
      .battle-unit-card__state-count--buff-divider,
      .battle-unit-card__state-count--debuff {
        color: #fff;
      }
    }

    @at-root .dark & {
      .battle-unit-card__skill-count {
        text-shadow: 0 0 4px #8805b6;
        color: #fff;
      }
    }
  }

  .text-float,
  .skill-cast-float {
    background-image: var(--bg-image);
    color: #e7e7e7;
    text-shadow: 0 0 4px #e7a0ff;
    border-radius: 8px;
    filter: drop-shadow(0px 1px 6px #3e334d);
    background-size: 120px 62px;
    background-position: center;
    width: 120px;
    height: 52px;
    background-repeat: no-repeat;
    box-shadow: none;
    background-color: transparent;
  }
}
</style>