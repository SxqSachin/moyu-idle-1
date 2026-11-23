<template>
  <template v-if="battleInfo && currentBattleRoom">
    <div class="flex flex-col w-full relative py-2">
      <div class="battle-board" ref="battleBoardRef" style="position:relative;">
        <!-- 动画SVG连线层 -->
        <svg ref="svgRef" :width="boardSize.width" :height="boardSize.height"
          style="position: absolute; left: 0; top: 0; pointer-events: none; z-index: 10;">
          <defs>
            <!-- 渐变定义 -->
            <linearGradient v-for="gradient in connectionConfig.gradients" :key="gradient.id" :id="gradient.id" x1="0%"
              y1="0%" x2="100%" y2="0%">
              <stop v-for="stop in gradient.stops" :key="stop.offset" :offset="stop.offset"
                :style="`stop-color:${stop.color};stop-opacity:${stop.opacity}`" />
            </linearGradient>

            <!-- 发光滤镜 -->
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <!-- 箭头标记 -->
            <marker v-for="marker in connectionConfig.markers" :key="marker.id" :id="marker.id"
              :markerWidth="marker.width" :markerHeight="marker.height" :refX="marker.refX" :refY="marker.refY"
              orient="auto">
              <polygon :points="marker.points" :fill="marker.fill" :stroke="marker.stroke"
                :stroke-width="marker.strokeWidth" />
            </marker>
          </defs>
        </svg>

        <!-- 多队横向对阵，每个group一行 -->
        <div class="flex flex-row md:flex-col gap-4 md:gap-24 flex-1 w-full">
          <div v-for="(unitIds, groupId) in battleInfo.groups" :key="groupId"
            class="flex items-center sm:justify-center gap-24">
            <div class="w-20 hidden md:block font-bold text-right text-blue-600 shrink-0 text-xl">
              {{ getGroupName(groupId) }}
            </div>
            <div class="flex-1 flex gap-4 md:gap-8 flex-wrap justify-center">
              <template v-for="unit in getUnitsByGroups(groupId)" :key="unit.uuid">
                <div class="relative h-fit" :class="{ 'dead-unit': unit.hp <= 0 }">
                  <div :ref="el => setUnitRef(unit.uuid, el)" class="unit-card" :data-unit-id="unit.uuid">
                    <GameBattleUnitCard :unit="unit" :current-unit-id="currentUnitId"
                      :text-floats="battleTextFloats[unit.uuid]" :skill-cast-floats="skillCastFloats[unit.uuid]"
                      :item-use-floats="itemUseFloats" :damage-floats="damageFloats[unit.uuid]" />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <transition name="fade-mask">
          <div v-if="currentBattleRoom.status == 'waiting_for_autostart'"
            class="absolute w-full h-full bg-gray-400 z-50 opacity-80 rounded-lg top-0">
            <div class="flex flex-col items-center justify-start h-full mt-64 space-y-4 text-xl">
              <span class="text-white drop-shadow-2xl">等待战斗自动开始...</span>
              <span class="text-white drop-shadow-2xl">{{ autoStartRemainingTime }}</span>
            </div>
          </div>
        </transition>
        <transition name="fade-mask">
          <div v-if="currentBattleRoom.status == 'waiting_for_restart'"
            class="absolute w-full h-full bg-gray-400 z-50 opacity-80 rounded-lg top-0">
            <div class="flex flex-col items-center justify-start h-full mt-64 space-y-4 text-xl">
              <span class="text-white drop-shadow-2xl">等待战斗自动重开...</span>
              <span class="text-white drop-shadow-2xl">{{ autoRestartRemainingTime }}</span>
            </div>
          </div>
        </transition>

      </div>
      <el-empty v-if="!battleInfo" description="暂无战斗信息" />

    </div>
  </template>
  <template v-if="currentBattleRoom && currentBattleRoom.status == 'go_to_area'">
    <transition name="fade-mask">
      <div class="absolute h-full w-full h-48 bg-gray-400 z-50 opacity-80 rounded-lg top-0">
        <div class="flex flex-col items-center justify-center h-full space-y-4">
          <span class="text-white drop-shadow-2xl">正在前往{{ allBattleAreas[currentBattleRoom.area]?.name ?? '' }}</span>
        </div>
      </div>
    </transition>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";
