<template>
  <el-card class="mb-4" body-class="p-3! md:p-4!">
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <div class="flex flex-col md:flex-row justify-between w-full">
          <div>
            <div class="font-bold text-lg mb-1 truncate">{{ quest.title }}</div>
            <div class="text-gray-500 text-xs mb-2 hidden md:block" v-if="quest.description">{{ quest.description }}</div>
            <div class="text-gray-400 text-xs mb-1">
              创建时间：{{ formatTime(quest.createdAt) }}
            </div>
          </div>
          <div class="flex flex-row-reverse md:flex-col md:flex-col items-start md:items-end space-y-2 ml-0 md:ml-6 mt-2 md:mt-0 shrink-0 gap-2 md:gap-0">
            <el-tag class="hidden! md:block!" v-if="(quest.status === 'PENDING' || quest.status === 'DOING') && quest.target.current > 0" type="primary">
              进行中</el-tag>
            <el-button v-if="(quest.status === 'PENDING' || quest.status === 'DOING')" type="primary" size="small" @click="quickAddTask(quest)">
              快速开始</el-button>
            <el-button v-else-if="quest.status === 'DONE'" type="success" size="small" :disabled="isCompleteClick" @click="completeTask(quest)">
              领取奖励</el-button>
            <!-- <el-tag v-else-if="quest.status === 'EXPIRED'" type="info">已过期</el-tag>
            <el-tag v-else-if="quest.status === 'REROLL'" type="warning">已重置</el-tag> -->
            <!-- 新增重随按钮和消耗 -->
            <div class="flex flex-row items-center gap-2 mt-0 md:mt-1">
              <el-button v-if="quest.status !== 'DONE'" type="danger" plain size="small" @click="deleteQuest">删除</el-button>
              <el-button type="success" plain size="small" class="ml-0!" :disabled="!canReroll" @click="rerollQuestHandler">重随: 
                {{ rerollCost }}
                <GameCommonSimpleResourceIconAndName :resource-id="'gold'" size="small" class="inline-block ml-1" />
              </el-button>
            </div>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap gap-2 items-center">
          <el-text class="text-gray-500">奖励：</el-text>
          <template v-for="reward in quest.rewards" :key="reward.resourceId">
            <GameCommonResourceIconAndName size="small" :resource-id="reward.resourceId" :count="reward.count">
            </GameCommonResourceIconAndName>
          </template>
        </div>

        <div class="flex items-center gap-2 mt-4">
          <span class="text-xs text-gray-400 w-14">{{ quest.target.current }} / {{ quest.target.count }}</span>
          <el-progress class="flex-1 w-full" :percentage="progressPercent" :show-text="false" :stroke-width="8"
            status="success" />
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <el-dialog v-model="showActionDialog" v-if="showActionDialog" title="快速执行任务" :width="isMobile ? '10%' : '10%'" :align-center="true" :close-on-click-modal="true">
      <GameActionCard :only-card="true" @dialog-close="onDialigClose" v-if="currentAction" :action="currentAction" :default-repeat-count="defaultRepeatCount">
      </GameActionCard>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Quest } from "~/shared/types/quest";
import { GameCommonResourceIconAndName } from "#components";
import { emitCompleteQuest, emitRerollQuest, onRerollQuestSuccess, onRerollQuestError, emitDeleteQuest } from "~/api/game/socket/quest";
import { allGameAction } from "~/shared/data/allGameActions";
import type { GameAction } from "~/shared/types/gameAction";
import { formatTime } from "~/shared/utils";
import { useInventory } from "~/composables/game/useInventory";
import { ElNotification } from "element-plus";
import { QUEST_REROLL_GOLD_COST_PRE } from "~/shared/data/constant";

const {isMobile} = useDevice()

const inventory = useInventory()

const isCompleteClick = ref(false)
const showActionDialog = ref(false)
const currentAction = ref<GameAction>()
const defaultRepeatCount = ref<number>(0)

const props = defineProps<{ quest: Quest }>();

const progressPercent = computed(() => {
  if (!props.quest.target.count) return 0;
  return Math.min(
    100,
    Math.round((props.quest.target.current / props.quest.target.count) * 100)
  );
});

const completeTask = (quest: Quest) => {
  isCompleteClick.value = true
  emitCompleteQuest(quest.uuid)
}

const quickAddTask = (quest: Quest) => {
  showActionDialog.value = true;
  currentAction.value = allGameAction[quest.target.actionId];
  defaultRepeatCount.value = quest.target.count - quest.target.current
}

// 是否允许重随，仅示例：未完成且未过期未重置可重随且金币足够
const canReroll = computed(() => {
  const gold = inventory.value?.gold?.count ?? 0
  return (props.quest.status === 'PENDING' || props.quest.status === 'DOING') && gold > unref(rerollCost)
})

const rerollCost = computed(() => {
  return QUEST_REROLL_GOLD_COST_PRE * (props.quest.rerollCount + 1)
})

function rerollQuestHandler() {
  const gold = inventory.value?.gold?.count ?? 0
  if (gold < unref(rerollCost)) {
    ElNotification({
      title: "金币不足",
      message: `重随需要消耗${unref(rerollCost)}金币`,
      type: "warning",
      duration: 1800
    })
    return
  }
  emitRerollQuest(props.quest.uuid)
}

function deleteQuest() {
  ElMessageBox({
    title: '删除任务',
    message: "确定删除此任务吗？删除后将无法恢复。",
    showCancelButton: true,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    emitDeleteQuest(props.quest.uuid)
  }).catch(() => {
  })
}

function onDialigClose() {
  showActionDialog.value = false;
}

</script>

<style scoped>
.el-progress__text {
  font-size: 12px !important;
}
</style>