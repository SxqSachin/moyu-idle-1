<template>
  <template v-if="battleInfo && currentBattleRoom">
    <div class="flex flex-col w-full relative">
      <!-- 战斗日志区域 -->
      <el-card class="mb-4">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-bold">战斗日志</span>
            <div class="flex space-x-2">
              <el-button size="small" @click="clearBattleLog">清空日志</el-button>
              <el-button size="small" :type="autoScroll ? 'primary' : 'default'" @click="toggleAutoScroll">
                {{ autoScroll ? '关闭自动滚动' : '开启自动滚动' }}
              </el-button>
              <el-button size="small" @click="downloadBattleLog">导出文本</el-button>
            </div>
          </div>
        </template>
        
        <div class="battle-log-container">
          <!-- 性能状态显示 -->
          <div class="text-xs text-gray-500 mb-2 px-2">
            日志: {{ performanceStats.logCount }} | 压缩: {{ performanceStats.compressedCount }}
          </div>
          
          <DynamicScroller
            :items="battleLogs"
            key-field="id"
            :min-item-size="60"
            ref="scrollerRef"
            class="scroller"
            style="height: 600px;"
            :buffer="10"
            :prerender="5"
          >
            <template #default="{ item: log, index }">
              <DynamicScrollerItem
                :item="log"
                :active="true"
                :size-dependencies="[
                  log.props?.targetUnits?.length || 1,
                  log.props?.text?.length || 1,
                  log.type
                ]"
              >
                <div :key="log.id" class="battle-log-item border-b border-gray-300 py-2"
                :class="{
                  'pb-8 border-b-4': log.type == 'PLAYER_WIN',
                  'border-t border-b-1 border-t-2': log.type == 'turn-start',
                  'border-b border-t-1 border-b-2': log.type == 'turn-end',
                }">
                  <div class="flex items-start space-x-2">
                    <span class="text-xs text-gray-400 mt-1 w-16 flex-shrink-0">
                      {{ formatLogTime(log.timestamp) }}
                    </span>
                    <div class="flex-1">
                      <component :is="log.component" v-bind="log.props" />
                    </div>
                  </div>
                </div>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>
        </div>
      </el-card>

      <el-empty v-if="!battleInfo" description="暂无战斗信息" />
    </div>
  </template>
  <template v-if="currentBattleRoom && currentBattleRoom.status == 'go_to_area'">
    <transition name="fade-mask">
      <div class="w-full h-48 bg-gray-400 z-50 opacity-80 rounded-lg top-0">
        <div class="flex flex-col items-center justify-center h-full space-y-4">
          <span class="text-white drop-shadow-2xl">正在前往{{ allBattleAreas[currentBattleRoom.area]?.name ?? '' }}</span>
        </div>
      </div>
    </transition>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, h } from "vue";
import { ElMessage } from 'element-plus';
// virtual scroller (vue-virtual-scroller@next)
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { FuncAction } from "~/shared/types";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { BattleStatus, type FullBattleAction } from "~/shared/types/battle";
import { emitBattleLeave, emitStopBattle, onAddState, onBattleBegin, onBattleEndSuccess, onBattleFloatText, onBattleInfoDetail, onBattlePrepareBegin, onBattlePrepareEnd, onCastSkill, onDealDamage, onDispatchBattleFullInfoSuccess, onGiveBattleExpReward, onHeal, onLossMp, onRestoreMp, onTurnEnd, onTurnStart, onUseBattleItem } from "~/api/game/socket/battle";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import { emitListToMarket } from "~/api/game/socket/market";
import { emitLeaveBattleRoom, onBattleRoomStartBattleSuccess } from "~/api/game/socket/battleRoom";
import { allBattleState, } from "~/shared/data/allBattleState";
import type { AllBattleStateId } from "~/shared/types/BattleState";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { DamageType, type AllBattleSkillId } from "~/shared/types/skill";
import { clone, formatTime } from "~/shared/utils";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import type { BaseBattleUnit } from "~/shared/types/unit";
import { allGameResource } from "~/shared/data/allGameResources";

const currentBattleRoom = useCurrentBattleRoom()
const battleInfo = useBattleInfo();

