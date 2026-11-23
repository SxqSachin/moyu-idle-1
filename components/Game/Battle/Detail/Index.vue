<template>
  <div class="flex flex-col w-full">
    <template v-if="battleInfo && currentBattleRoom">
      <div class="flex flex-col w-full relative">
        <el-card class="mb-4">
          <div class="mb-2 text-gray-600 dark:text-gray-300 text-base">
            当前波次： {{ currentBattleRoom.currentRepeat + 1 }}
          </div>
          <div class="mb-2 text-gray-600 dark:text-gray-300 text-base">
            回合： {{ battleInfo.passedTurn }}
          </div>
          <div class="flex items-center mb-2" v-if="battleInfo.extraTurnOnBattleBegin?.length">
            <span class="mr-2 w-24 text-gray-600 dark:text-gray-300 text-nowrap">备战回合：</span>
            <div class="flex space-x-2 overflow-x-auto">
              <template v-for="(id, index) in battleInfo?.extraTurnOnBattleBegin" :key="id">
                <el-tag :disable-transitions="true" :type="unitExtraTurnOrderTagType(id, index)" size="large"
                  :class="{ 'dead-unit': (getUnitByUuid(id)?.hp ?? 0) <= 0 }" class="text-lg">
                  {{ getUnitName(id) }}
                </el-tag>
              </template>
            </div>
          </div>
          <div class="flex items-center">
            <span class="mr-2 w-24 text-gray-600 dark:text-gray-300 text-nowrap">行动顺序：</span>
            <div class="flex space-x-2 overflow-x-auto">
              <template v-for="(id, index) in battleInfo?.turnOrder" :key="id">
                <el-tag :disable-transitions="true" :type="unitNormalOrderTagType(id, index)" size="large"
                  :class="{ 
                    'dead-unit': (getUnitByUuid(id)?.hp ?? 0) <= 0,
                    'once-extra-turn': (battleInfo.thisBattleTmpOnceExtraTurnIndexList?.includes(index) ?? false)
                   }" class="text-lg">
                  {{ getUnitName(id) }}
                </el-tag>
              </template>
            </div>
          </div>
          <!-- 离开战斗按钮 -->
          <div class="flex justify-start mt-3">
            <el-button type="danger" size="small" @click="e => leaveBattle(e)">离开战斗</el-button>
            <el-button type="warning" size="small" @click="e => stopBattle(e)">结束战斗</el-button>
          </div>
        </el-card>
        <el-empty v-if="!battleInfo" description="暂无战斗信息" />
      </div>
    </template>

    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="普通" name="anim">
        <template v-if="activeTab === 'anim'">
          <GameBattleDetailAnim :battle-info="battleInfo"></GameBattleDetailAnim>
        </template>
      </el-tab-pane>
      <el-tab-pane label="文字" name="text">
        <GameBattleDetailText></GameBattleDetailText>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="技能与状态" name="skillAndState">
        <GameBattleDetailSkillAndState :battle-info="battleInfo" v-if="activeTab == 'skillAndState'"></GameBattleDetailSkillAndState>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="tsx">
import { emitBattleLeave, emitStopBattle, emitSetBattleMsgPreference } from '~/api/game/socket/battle';
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { useCurrentBattleRoom } from '~/composables/game/useCurrentBattleRoom';
import { onMounted, onUnmounted } from 'vue';

const activeTab = ref("anim")

const currentBattleRoom = useCurrentBattleRoom()
const battleInfo = useBattleInfo();

function getUnitByUuid(uuid: string) {
  return battleInfo.value?.members.find(u => u.uuid === uuid)
}

function getUnitName(uuid: string) {
  return battleInfo.value?.members.find(u => u.uuid === uuid)?.name || uuid;
}

function leaveBattle(e: Event) {
  if (!e.isTrusted) return; // 确保是用户操作触发的
  if (currentBattleRoom.value) {
    ElMessageBox({
      title: '离开战斗',
      message: "确定离开战斗吗，离开战斗后，你将同时离开此房间，战斗将由房间内剩余玩家继续进行。",
      showCancelButton: true,
      confirmButtonText: '离开',
      cancelButtonText: '取消',
    }).then((action) => {
      if (currentBattleRoom.value) {
        emitBattleLeave(currentBattleRoom.value.uuid)
      }
    })
  }
}

function stopBattle(e: Event) {
  if (!e.isTrusted) return; // 确保是用户操作触发
  if (currentBattleRoom.value) {
    ElMessageBox({
      title: '结束战斗',
      message: "确定结束战斗吗，结束战斗后，房间内玩家将全部离开战斗并重新回到房间，除你以外的玩家将处于准备就绪状态。",
      showCancelButton: true,
      confirmButtonText: '离开',
      cancelButtonText: '取消',
    }).then((action) => {
      if (currentBattleRoom.value) {
        emitStopBattle(currentBattleRoom.value.uuid)
      }
    })
  }
}

const unitExtraTurnOrderTagType = (unitUuid: string, index: number) => {
  let currentExtraTurnIndex = battleInfo.value?.extraTurnIndex ?? 0

  return index === (currentExtraTurnIndex - 1) ? 'success' : 'info'
}

const unitNormalOrderTagType = (unitUuid: string, index: number) => {
  if (battleInfo.value?.extraTurnOnBattleBegin?.length) {
    return 'info';
  }

  let currentTurnIndex = battleInfo.value?.currentTurnIndex ?? 0
  let turnOrderLength = battleInfo.value?.turnOrder.length ?? 0

  if (currentTurnIndex == 0) {
    if (battleInfo.value?.passedTurn == 0) {
      return index == 0 ? 'success' : 'info'
    }

    return index === (turnOrderLength - 1) ? 'success' : 'info'
  }

  return index === (currentTurnIndex - 1) ? 'success' : 'info'
}

// Track battle panel presence
onMounted(() => {
  emitSetBattleMsgPreference(true);
});
onUnmounted(() => {
  emitSetBattleMsgPreference(false);
});

</script>

<style lang="scss" scoped>
.dead-unit {
  filter: grayscale(1) brightness(0.7) !important;
  opacity: 0.8 !important;
  /* 可选：让字体颜色更淡 */
  color: #aaa !important;
  /* pointer-events: none; */
}
.once-extra-turn {
  background-color: rgb(71 174 192 / 49%) !important;
  color: white;
  border: none;
}
</style>