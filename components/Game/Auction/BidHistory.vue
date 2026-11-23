<template>
  <el-dialog v-model="visible" title="出价历史" width="340px" :destroy-on-close="false">
    <div v-if="loading" class="py-8 text-center text-gray-400">加载中...</div>

    <div v-else class="space-y-4">
      <el-timeline>

        <el-timeline-item
          v-for="(h, index) in history"
          :key="h.id"
          :timestamp="formatDate(h.createdAt)"
          :type="index == 0 ? 'primary' : 'info'"
        >
          <div class="text-sm flex items-center gap-4">
            <GameUserAvatarAndName :uuid="h.bidder"></GameUserAvatarAndName>
            <div>
              出价: <span class="font-bold">{{ formatNumber(h.amount) }}</span>
              <span v-if="h.isProxy" class="ml-2 text-xs text-gray-500">(代理)</span>
            </div>
          </div>
          <div class="text-xs text-gray-500 mt-1">{{ h.extra ? JSON.stringify(h.extra) : "" }}</div>
        </el-timeline-item>
      </el-timeline>

      <div v-if="history.length === 0" class="text-center text-gray-400 py-6">暂无出价记录</div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  emitGetBidHistory,
  onGetBidHistorySuccess,
  onGetBidHistoryFail,
} from "~/api/game/socket/auction";
import type { AuctionBidHistoryItem } from "~/shared/types/auction";
import { formatNumber } from "~/shared/utils";

const props = defineProps<{ auctionUuid: string }>();

// 弹窗可见性
const visible = ref(false);
const loading = ref(false);
const history = ref<AuctionBidHistoryItem[]>([]);

let offSuccess: (() => void) | null = null;
let offFail: (() => void) | null = null;

// 打开并加载数据
function open() {
  if (!props.auctionUuid) return;
  visible.value = true;
  load();
}

function load() {
  if (!props.auctionUuid) return;
  loading.value = true;
  emitGetBidHistory(props.auctionUuid);
}

onMounted(() => {
  offSuccess = onGetBidHistorySuccess((d) => {
    history.value = d.history ?? [];
    loading.value = false;
  }) as any;

  offFail = onGetBidHistoryFail(() => {
    // 失败时停止 loading
    loading.value = false;
  }) as any;
});

onUnmounted(() => {
  offSuccess?.();
  offFail?.();
});

// 暴露给父组件调用 open()
defineExpose({ open });

function formatDate(d: Date) {
  return new Date(d).toLocaleString();
}
</script>