// 战斗日志相关
interface BattleLog {
  id: string;
  timestamp: number;
  component: any;
  props: any;
  type: string;
}

const battleLogs = ref<BattleLog[]>([]); // full store used by scroller
const scrollerRef = ref<any | null>(null);
const autoScroll = ref(false);

// 优化配置
const MAX_STORE_LOGS = 2000; // 减少到 2000 条，平衡性能和追溯性
const COMPRESS_THRESHOLD = 1000; // 当超过 1000 条时开始压缩
const COMPRESS_BATCH_SIZE = 50; // 每次压缩 50 条旧日志

// 防抖滚动优化
let scrollTimeout: number | null = null;

// 性能监控
const performanceStats = ref({
  logCount: 0,
  compressedCount: 0,
  lastCompressTime: 0
});

// 更新性能统计
function updatePerformanceStats() {
  performanceStats.value.logCount = battleLogs.value.length;
  performanceStats.value.compressedCount = battleLogs.value.filter(log => log.type === 'compressed').length;
}

// 页面可见性管理
// const isPageVisible = ref(true);
const messageQueue = ref<Array<{ handler: () => void, timestamp: number }>>([]);
// const MAX_QUEUE_SIZE = 50;

function getUnitName(uuid: string) {
  return battleInfo.value?.members.find(u => u.uuid === uuid)?.name || uuid;
}


// 日志压缩功能
function compressOldLogs() {
  if (battleLogs.value.length <= COMPRESS_THRESHOLD) return;

  const logsToCompress = battleLogs.value.slice(0, COMPRESS_BATCH_SIZE);
  const compressedLog: BattleLog = {
    id: `compressed_${Date.now()}`,
    timestamp: logsToCompress[0].timestamp,
    component: BattleTextLogComponent,
    props: {
      unit: '系统',
      text: `已压缩 ${logsToCompress.length} 条旧日志以提升性能`
    },
    type: 'compressed'
  };

  // 替换旧日志为压缩日志
  battleLogs.value.splice(0, COMPRESS_BATCH_SIZE, compressedLog);

  // 更新性能统计
  performanceStats.value.lastCompressTime = Date.now();
  updatePerformanceStats();
}

// 防抖滚动到底部
function debouncedScrollToBottom() {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  scrollTimeout = window.setTimeout(() => {
    if (autoScroll.value) {
      try {
        if (scrollerRef.value && typeof scrollerRef.value.scrollToItem === 'function') {
          scrollerRef.value.scrollToItem(battleLogs.value.length - 1);
        } else {
          scrollToBottom();
        }
      } catch (e) {
        // ignore
      }
    }
    scrollTimeout = null;
  }, 50); // 50ms 防抖
}

// 添加消息到队列或直接处理
function addMessageOrQueue(handler: () => void) {
  handler();
}

// 添加战斗日志
function addBattleLog(type: string, component: any, props: any) {
  const log: BattleLog = {
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    component,
    props,
    type
  };

  battleLogs.value.push(log);

  // 动态日志压缩：当超过阈值时压缩旧日志
  if (battleLogs.value.length > COMPRESS_THRESHOLD) {
    compressOldLogs();
  }

  // 限制日志存储数量，保持最近的 MAX_STORE_LOGS 条
  if (battleLogs.value.length > MAX_STORE_LOGS) {
    const overflow = battleLogs.value.length - MAX_STORE_LOGS;
    battleLogs.value.splice(0, overflow);
  }

  // 使用防抖滚动优化性能
  debouncedScrollToBottom();

  // 更新性能统计
  updatePerformanceStats();
}

