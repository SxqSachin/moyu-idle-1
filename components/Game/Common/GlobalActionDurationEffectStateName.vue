<template>
  <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <template v-if="shouldRenderPopover" #reference>
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ stateName }}
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="state.isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ stateName }}
        </el-tag>
      </template>
    </template>

    <!-- 当不是 popover 时的内容 -->
    <template v-if="!shouldRenderPopover">
      <template v-if="plain">
        <span class="w-full inline-block">
          {{ stateName }}
        </span>
      </template>
      <template v-else>
        <el-tag v-if="state" :type="state.isBuff ? 'success' : 'warning'" :disable-transitions="true">
          {{ stateName }}
        </el-tag>
      </template>
    </template>

    <!-- popover 内容 -->
    <template v-if="shouldRenderPopover">
      <div>
        <div class="font-bold mb-1">{{ stateName }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400" v-html="state.description.replace(/\n/g, '<br/>')"></div>
        <div v-if="state.isBuff" class="text-green-500 text-xs mt-1">增益</div>
        <div v-if="state.isDebuff" class="text-red-500 text-xs mt-1">减益</div>
        <!-- <div class="mt-4 space-y-1 text-xs empty:hidden">
          <div v-for="effect of stateEffect" :key="effect.actionId" class="flex flex-row gap-1">
            <GameCommonActionNameAndIcon :action-id="effect.actionId"></GameCommonActionNameAndIcon>
            <span>执行速度 {{  getExtraActuralValue(effect) }}%</span>
          </div>
        </div> -->
      </div>
    </template>
  </component>

</template>
<script setup lang="tsx">
import { ElPopover } from 'element-plus';
import { allBattleState, allGlobalActionEffectState, allGlobalStatusEffectState } from '~/shared/data/allBattleState';
import type { AllBattleStateId, AllGlobalActionDurationEffectStateId, AllGlobalEffectStateId, BattleState, BattleStateInBattle } from '~/shared/types/BattleState';
import type { PlayerState } from '~/shared/types/characterInfo';
import type { GameGlobalEffectActionAboutAction, GameEffectActionAboutGlobalState } from '~/shared/types/gameEffect';
import type { UnitBattleState } from '~/shared/types/unit';

defineComponent({
  inheritAttrs: true
})

// type GlobalActionDurationEffect = NonNullable<NonNullable<PlayerState['global']>['actionDurationEffect']>[number]['effect']
const props = defineProps<{
  stateId: AllGlobalActionDurationEffectStateId

  // stateEffect?: GlobalActionDurationEffect

  delay?: number

  plain?: boolean

  trigger?: 'hover' | 'click' 
}>();

const state = computed(() => {
  return allGlobalActionEffectState[props.stateId] as BattleState
});

const stateName = computed(() => {
  return state.value.name
})

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