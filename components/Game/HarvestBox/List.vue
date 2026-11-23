<script setup lang="ts">
import { useHarvestBox } from "~/composables/game/useHarvestBox";
import { GameCommonSimpleResourceIconAndName } from "#components";
import { formatTime } from "~/shared/utils";
import type { FuncAction } from "~/shared/types";
import { onHarvestBoxClaimAllSuccess } from "~/api/game/socket/harvestBox";

const {
  boxes,
  loading,
  hasMore,
  loadMore,
  claimBox,
  claimItem,
  fetchList,
  claimAllBoxes,
} = useHarvestBox();

let off1: FuncAction

onMounted(() => {
  fetchList({ take: 5 });

  off1 = onHarvestBoxClaimAllSuccess((data) => {
    const items = Array.isArray((data as any)?.claimedItems) ? (data as any).claimedItems : []
    // 聚合同资源ID的数量
    const aggMap: Record<string, number> = {}
    for (const it of items) {
      const rid = (it as any).resourceId
      const amt = Number((it as any).amount) || 0
      aggMap[rid] = (aggMap[rid] || 0) + amt
    }
    dialogItems.value = Object.entries(aggMap).map(([resourceId, amount]) => ({ resourceId, amount }))
    dialogTitle.value = (data as any)?.alreadyClaimed || items.length === 0 ? '没有可领取的物品' : '领取成功'
    dialogVisible.value = true
  })
});

onUnmounted(() => {
  off1 && off1();
})

function claimAll(boxId: number) {
  claimBox(boxId);
}

function claimAllGlobal() {
  claimAllBoxes();
}


const dialogVisible = ref(false)
const dialogTitle = ref('领取结果')
const dialogItems = ref<Array<{resourceId:string; amount:number}>>([])
</script>

<template>
  <div v-if="boxes.length" class="mb-6 p-6 border border-yellow-300 bg-yellow-50/80 dark:bg-yellow-100/10 shadow-xl rounded-2xl!">
    <div class="harvest-box-list">
      <div class="flex justify-between mb-2" v-if="boxes.length">
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
          <span> 收获箱 </span>
        </h3>
        <el-button size="small" type="primary" @click="claimAllGlobal">快速领取全部</el-button>
      </div>
      <div v-if="loading" class="text-sm text-gray-400 py-2">加载中...</div>
      <div v-else>
        <div v-if="!boxes.length" class="text-sm text-gray-400 py-4">暂无收获箱</div>
        <div v-else class="space-y-3">
          <div
            v-for="box in boxes"
            :key="box.id"
            class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-black/20"
          >
            <div class="flex items-center justify-between">
              <div class="font-medium text-sm">
                <span>{{ box.title || '收获箱' }}</span>
                <!-- <span class="ml-2 text-gray-400">#{{ box.id }}</span> -->
                <!-- <span v-if="box.source" class="ml-2 text-xs text-gray-500">{{ box.source }}</span> -->
                <span class="ml-2 text-xs text-gray-500">{{ formatTime(box.createdAt, {hideSecond: true}) }}</span>

              </div>
              <div class="flex items-center gap-2">
                <el-button size="small" type="primary" @click="claimAll(box.id)" :disabled="box.claimed">
                  {{ box.claimed ? '已领取' : '领取全部' }}
                </el-button>
              </div>
            </div>

            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div v-for="(item, idx) in box.items" :key="idx" class="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-white/5">
                <div class="flex items-center gap-2">
                  <GameCommonSimpleResourceIconAndName :resource-id="item.resourceId" :hide-name="false" :icon-size="10" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">x {{ item.amount }}</span>
                  <span v-if="item.claimed" class="text-xs text-green-600">已领取</span>
                </div>
                <div>
                  <el-button v-if="!item.claimed" size="small" @click="claimItem(item.id)" :disabled="box.claimed">领取</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 flex justify-center" v-if="hasMore">
          <el-button size="small" @click="loadMore" :loading="loading">加载更多</el-button>
        </div>
      </div>

    </div>
  </div>

  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
    <div v-if="!dialogItems.length" class="text-sm text-gray-500">没有可领取的物品。</div>
    <div v-else class="space-y-2 max-h-80 overflow-auto pr-1">
      <div v-for="(it, idx) in dialogItems" :key="idx" class="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-white/5">
        <div class="flex items-center gap-2">
          <GameCommonSimpleResourceIconAndName :resource-id="it.resourceId" :hide-name="false" :icon-size="10" />
          <span class="text-sm text-gray-700 dark:text-gray-300">x {{ it.amount }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="dialogVisible=false">我知道了</el-button>
    </template>
  </el-dialog>

</template>

<style scoped>
.harvest-box-list {
  width: 100%;
}
</style>
