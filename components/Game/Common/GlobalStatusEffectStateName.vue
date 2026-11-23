<template>
  <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <template v-if="shouldRenderPopover" #reference>
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ getStateName(stateId) }}
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="getStateInfo(stateId).isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ getStateName(stateId) }}
        </el-tag>
      </template>
    </template>

    <!-- 当不是 popover 时的内容 -->
    <template v-if="!shouldRenderPopover">
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ getStateName(stateId) }}
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="getStateInfo(stateId).isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ getStateName(stateId) }}
        </el-tag>
      </template>
    </template>

    <!-- popover 内容 -->
    <template v-if="shouldRenderPopover">
      <div>
        <div class="font-bold mb-1">{{ getStateName(stateId) }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400" v-html="getStateInfo(stateId).description.replace(/\n/g, '<br/>')"></div>
        <div v-if="getStateInfo(stateId).isBuff" class="text-green-500 text-xs mt-1">增益</div>
        <div v-if="getStateInfo(stateId).isDebuff" class="text-red-500 text-xs mt-1">减益</div>
        <div class="mt-4 space-y-1 text-xs empty:hidden">
          <div v-if="stateInBattle?.value">数值: {{ getExtraActuralValue(stateInBattle) }} {{ getExtraActuralValueUnit(stateInBattle) }}</div>
        </div>
      </div>
    </template>
  </component>

</template>
<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { allBattleState, allGlobalStatusEffectState } from '~/shared/data/allBattleState';
import type { AllBattleStateId, AllGlobalEffectStateId, BattleState, BattleStateInBattle } from '~/shared/types/BattleState';
import type { PlayerState } from '~/shared/types/characterInfo';
import type { GameEffectActionAboutGlobalState } from '~/shared/types/gameEffect';
import type { UnitBattleState } from '~/shared/types/unit';

defineComponent({
  inheritAttrs: true
})

type GlobalStatusStateEffect = NonNullable<NonNullable<PlayerState['global']>['statusEffect']>[number]
const props = defineProps<{
  stateId: AllGlobalEffectStateId

  stateEffect?: GlobalStatusStateEffect

  delay?: number

  plain?: boolean

  trigger?: 'hover' | 'click' 
}>();

const state = computed(() => {
  return allGlobalStatusEffectState[props.stateId] as BattleState
});

const stateInBattle = computed(() => {
  return props.stateEffect
});

function getStateName(stateId: AllGlobalEffectStateId) {
  return allGlobalStatusEffectState[stateId].name || stateId;
}
function getStateInfo(stateId: AllGlobalEffectStateId) {
  return allGlobalStatusEffectState[stateId];
}
function getExtraActuralValue(state: GlobalStatusStateEffect) {
  // let unit = state.value
  // let value = state.extra?.thisStateActuralValue ?? 0
  // if (!unit) {
  //   return value.toFixed(2)
  // }

  // if (unit == 'percent') {
  //   return (value * 100).toFixed(2)
  // }

  return state.value.toFixed(2);
}
function getExtraActuralValueUnit(state: GlobalStatusStateEffect) {
  // let unit = state.extra?.thisStateActuralValueUnit;
  // if (!unit) {
  //   return ''
  // }

  // if (unit == 'percent') {
  //   return '%'
  // }

  return ''
}

const shouldRenderPopover = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const popoverProps = computed(() => {
  if (!shouldRenderPopover.value) return {}

  return {
    placement: "bottom",
    trigger: props.trigger ?? "hover",
    transition: "el-fade-in",
    showAfter: props.delay ?? 380,
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

onUnmounted(() => {
  // 清除定时器
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
    hoverTimer.value = null
  }
  shouldRenderPopover.value = false
})

</script>