import type { FuncAction } from "~/shared/types";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { onAddState, onBattleFloatText, onBattleInfoDetail, onCastSkill, onDealDamage, onDrawLine, onGiveBattleExpReward, onGiveBattleResourceReward, onHeal, onLossMp, onRestoreMp, onUseBattleItem } from "~/api/game/socket/battle";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import type { AllBattleSkillId } from "~/shared/types/skill";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import type { BaseBattleUnit } from "~/shared/types/unit";
import type { BattleInfo } from "~/shared/types/battle";

// ==================== 类型定义 ====================

type ConnectionType = 'damage' | 'heal' | 'state' | 'buff' | 'debuff' | 'manual';

interface ConnectionStyle {
  stroke: string;
  strokeWidth: number;
  markerEnd: string;
  dashArray?: string;
  shadowColor: string;
}

interface AnimatedLine {
  id: string;
  type: ConnectionType;
  fromUnitId: string;
  toUnitId: string;
  shadowElement: SVGLineElement;
  mainElement: SVGLineElement;
  timeline: gsap.core.Timeline;
}

interface GradientStop {
  offset: string;
  color: string;
  opacity: number;
}

interface GradientConfig {
  id: string;
  stops: GradientStop[];
}

interface MarkerConfig {
  id: string;
  width: number;
  height: number;
  refX: number;
  refY: number;
  points: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

interface AnimationTiming {
  extend: number;
  hold: number;
  retract: number;
}

interface ConnectionConfig {
  gradients: GradientConfig[];
  markers: MarkerConfig[];
  styles: Record<ConnectionType, ConnectionStyle>;
  animations: {
    timing: AnimationTiming;
    easing: {
      extend: string;
      hold: string;
      retract: string;
    };
  };
}

// ==================== 连线配置 ====================

const connectionConfig: ConnectionConfig = {
  gradients: [
    {
      id: 'damageGradient',
      stops: [
        { offset: '0%', color: '#ff4444', opacity: 0.3 },
        { offset: '50%', color: '#ff4444', opacity: 1 },
        { offset: '100%', color: '#ff8888', opacity: 0.8 }
      ]
    },
    {
      id: 'healGradient',
      stops: [
        { offset: '0%', color: '#44ff44', opacity: 0.3 },
        { offset: '50%', color: '#44ff44', opacity: 1 },
        { offset: '100%', color: '#88ff88', opacity: 0.8 }
      ]
    },
    {
      id: 'stateGradient',
      stops: [
        { offset: '0%', color: '#44acaa', opacity: 0.3 },
        { offset: '50%', color: '#44acaa', opacity: 1 },
        { offset: '100%', color: '#88ccca', opacity: 0.8 }
      ]
    }
  ],
  markers: [
    {
      id: 'arrowhead-damage',
      width: 16,  // 增加宽度
      height: 16, // 增加高度
      refX: 13,   // 调整参考点X
      refY: 4,    // 调整参考点Y
      points: '0 0, 13 4, 0 8', // 调整多边形点坐标
      fill: 'url(#damageGradient)',
      stroke: '#ff4444',
      strokeWidth: 0.8 // 稍微增加描边宽度
    },
    {
      id: 'arrowhead-heal',
      width: 16,
      height: 16,
      refX: 13,
      refY: 4,
      points: '0 0, 13 4, 0 8',
      fill: 'url(#healGradient)',
      stroke: '#44ff44',
      strokeWidth: 0.8
    },
    {
      id: 'arrowhead-state',
      width: 16,
      height: 16,
      refX: 13,
      refY: 4,
      points: '0 0, 13 4, 0 8',
      fill: 'url(#stateGradient)',
      stroke: '#44acaa',
      strokeWidth: 0.8
    }
  ],
  styles: {
    damage: {
      stroke: 'url(#damageGradient)',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-damage)',
      // dashArray: '8,4',
      shadowColor: '#ff4444'
    },
    heal: {
      stroke: 'url(#healGradient)',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-heal)',
      shadowColor: '#44ff44'
    },
    state: {
      stroke: 'url(#stateGradient)',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-state)',
      // dashArray: '6,3',
      shadowColor: '#44acaa'
    },
    buff: {
      stroke: 'url(#stateGradient)',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-state)',
      // dashArray: '6,3',
      shadowColor: '#44acaa'
    },
    debuff: {
      stroke: 'url(#stateGradient)',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-state)',
      // dashArray: '6,3',
      shadowColor: '#44acaa'
    },
    manual: {
      stroke: '#ffaa00',
      strokeWidth: 1,
      markerEnd: 'url(#arrowhead-damage)',
      // dashArray: '4,2',
      shadowColor: '#ffaa00'
    }
  },
  animations: {
    timing: {
      extend: 0.62,
      hold: 0.3,
      retract: 0.2
    },
    easing: {
      extend: 'power2.out',
      hold: 'none',
      retract: 'power2.in'
    }
  }
};