function scrollToBottom() {
  const el = document.querySelector('.battle-log-container');
  if (el) {
    (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
  }
}

function clearBattleLog() {
  battleLogs.value = [];
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
}

function formatLogTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function serializeLogForText(log: BattleLog) {
  const time = formatLogTime(log.timestamp);
  const p = log.props || {};
  let lines: string[] = [];

  const push = (s: string) => { lines.push(s); };

  // Try to create human-friendly text similar to on-screen components
  switch (log.type) {
    case 'damage': {
      const source = p.sourceUnit || '';
      if (Array.isArray(p.targetUnits) && p.targetUnits.length) {
        p.targetUnits.forEach((t: any) => {
          const name = t.name || t.unit || '未知目标';
          const dmg = t.fDamage !== undefined ? t.fDamage : '';
          const dt = t.damageType || '';
          const shield = t.shieldDamage ? ` (护盾抵挡: ${t.shieldDamage})` : '';
          push(`${source} 对 ${name} 造成 ${dmg}${dt ? ' ' + dt : ''} 伤害${shield}`);
        });
      } else if (p.damage && typeof p.damage === 'object') {
        push(`${source} 造成伤害: ${JSON.stringify(p.damage)}`);
      } else {
        push(p.text || JSON.stringify(p));
      }
      break;
    }
    case 'skill': {
      const source = p.sourceUnit || '';
      const skillName = (p.skillId && allGameBattleSkills[p.skillId as AllBattleSkillId]?.name) || p.skillName || p.skillId;
      push(`${source} 施放了技能 ${skillName}`);
      break;
    }
    case 'item': {
      const source = p.sourceUnit || '';
      const itemName = (p.itemId && allGameResource[p.itemId]?.name) || p.itemId;
      push(`${source} 使用了物品 ${itemName}`);
      break;
    }
    case 'heal': {
      const src = p.sourceUnit || '';
      const tgt = p.targetUnit || '';
      push(`${src} 对 ${tgt} 恢复了 ${p.healAmount} 点生命值`);
      break;
    }
    case 'mp': {
      const tgt = p.targetUnit || '';
      const verb = p.type === 'restore' ? '恢复' : '失去';
      push(`${tgt} ${verb} ${p.mpChange} 点魔法值`);
      break;
    }
    case 'turn-start': {
      const unit = p.unitName || p.unit || '';
      const num = (p.turnNumber !== undefined) ? (`第${p.turnNumber + 1}回合`) : '';
      push(`${num} - ${unit} 开始行动`);
      break;
    }
    case 'turn-end': {
      const unit = p.unitName || p.unit || '';
      push(`${unit} 结束行动`);
      push('\n');
      break;
    }
    case 'text': {
      if (p.unit) push(`${p.unit}: ${p.text}`);
      else push(String(p.text || JSON.stringify(p)));
      break;
    }
    case 'state': {
      const src = p.sourceUnit || '';
      const tgt = p.targetUnit || '';
      const name = p.stateName || p.stateId || '';
      if (src && src !== tgt) push(`${src} 对 ${tgt} 施加了状态 ${name}`);
      else push(`${tgt} 获得了状态 ${name}`);
      break;
    }
    // case 'item-reward':
    // case 'give_reward':
    // case 'reward': {
    //   // generic reward line
    //   try { push(`获得奖励: ${JSON.stringify(p)}`); } catch (e) { push(String(p)); }
    //   break;
    // }
    case 'compressed': {
      if (p && p.text) push(String(p.text));
      else push('已压缩若干旧日志');
      break;
    }
    default: {
      // handle BattleStatus events like PLAYER_WIN/PLAYER_LOSE/ESCAPED
      if (typeof log.type === 'string' && (log.type.includes('WIN') || log.type.includes('LOSE') || log.type.includes('ESCAPED'))) {
        // map to readable
        if (log.type.includes('WIN')) {
          push('战斗胜利');
          push('\n');
          push('\n');
        }
        else if (log.type.includes('LOSE')) {
          push('战斗失败');
          push('\n');
          push('\n');
        }
        else if (log.type.includes('ESCAPED')) {
          push('逃离了战斗');
          push('\n');
          push('\n');
        }
      } else {
        try { push(JSON.stringify(p)); } catch (e) { push(String(p)); }
      }
    }
  }

  // combine lines. if multiple target lines, join with '；'
  const content = lines.length > 1 ? lines.join(' ') : (lines[0] || '');
  return `[${time}] ${content}`;
}

function buildTextFromLogs(logs: BattleLog[]) {
  return logs.map(l => serializeLogForText(l)).join('\n');
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke after a short delay to ensure download is triggered
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function downloadBattleLog() {
  try {
    if (!battleLogs.value || battleLogs.value.length === 0) {
      ElMessage.info('当前没有战斗日志可导出');
      return;
    }

    const filename = `battle-log-${battleInfo.value?.uuid ?? Date.now()}.txt`;
    const text = buildTextFromLogs(battleLogs.value);
    downloadText(filename, text);
    ElMessage.success('已生成并开始下载战斗文本');
  } catch (e) {
    console.error('[BattleLog] export error', e);
    ElMessage.error('导出失败，请查看控制台');
  }
}

// 战斗日志组件
const DamageLogComponent = (props: any) => {
  const { sourceUnit, damage, targetUnits } = props;

  return h('div', { class: 'damage-log' }, [
    h('div', { class: 'space-y-1' }, targetUnits.map((target: any) => {
      return h('div', { class: 'flex items-center text-sm space-x-2' }, [
        h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, target.name),
        h('span', { class: '' }, `受到来自`),
        h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, sourceUnit),
        h('span', { class: '' }, ` 的 `),
        h('span', { class: 'font-semibold text-red-700 dark:text-gray-300' }, target.fDamage),
        h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, ` 点 ${target.damageType}伤害`),
        target.shieldDamage ? h('span', { class: 'text-yellow-500 ' }, `(护盾抵挡: ${target.shieldDamage})`) : null
      ])
    }))
  ]);
};

