<template>
  <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <template v-if="shouldRenderPopover" #reference>
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ getStateName(stateId) }}
        </span>
        <span v-if="stateInBattle">
          <span v-if="stateInBattle.extra?.stack">
            <span class="text-xs">[{{ stateInBattle.extra.stack }}]</span>
          </span>
          <span v-if="!stateInfo?.permanent">
            ({{ stateInBattle.remainingDuration }} / {{ stateInBattle.duration }})
          </span>
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="stateInfo?.isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ getStateName(stateId) }}
          <span v-if="stateInBattle">
            <span v-if="stateInBattle.extra?.stack">
              <span class="text-xs">[{{ stateInBattle.extra.stack }}]</span>
            </span>
            <span v-if="!stateInfo?.permanent">
              ({{ stateInBattle.remainingDuration }} / {{ stateInBattle.duration }})
            </span>
          </span>
        </el-tag>
      </template>
    </template>

    <!-- 当不是 popover 时的内容 -->
    <template v-if="!shouldRenderPopover">
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ getStateName(stateId) }}
        </span>
        <span v-if="stateInBattle">
          <span v-if="stateInBattle.extra?.stack">
            <span class="text-xs">[{{ stateInBattle.extra.stack }}]</span>
          </span>
          <span>
            ({{ stateInBattle.remainingDuration }} / {{ stateInBattle.duration }})
          </span>
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="stateInfo?.isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ getStateName(stateId) }}
          <span v-if="stateInBattle">
            <span v-if="stateInBattle.extra?.stack">
              <span class="text-xs">[{{ stateInBattle.extra.stack }}]</span>
            </span>
            <span v-if="!stateInfo?.permanent">
              ({{ stateInBattle.remainingDuration }} / {{ stateInBattle.duration }})
            </span>
          </span>
        </el-tag>
      </template>
    </template>

    <!-- popover 内容 -->
    <template v-if="shouldRenderPopover">
      <div>
        <div class="font-bold mb-1">{{ getStateName(stateId) }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400" v-html="stateInfo?.description.replace(/\n/g, '<br/>')"></div>
        <div v-if="stateInfo?.isBuff" class="text-green-500 text-xs mt-1">增益</div>
        <div v-if="stateInfo?.isDebuff" class="text-red-500 text-xs mt-1">减益</div>
        <div class="mt-4 space-y-1 text-xs empty:hidden">
          <div v-if="stateInBattle && !stateInfo?.permanent">剩余回合: {{ stateInBattle.remainingDuration }}</div>
          <div v-if="stateInBattle?.extra?.thisStateActuralValue">数值: {{ getExtraActuralValue(stateInBattle) }} {{ getExtraActuralValueUnit(stateInBattle) }}</div>
          <div v-if="stateInBattle?.extra?.remainingTimes">剩余次数 {{ stateInBattle.extra.remainingTimes }}</div>
          <div v-if="stateInBattle?.extra?.readableDesc">
            <div v-for="(v, k) in stateInBattle.extra.readableDesc" class="text-gray-600">
              {{ k }}: {{ v }}
            </div>
          </div>
          <div v-if="stateInBattle?.extra?.stack">
            层数: {{ stateInBattle?.extra?.stack }}
          </div>
        </div>
      </div>
    </template>
  </component>

</template>
<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { allBattleState } from '~/shared/data/allBattleState';
import type { AllBattleStateId, BattleState, BattleStateInBattle } from '~/shared/types/BattleState';
import type { UnitBattleState } from '~/shared/types/unit';

defineComponent({
  inheritAttrs: true
})

const props = defineProps<{
  stateId: AllBattleStateId

  stateInBattle?: BattleStateInBattle

  delay?: number

  plain?: boolean

  trigger?: 'hover' | 'click' 
}>();

const state = computed(() => {
  return allBattleState[props.stateId] as UnitBattleState | undefined;
});

const stateInfo = computed(() => {
  return allBattleState[props.stateId] as BattleState | undefined
});

function getStateName(stateId: AllBattleStateId) {
  return allBattleState[stateId].name || stateId;
}
function getStateInfo(stateId: AllBattleStateId) {
  return allBattleState[stateId];
}
function getExtraActuralValue(state: BattleStateInBattle) {
  let unit = state.extra?.thisStateActuralValueUnit;
  let value = state.extra?.thisStateActuralValue ?? 0
  if (!unit) {
    return value.toFixed(2)
  }

  if (unit == 'percent') {
    return (value * 100).toFixed(2)
  }

  return value
}
function getExtraActuralValueUnit(state: BattleStateInBattle) {
  let unit = state.extra?.thisStateActuralValueUnit;
  if (!unit) {
    return ''
  }

  if (unit == 'percent') {
    return '%'
  }

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