// ==================== 组件状态 ====================

const currentBattleRoom = useCurrentBattleRoom()
// const battleInfo = useBattleInfo();

const isBackend = ref(false);

const props = defineProps<{
  battleInfo?: BattleInfo | null;
}>();

const battleInfo = toRef(props, 'battleInfo');

const currentUnitId = computed(() => {
  // if (thisRoundAction.value?.sourceUnitUuid) return thisRoundAction.value.sourceUnitUuid;
  return battleInfo.value?.turnOrder?.[battleInfo.value?.currentTurnIndex ?? 0];
});

// 面板和引用
const battleBoardRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGElement | null>(null);
const unitRefs = ref<Record<string, HTMLElement | null>>({});
const boardSize = ref({ width: 800, height: 600 });
const activeLines = ref<AnimatedLine[]>([]);

// 浮动数字
const damageFloats = ref<Record<string, Array<{ value: number, key: number, type: 'damage' | 'shieldDamage' | 'heal' | 'restoreMp' | 'lossMp' }>>>({});
const itemUseFloats = ref<Record<string, { itemId: AllGameResourceID; key: number }>>({});
const skillCastFloats = ref<Record<string, { skillId: AllBattleSkillId; key: number }[]>>({});
const battleTextFloats = ref<Record<string, { text: string; key: string }[]>>({});

// 时间相关
const now = ref(Date.now());
let timer: number | null = null;
let battleEventUnsubscribers: FuncAction[] = [];

// ==================== 核心函数 ====================

function getUnitsByGroups(groupId: string) {
  if (!battleInfo.value) return [];
  const unitInGroup = battleInfo.value.groups[groupId];
  return battleInfo.value.members.filter(unit => unitInGroup.includes(unit.uuid));
}

function getGroupName(groupId: string) {
  if (groupId === battleInfo.value?.playerGroupId) return "我方";
  return "敌方";
}

function updateBoardSize() {
  if (battleBoardRef.value) {
    const rect = battleBoardRef.value.getBoundingClientRect();
    boardSize.value = {
      width: Math.max(rect.width, 100),
      height: Math.max(rect.height, 100),
    };
  }
}

function getUnitPosition(unitId: string): { x: number; y: number } | null {
  const unitEl = unitRefs.value[unitId];
  const boardEl = battleBoardRef.value;
  
  if (!unitEl || !boardEl) return null;

  try {
    const boardRect = boardEl.getBoundingClientRect();
    const unitRect = unitEl.getBoundingClientRect();
    
    return {
      x: unitRect.left - boardRect.left + unitRect.width / 2,
      y: unitRect.top - boardRect.top + unitRect.height / 2,
    };
  } catch (error) {
    console.error('计算位置时出错:', error);
    return null;
  }
}

function setUnitRef(uuid: string, el: any) {
  if (el) {
    unitRefs.value[uuid] = el;
  } else if (unitRefs.value[uuid]) {
    delete unitRefs.value[uuid];
  }
}

function getConnectionStyle(type: ConnectionType): ConnectionStyle {
  return connectionConfig.styles[type] || connectionConfig.styles.damage;
}