const SkillLogComponent = (props: any) => {
  const { sourceUnit, skillName, skillId } = props;
  const skillData = allGameBattleSkills[skillId as AllBattleSkillId];
  
  return h('div', { class: 'skill-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, sourceUnit),
    h('span', { class: 'text-gray-500' }, '施放了技能'),
    h('span', { class: 'font-semibold text-blue-600' }, skillData?.name || skillName || skillId)
  ]);
};

const ItemLogComponent = (props: any) => {
  const { sourceUnit, itemId } = props;
  
  return h('div', { class: 'item-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, sourceUnit),
    h('span', { class: 'text-gray-500' }, '使用了物品'),
    h('span', { class: 'font-semibold text-purple-600' }, allGameResource[itemId].name)
  ]);
};

const StateLogComponent = (props: any) => {
  const { sourceUnit, targetUnit, stateName } = props;
  
  return h('div', { class: 'state-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, sourceUnit),
    sourceUnit !== targetUnit ? [
      h('span', { class: 'text-gray-500' }, '对'),
      h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, targetUnit),
      h('span', { class: 'text-gray-500' }, '施加了状态')
    ] : h('span', { class: 'text-gray-500' }, '获得了状态'),
    h('span', { class: 'font-semibold text-orange-600' }, stateName)
  ]);
};


const HealLogComponent = (props: any) => {
  const { sourceUnit, targetUnit, healAmount } = props;
  
  return h('div', { class: 'heal-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, sourceUnit),
    sourceUnit !== targetUnit ? [
      h('span', { class: 'text-gray-500' }, '治疗了'),
      h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, targetUnit)
    ] : h('span', { class: 'text-gray-500' }, '恢复了'),
    h('span', { class: 'text-green-600' }, healAmount),
    h('span', { class: 'text-gray-500' }, '生命值'),
  ]);
};

const MpLogComponent = (props: any) => {
  const { targetUnit, mpChange, type } = props;
  
  return h('div', { class: 'mp-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, targetUnit),
    h('span', { 
      class: 'text-gray-700 dark:text-gray-300',
    }, type === 'restore' ? `恢复了` : `失去了`),
    h('span', { 
      class: type === 'restore' ? 'text-blue-600 ' : 'text-blue-400 ' 
    }, mpChange),
    h('span', { 
      class: 'text-gray-700 dark:text-gray-300',
    }, '点魔法值'),
  ]);
};

const BattleTextLogComponent = (props: any) => {
  const { unit, text } = props;
  
  return h('div', { class: 'battle-text-log flex items-center space-x-2 text-sm' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, unit),
    h('span', { class: 'text-gray-600 italic' }, text)
  ]);
};

