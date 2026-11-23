<template>
  <el-card body-class="p-3! md:p-4!">
    <h2 class="text-2xl font-bold mb-4">任务列表</h2>
    <div class="text-gray-500 text-sm mb-4">
      喵喵协会每天都会为你安排几项轻松有趣的日常小任务喵～<br />
      每4小时(0:00、04:00、08:00、12:00、16:00、20:00)，猫猫信使会送来一份全新任务，完成后还能获得猫爪印章！<br />
      伸个懒腰，和小伙伴们一起享受猫猫的日常吧～<br />
      <br />
      ps: 猫猫协会只认可由你亲自完成的任务哦!
    </div>

    <el-empty v-if="!inited" description="加载中" />
    <el-empty v-else-if="sortedQuests.length === 0" description="暂无任务" />
    <div v-else class="space-y-2">
      <el-button v-if="doneQuests.length" class="text-right" size="small" type="success" @click="onNeedCompleteAllQuest">领取所有奖励</el-button>
      <QuestItem v-for="quest in sortedQuests" :key="quest.uuid" :quest="quest" />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import QuestItem from "./Item.vue";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { useGameQuest } from "~/composables/game/useGameQuest";
import { emitCompleteAllQuest, emitGetQuestList, onCompleteAllQuestError, onCompleteAllQuestSuccess, onDeleteQuestError, onDeleteQuestSuccess, onGetQuestListSuccess, onRerollQuestError, onRerollQuestSuccess } from "~/api/game/socket/quest";
import type { FuncAction } from "~/shared/types";

const quests = useGameQuest()

const inited = ref(false);

const sortedQuests = computed(() => {
  return [...quests.value].sort((a, b) => {
    // 已完成的排最上面
    if (a.status === "DONE" && b.status !== "DONE") return -1;
    if (a.status !== "DONE" && b.status === "DONE") return 1;
    // 同状态下，进度高的在前面
    const aPercent = a.target.current / a.target.count;
    const bPercent = b.target.current / b.target.count;
    return bPercent - aPercent;
  });
});

const doneQuests = computed(() => {
  return quests.value.filter(q => q.status === "DONE");
})

let unbind: FuncAction;
let unbind2: FuncAction;
let unbind3: FuncAction;
let unbind4: FuncAction;
let unbind5: FuncAction;
let unbind6: FuncAction;

const onNeedCompleteAllQuest = (e: Event) => {
  if (!e.isTrusted) return;

  emitCompleteAllQuest();
}

onMounted(async () => {
  await waitUtilConnected();

  emitGetQuestList()
  unbind = onGetQuestListSuccess((data) => {
    quests.value = data;
    inited.value = true;
  });

  unbind2 = onRerollQuestSuccess(({ newQuest }) => {
    ElNotification({
      title: "任务重随成功",
      message: "已获得新任务：" + (newQuest.title || ""),
      type: "success",
      duration: 1800
    })

    emitGetQuestList()
  })

  unbind3 = onDeleteQuestSuccess(() => {
    ElNotification({
      title: "删除任务成功",
      type: "success",
      duration: 1800
    })

    emitGetQuestList()
  })
  unbind4 = onDeleteQuestError((e) => {
    ElNotification({
      title: '删除任务失败',
      type: 'error',
      message: e.message,
      duration: 1800
    })
  })

  unbind5 = onCompleteAllQuestSuccess((e) => {
    ElNotification({
      title: '已领取所有奖励',
      type: 'success',
      duration: 1800
    })
  })

  unbind6 = onCompleteAllQuestError(e => {
    ElNotification({
      title: '完成任务失败',
      type: 'error',
      message: e.message,
      duration: 1800
    })
  })
});

onUnmounted(() => {
  if (unbind) unbind();
  if (unbind2) unbind2()
  unbind3?.()
  unbind4?.()
  unbind5?.()
  unbind6?.()
});

</script>