function createAnimatedLine(fromUnitId: string, toUnitId: string, type: ConnectionType, color?: string) {
  if (!svgRef.value) return;

  if (isBackend.value) return;

  nextTick(() => {
    updateBoardSize();
    
    const fromPos = getUnitPosition(fromUnitId);
    const toPos = getUnitPosition(toUnitId);
    
    if (!fromPos || !toPos) return;
    
    const style = getConnectionStyle(type);
    const lineId = `line-${Date.now()}-${Math.random()}`;
    
    // 创建阴影线
    const shadowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    shadowLine.setAttribute('x1', fromPos.x.toString());
    shadowLine.setAttribute('y1', fromPos.y.toString());
    shadowLine.setAttribute('x2', fromPos.x.toString());
    shadowLine.setAttribute('y2', fromPos.y.toString());
    shadowLine.setAttribute('stroke', style.shadowColor);
    shadowLine.setAttribute('stroke-width', (style.strokeWidth + 1).toString()); // 减少阴影线宽度差异
    shadowLine.setAttribute('opacity', '0');
    shadowLine.setAttribute('stroke-linecap', 'round');
    if (style.dashArray) {
      shadowLine.setAttribute('stroke-dasharray', style.dashArray);
    }

    // 创建主线
    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mainLine.setAttribute('x1', fromPos.x.toString());
    mainLine.setAttribute('y1', fromPos.y.toString());
    mainLine.setAttribute('x2', fromPos.x.toString());
    mainLine.setAttribute('y2', fromPos.y.toString());
    mainLine.setAttribute('stroke', style.stroke);
    mainLine.setAttribute('stroke-width', style.strokeWidth.toString());
    mainLine.setAttribute('opacity', '0');
    mainLine.setAttribute('marker-end', style.markerEnd);
    mainLine.setAttribute('stroke-linecap', 'round');
    if (style.dashArray) {
      mainLine.setAttribute('stroke-dasharray', style.dashArray);
    }

    svgRef.value!.appendChild(shadowLine);
    svgRef.value!.appendChild(mainLine);

    // 创建动画
    const animData = {
      extendProgress: 0,
      retractProgress: 0,
      opacity: 0,
      dashOffset: 0
    };

    const timeline = gsap.timeline({
      onComplete: () => {
        shadowLine.remove();
        mainLine.remove();
        const index = activeLines.value.findIndex(line => line.id === lineId);
        if (index !== -1) {
          activeLines.value.splice(index, 1);
        }
      }
    });

    const { timing, easing } = connectionConfig.animations;

    // 延伸动画
    timeline.to(animData, {
      duration: timing.extend,
      ease: easing.extend,
      extendProgress: 1,
      opacity: 0.9,
      onUpdate: () => {
        const progress = animData.extendProgress;
        const currentX2 = fromPos.x + (toPos.x - fromPos.x) * progress;
        const currentY2 = fromPos.y + (toPos.y - fromPos.y) * progress;
        
        shadowLine.setAttribute('x2', currentX2.toString());
        shadowLine.setAttribute('y2', currentY2.toString());
        shadowLine.setAttribute('opacity', animData.opacity.toString());
        
        mainLine.setAttribute('x2', currentX2.toString());
        mainLine.setAttribute('y2', currentY2.toString());
        mainLine.setAttribute('opacity', animData.opacity.toString());
        
        if (style.dashArray) {
          const offset = -progress * 30;
          shadowLine.setAttribute('stroke-dashoffset', offset.toString());
          mainLine.setAttribute('stroke-dashoffset', offset.toString());
        }
      }
    });

    // 停留动画 - 移除脉冲效果
    timeline.to(animData, {
      duration: timing.hold,
      ease: easing.hold,
      dashOffset: -20,
      onUpdate: () => {
        // 只保留虚线流动效果，移除脉冲
        if (style.dashArray) {
          shadowLine.setAttribute('stroke-dashoffset', animData.dashOffset.toString());
          mainLine.setAttribute('stroke-dashoffset', animData.dashOffset.toString());
        }
        
        // 移除这段脉冲代码
        // const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 1;
        // shadowLine.setAttribute('stroke-width', ((style.strokeWidth + 2) * pulse).toString());
      }
    });

    // 收缩消失动画
    timeline.to(animData, {
      duration: timing.retract,
      ease: easing.retract,
      retractProgress: 1,
      opacity: 0,
      dashOffset: -40,
      onUpdate: () => {
        const progress = animData.retractProgress;
        const currentX1 = fromPos.x + (toPos.x - fromPos.x) * progress;
        const currentY1 = fromPos.y + (toPos.y - fromPos.y) * progress;
        
        shadowLine.setAttribute('x1', currentX1.toString());
        shadowLine.setAttribute('y1', currentY1.toString());
        shadowLine.setAttribute('opacity', animData.opacity.toString());
        // 保持固定宽度，不再动态变化
        // shadowLine.setAttribute('stroke-width', ((style.strokeWidth + 1) * (1 - progress * 0.3)).toString());
        
        mainLine.setAttribute('x1', currentX1.toString());
        mainLine.setAttribute('y1', currentY1.toString());
        mainLine.setAttribute('opacity', animData.opacity.toString());
        // mainLine.setAttribute('stroke-width', (style.strokeWidth * (1 - progress * 0.2)).toString());
        
        if (style.dashArray) {
          shadowLine.setAttribute('stroke-dashoffset', animData.dashOffset.toString());
          mainLine.setAttribute('stroke-dashoffset', animData.dashOffset.toString());
        }
      }
    });

    const animatedLine: AnimatedLine = {
      id: lineId,
      type,
      fromUnitId,
      toUnitId,
      shadowElement: shadowLine,
      mainElement: mainLine,
      timeline
    };
    
    activeLines.value.push(animatedLine);
  });
}