const TurnStartLogComponent = (props: any) => {
  const { unitName, turnNumber } = props;
  
  return h('div', { class: 'turn-start-log flex items-center justify-center space-x-2 text-sm mr-4' }, [
    h('span', { class: 'text-gray-500' }, '第'),
    h('span', { class: 'font-semibold text-blue-600' }, turnNumber + 1),
    h('span', { class: 'text-gray-500' }, '回合 -'),
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, unitName),
    h('span', { class: 'text-gray-500' }, '开始行动')
  ]);
};

const TurnEndLogComponent = (props: any) => {
  const { unitName, turnNumber } = props;
  
  return h('div', { class: 'turn-end-log flex items-center justify-center space-x-2 text-sm mr-4' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, unitName),
    h('span', { class: 'text-gray-500' }, '结束行动')
  ]);
};

const BattleStatusLogComponent = (props: {status: BattleStatus, text: string}) => {
  const { status, text } = props;
  return h('div', { class: 'battle-status-log flex items-center justify-center space-x-2 text-sm mr-4' }, [
    h('span', { class: 'font-semibold text-gray-700 dark:text-gray-300' }, text),
  ]);
};

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction
let off6: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction
let off10: FuncAction
let off11: FuncAction

let off12: FuncAction
let off13: FuncAction
let off14: FuncAction

onMounted(async () => {
  await waitUtilConnected()

  off12 = onBattleBegin((data) => {
    addMessageOrQueue(() => {
      addBattleLog('text', BattleStatusLogComponent, {
        text: '第' + data.turnIndex + '次战斗开始'
      });
    });
  });
  off13 = onBattlePrepareBegin((data) => {
    addMessageOrQueue(() => {
      addBattleLog('text', BattleStatusLogComponent, {
        text: '战斗准备阶段开始'
      });
    });
  });
  off14 = onBattlePrepareEnd((data) => {
    addMessageOrQueue(() => {
      addBattleLog('text', BattleStatusLogComponent, {
        text: '战斗准备阶段结束',
      });
    });
  });
  
  off1 = onUseBattleItem((data) => {
    addMessageOrQueue(() => {
      const sourceUnit = getUnitName(data.user);
      addBattleLog('item', ItemLogComponent, {
        sourceUnit,
        itemId: data.itemId
      });
    });
  });

  off2 = onHeal(data => {
    addMessageOrQueue(() => {
      const sourceUnit = getUnitName(data.source);
      const targetUnit = getUnitName(data.target);
      addBattleLog('heal', HealLogComponent, {
        sourceUnit,
        targetUnit,
        healAmount: data.value.toFixed(0)
      });
    });
  })

  off3 = onLossMp(data => {
    addMessageOrQueue(() => {
      const targetUnit = getUnitName(data.target);
      addBattleLog('mp', MpLogComponent, {
        targetUnit,
        mpChange: data.value.toFixed(0),
        type: 'loss'
      });
    });
  })

  off4 = onRestoreMp(data => {
    addMessageOrQueue(() => {
      const targetUnit = getUnitName(data.target);
      addBattleLog('mp', MpLogComponent, {
        targetUnit,
        mpChange: data.value.toFixed(0),
        type: 'restore'
      });
    });
  })

  off5 = onCastSkill(data => {
    addMessageOrQueue(() => {
      const sourceUnit = getUnitName(data.source);
      addBattleLog('skill', SkillLogComponent, {
        sourceUnit,
        skillId: data.skillId,
        skillName: allGameBattleSkills[data.skillId]?.name
      });
    });
  })

  off6 = onBattleFloatText(data => {
    addMessageOrQueue(() => {
      const unit = getUnitName(data.unit);
      addBattleLog('text', BattleTextLogComponent, {
        unit,
        text: data.text
      });
    });
  })

  off7 = onDealDamage(data => {
    addMessageOrQueue(() => {
      const sourceUnit = getUnitName(data.source);
      const targetUnits = Object.values(data.target).map(damageDetail => ({
        name: getUnitName(damageDetail.unit),
        damage: damageDetail.value.toFixed(0),
        fDamage: damageDetail.fDamage.toFixed(0),
        damageType: (() => {
          switch(damageDetail.damageType) {
            case DamageType.Physical:
              return '物理';
            case DamageType.Magical:
              return '魔法';
          }
        })(),
        shieldDamage: damageDetail.shieldDamage ? damageDetail.shieldDamage.toFixed(0) : null
      }));
      
      addBattleLog('damage', DamageLogComponent, {
        sourceUnit,
        targetUnits,
        damage: data.target
      });
    });
  });

  off8 = onAddState(data => {
    addMessageOrQueue(() => {
      const sourceUnit = getUnitName(data.source);
      const targetUnit = getUnitName(data.target);
      const stateName = allBattleState[data.stateId as AllBattleStateId]?.name || data.stateId;
      
      addBattleLog('state', StateLogComponent, {
        sourceUnit,
        targetUnit,
        stateName
      });
    });
  })

  off9 = onTurnStart(data => {
    addMessageOrQueue(() => {
      const unitName = getUnitName(data.source);
      addBattleLog('turn-start', TurnStartLogComponent, {
        unitName,
        turnNumber: battleInfo.value?.passedTurn || 0
      });
    });
  })
  
  off10 = onTurnEnd(data => {
    addMessageOrQueue(() => {
      const unitName = getUnitName(data.source);
      addBattleLog('turn-end', TurnEndLogComponent, {
        unitName,
        turnNumber: battleInfo.value?.passedTurn || 0
      });
    });
  })

  off11 = onDispatchBattleFullInfoSuccess((data) => {
    const status = data.battleInfo.battleStatus;
    switch (status) {
      case BattleStatus.PLAYER_WIN:
        addBattleLog(status, BattleStatusLogComponent, {
          status,
          text: '战斗胜利',
        });
        break;
      case BattleStatus.PLAYER_LOSE:
        addBattleLog(status, BattleStatusLogComponent, {
          status,
          text: '战斗失败',
        });
        break;
      case BattleStatus.ESCAPED:
        addBattleLog(status, BattleStatusLogComponent, {
          status,
          text: '逃离了战斗',
        });
        break;
    }
  })

});