function clearAllLines() {
  activeLines.value.forEach(line => {
    line.timeline.kill();
    line.shadowElement.remove();
    line.mainElement.remove();
  });
  activeLines.value = [];
}

function showDamageFloat(targetUuid: string, value: number, type: 'damage' | 'shieldDamage' | 'heal' | 'restoreMp' | 'lossMp') {
  if (!value) return;
  if (isBackend.value) return;

  const key = Date.now() + Math.random();
  if (!damageFloats.value[targetUuid]) {
    damageFloats.value[targetUuid] = [];
  }
  damageFloats.value[targetUuid].push({ value, key, type });
  setTimeout(() => {
    const arr = damageFloats.value[targetUuid];
    if (arr) {
      damageFloats.value[targetUuid] = arr.filter(f => f.key !== key);
      if (damageFloats.value[targetUuid].length === 0) {
        delete damageFloats.value[targetUuid];
      }
    }
  }, 1000);
}

// ==================== 监听器和生命周期 ====================

function handleResize() {
  updateBoardSize();
}

// 清理单位引用
watch(
  () => battleInfo.value?.members.map(u => u.uuid),
  (uuids) => {
    Object.keys(unitRefs.value).forEach(uuid => {
      if (!uuids?.includes(uuid)) {
        unitRefs.value[uuid] = null;
        delete unitRefs.value[uuid];
      }
    });
  }
);

// 战斗信息变化时清理
watch(
  () => battleInfo.value,
  (newBattleInfo, old) => {
    if (!!newBattleInfo?.uuid && !!old?.uuid && newBattleInfo?.uuid != old?.uuid) {
      unitRefs.value = {};
      clearAllLines();
    }
  }
);

const handleVisibilityChange = () => {
  isBackend.value = document.hidden
}