onUnmounted(() => {
  // 清理所有 socket 事件监听器
  off1?.()
  off2?.()
  off3?.()
  off4?.()
  off5?.()
  off6?.()
  off7?.()
  off8?.()
  off9?.()
  off10?.()
  off11?.()
  
  // 清空消息队列
  messageQueue.value = [];
  
  // 清空战斗日志数组，释放内存
  battleLogs.value = [];
  
  // 清理虚拟滚动器引用
  scrollerRef.value = null;

  // 清理防抖定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
});

// 监听战斗信息变化，清空日志
watch(() => battleInfo.value?.uuid, (newUuid, oldUuid) => {
  if (newUuid && oldUuid && newUuid !== oldUuid) {
    // battleLogs.value = [];
  }
});

// ...existing code...
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

.dead-unit {
  filter: grayscale(1) brightness(0.7) !important;
  opacity: 0.8 !important;
  /* 可选：让字体颜色更淡 */
  color: #aaa !important;
  pointer-events: none;
}

.fade-mask-enter-active, .fade-mask-leave-active {
  transition: opacity 0.38s;
}
.fade-mask-enter-from, .fade-mask-leave-to {
  opacity: 0;
}
.fade-mask-enter-to, .fade-mask-leave-from {
  opacity: 0.8;
}

.scroller {
  /* 虚拟滚动器样式 */
  overflow-y: auto;
}

.battle-log-item {
  border-left: 3px solid transparent;
  padding-left: 8px;
  transition: all 0.2s ease;
}

.battle-log-item:hover {
  border-left-color: #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}

/* 不同类型日志的边框颜色 */
.damage-log {
  border-left-color: #f56565 !important;
}

.heal-log {
  border-left-color: #48bb78 !important;
}

.skill-log {
  border-left-color: #4299e1 !important;
}

.item-log {
  border-left-color: #9f7aea !important;
}

.state-log {
  border-left-color: #ed8936 !important;
}

.mp-log {
  border-left-color: #38b2ac !important;
}

.battle-text-log {
  border-left-color: #718096 !important;
}

.turn-start-log {
  border-left-color: #68d391 !important;
}

.turn-end-log {
  border-left-color: #f6ad55 !important;
}
</style>