onMounted(async () => {
  await waitUtilConnected();
  
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);

  window.addEventListener('resize', handleResize);

  document.addEventListener('visibilitychange', handleVisibilityChange);

  nextTick(() => {
    updateBoardSize();
  });

  // 注册战斗事件监听器
  battleEventUnsubscribers = [
    onUseBattleItem((data) => {
      if (isBackend.value) return;
      itemUseFloats.value[data.user] = { itemId: data.itemId, key: Date.now() + Math.random() };
      setTimeout(() => {
        if (itemUseFloats.value[data.user]?.key === itemUseFloats.value[data.user]?.key) {
          delete itemUseFloats.value[data.user];
        }
      }, 1300);
    }),

    onHeal(data => {
      if (isBackend.value) return;
      showDamageFloat(data.target, data.value, 'heal');
      if (data.source !== data.target) {
        createAnimatedLine(data.source, data.target, 'heal');
      }
    }),

    onLossMp(data => {
      if (isBackend.value) return;
      showDamageFloat(data.target, data.value, 'lossMp');
    }),

    onRestoreMp(data => {
      if (isBackend.value) return;
      showDamageFloat(data.target, data.value, 'restoreMp');
    }),

    onCastSkill(data => {
      if (isBackend.value) return;
      if (!skillCastFloats.value[data.source]) {
        skillCastFloats.value[data.source] = [];
      }
      const key = Date.now() + Math.random();
      skillCastFloats.value[data.source].push({ skillId: data.skillId, key: key });
      setTimeout(() => {
        skillCastFloats.value[data.source] = skillCastFloats.value[data.source].filter(i => i.key !== key);
      }, 1300);
    }),

    onBattleFloatText(data => {
      if (isBackend.value) return;
      let key = Date.now() + '|' + Math.random();
      if (!battleTextFloats.value[data.unit]) {
        battleTextFloats.value[data.unit] = [];
      }
      battleTextFloats.value[data.unit].push({ text: data.text, key });
      setTimeout(() => {
        battleTextFloats.value[data.unit] = battleTextFloats.value[data.unit].filter(i => i.key !== key);
      }, 1300);
    }),

    onDealDamage(data => {
      if (isBackend.value) return;

      for(const targetUuid of data.target) {
        let unit = battleInfo.value?.members.find(u => u.uuid === targetUuid.unit);

        if (unit) {
          // unit.hp -= targetUuid.value
          // unit.hp = Math.max(0, unit.hp);
        }
      }

      Object.values(data.target).forEach(damageDetail => {
        showDamageFloat(damageDetail.unit, damageDetail.value, 'damage');
        if (damageDetail.shieldDamage) {
          showDamageFloat(damageDetail.unit, damageDetail.shieldDamage, 'shieldDamage');
        }

        if (!data.hideAnimEffect_Line) {
          createAnimatedLine(data.source, damageDetail.unit, 'damage');
        }
      });
    }),

    onAddState(data => {
      if (isBackend.value) return;
      if (data.source !== data.target) {
        createAnimatedLine(data.source, data.target, 'state');
      }
    }),

    onDrawLine(data => {
      if (isBackend.value) return;
      createAnimatedLine(data.source, data.target, 'manual', data.color);
    })
  ];
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  window.removeEventListener('resize', handleResize);

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  battleEventUnsubscribers.forEach(unsubscribe => unsubscribe?.());
  battleEventUnsubscribers = [];

  clearAllLines();
  unitRefs.value = {};
});

// ==================== 计算属性和辅助函数 ====================

const autoRestartRemainingTime = computed(() => {
  if (!currentBattleRoom.value || currentBattleRoom.value.status !== 'waiting_for_restart') return '';
  if (!currentBattleRoom.value.waitingForRestartTime || currentBattleRoom.value.waitingForRestartTime <= 0) {
    return '';
  }
  return '剩余:' + Math.abs((currentBattleRoom.value.waitingForRestartTime - now.value) / 1000).toFixed(0) + '秒';
});

const autoStartRemainingTime = computed(() => {
  if (!currentBattleRoom.value || currentBattleRoom.value.status !== 'waiting_for_autostart') return '';
  if (!currentBattleRoom.value.waitingForAutoStartTime || currentBattleRoom.value.waitingForAutoStartTime <= 0) {
    return '';
  }
  return '剩余:' + Math.abs((currentBattleRoom.value.waitingForAutoStartTime - now.value) / 1000).toFixed(0) + '秒';
});


const getUnitSkills = (unit: BaseBattleUnit) => {
  return Object.entries(unit?.skills ?? {})
    .filter(([id]) => id !== 'baseAttack')
    .toSorted((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
};
</script>

<style scoped>
.fade-mask-enter-active, .fade-mask-leave-active {
  transition: opacity 0.38s;
}
.fade-mask-enter-from, .fade-mask-leave-to {
  opacity: 0;
}
.fade-mask-enter-to, .fade-mask-leave-from {
  opacity: 0.8;
}

.unit-card {
  border: 2px solid transparent;
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

.dead-unit {
  filter: grayscale(1) brightness(0.7) !important;
  opacity: 0.8 !important;
  color: #aaa !important;
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
  animation: item-use-float-up 1.38s;
}

@keyframes item-use-float-up {
  0% { opacity: 0; transform: translate(-50%, 10px);}
  20% { opacity: 1; transform: translate(-50%, 0);}
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -10px);}
}

.skill-cast-float {
  position: absolute;
  left: 50%;
  top: 8%;
  transform: translate(-50%, 0);
  border-radius: 8px;
  padding: 8px 8px;
  text-align: center;
  box-shadow: 0 2px 8px #aaa;
  z-index: 40;
  display: flex;
  align-items: center;
  font-weight: bold;
  animation: skill-cast-float-up 1.38s;
}

@keyframes skill-cast-float-up {
  0% { opacity: 0; transform: translate(-50%, 10px);}
  20% { opacity: 1; transform: translate(-50%, 0);}
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -10px);}
}
</style>