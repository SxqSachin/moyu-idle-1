<template>
  <el-card v-if="auction" shadow="hover">
    <div class="flex justify-between items-start gap-4">
      <div class="flex-1">

        <h3 class="text-xl font-bold">{{ auction.metadata?.title ?? "拍卖物品" }}</h3>

        <div class="text-sm text-gray-500 mt-2">
          <span> {{ auctionTargetTypeStr }} </span>
          <span>
            <template v-if="auction.targetType === 'ITEM'">
              : <GameCommonResourceIconAndName :resource-id="auction.targetId"/>
              <div class="my-2"></div>
              数量 : <span>{{ auction.targetCount ?? 1 }}</span>
            </template>
            <template v-else>
              <!-- <span>未知</span> -->
            </template>
          </span>
        </div>
        <div class="text-sm text-gray-600 mt-2">{{ auction.metadata?.desc }}</div>

        <div class="mt-4 flex flex-col gap-2">
          <div class="flex gap-4">
            <div>
              <div class="text-xs text-gray-500">起价</div>
              <div class="text-lg font-bold text-amber-600">{{ formatNumber(auction.startPrice) }}</div>
            </div>
            <div v-if="auction.buyoutPrice">
              <div class="text-xs text-gray-500">一口价</div>
              <div class="text-lg font-bold text-green-600">{{ formatNumber(auction.buyoutPrice) ?? "-" }}
              </div>
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">当前最高</div>
            <template v-if="auction.currentMaxPriceUserUuid">
              <GameUserAvatarAndName v-if="auction.currentMaxPriceUserUuid" :uuid="auction.currentMaxPriceUserUuid" :avatar-size="48" />
              <div class="text-lg font-bold">{{ formatNumber(auction.currentMaxPrice) }}</div>
            </template>
            <div v-else> - </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">结束时间</div>
            <div class="text-sm">{{ formatDate(auction.endAt) }} 
              <span v-if="auction.extensionSeconds" class="text-xs text-gray-400 dark:text-gary-600">(延长期: {{ auction.extensionSeconds / 60 }} 分钟)</span>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-col items-start gap-2">
          <div class="flex items-center gap-4">
            <el-input-number v-model="bidAmount" :min="minBid" class="w-52!" :step="auction.minIncrement || 1"
              :step-strictly="true" :disabled="!canBid" />

            <div class=" text-sm text-gray-500">
              <span>最低加价:</span>
              {{ formatNumber(auction.minIncrement || 1) }}
            </div>
          </div>

          <div class="flex flex-col md:flex-row text-sm gap-4 text-sm items-left md:items-center text-gray-500">
            <div>
              <span>库存: </span>
              <GameCommonResourceIconAndName :resource-id="depositToken" :count="inventoryDepositTokenCount" />
            </div>
            <div>
              <span>你的出价: </span>
              <GameCommonResourceIconAndName :resource-id="depositToken" :count="bidAmount" />
            </div>
          </div>

          <el-divider class="my-2!"></el-divider>

          <div>
            <el-button type="primary" @click="placeBid" :loading="placing" :disabled="!canBid">
              出价
            </el-button>

            <el-button @click="openHistory">出价历史</el-button>

            <!-- 创建者可见的取消拍卖按钮 -->
            <el-button v-if="showCancelButton" type="danger" plain @click="confirmCancel" :loading="canceling">
              取消拍卖
            </el-button>
          </div>
        </div>
      </div>

      <div class="w-48 text-right hidden md:block">
        <div class="text-xs text-gray-500">创建者</div>
        <div class="font-bold mb-4">
          <GameUserAvatarAndName :uuid="auction.creator"  :avatar-size="48"/>
        </div>
        <div class="text-xs text-gray-500 mt-2">状态</div>
        <div class="font-bold">{{ auctionStateStr }}</div>
        <div class="text-xs text-gray-500 mt-2">开始于</div>
        <div class="text-sm">{{ formatTime(auction.createdAt) }}</div>
      </div>
    </div>

    <GameAuctionBidHistory ref="historyRef" :auctionUuid="auction.uuid" />
  </el-card>

  <div v-else class="p-4 bg-white shadow rounded text-gray-400">加载中</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  emitGetAuctionDetail,
  onGetAuctionDetailSuccess,
  onGetAuctionDetailFail,
  emitPlaceBid,
  onPlaceBidSuccess,
  onPlaceBidFail,
  emitCancelAuction,
  onCancelAuctionSuccess,
  onCancelAuctionFail,
} from "~/api/game/socket/auction";
import type { AuctionDetailDTO, AuctionDTO } from "~/shared/types/auction";
import { formatNumber, formatTime } from "~/shared/utils";
import { allGameResource } from "~/shared/data/allGameResources";
import { useInventory } from "~/composables/game/useInventory";
import { waitUtilConnected } from "~/api/game/socket/socket";

const props = defineProps<{ uuid: string }>();
const emit = defineEmits<{ (e: "refresh"): void }>();

const { user } = useUserSession();
const inventory = useInventory();

const currentUserUuid = computed(() => {
  return user.value?.uuid;
})

const depositToken = computed(() => {
  let depositToken = auction.value?.depositToken ?? "gold"
  return depositToken;
})
const inventoryDepositTokenCount = computed(() => {
  return inventory.value[depositToken.value]?.count ?? 0;
})

const auction = ref<AuctionDetailDTO | null>(null);
const bidAmount = ref<number>(0);
const placing = ref(false);
const depositing = ref(false);
const canceling = ref(false);
const historyRef = ref<any>(null);

let offDetailSuccess: (() => void) | null = null;
let offDetailFail: (() => void) | null = null;
let offBidSuccess: (() => void) | null = null;
let offBidFail: (() => void) | null = null;
let offDepSuccess: (() => void) | null = null;
let offDepFail: (() => void) | null = null;
let offCancelSuccess: (() => void) | null = null;
let offCancelFail: (() => void) | null = null;

const auctionTargetTypeStr = computed(() => {
    switch(auction.value?.targetType) {
        case "ITEM":
            return "物品";
        case "TITLE":
            return "头衔";
        case "TEXT":
            return "特殊";
        default:
            return "未知";
    }
})

const auctionStateStr = computed(() => {
    switch(auction.value?.state) {
        case "OPEN":
            return "进行中";
        case "ENDED":
            return "已结束";
        case "SETTLED":
            return "已结算";
        case "CANCELLED":
            return "已取消";
        default:
            return "未知";
    }
});

function loadDetail() {
  if (!props.uuid) return;
  emitGetAuctionDetail(props.uuid);
}

onMounted(async () => {
  await waitUtilConnected();

  offDetailSuccess = onGetAuctionDetailSuccess((data) => {
    if(data.auction.uuid != props.uuid) {
      return;
    }
    auction.value = data.auction;
    // 初始化并保证 bidAmount >= minBid
    bidAmount.value = Math.max(
      data.auction.startPrice,
      data.auction.currentMaxPrice ?? 0,
      (data.auction.finalPrice ?? data.auction.currentMaxPrice ?? data.auction.startPrice) + (data.auction.minIncrement ?? 1)
    );
  }) as any;

  offDetailFail = onGetAuctionDetailFail((d) => {
    ElMessage.error(d?.message || "获取拍卖详情失败");
  }) as any;

  offBidSuccess = onPlaceBidSuccess(() => {
    placing.value = false;
    ElMessage.success("出价成功，正在刷新");
    loadDetail();
  }) as any;

  offBidFail = onPlaceBidFail((d) => {
    placing.value = false;
    ElMessage.error(d?.message || "出价失败");
  }) as any;

  offCancelSuccess = onCancelAuctionSuccess((d) => {
    canceling.value = false;
    ElMessage.success("拍卖已取消");
    // 刷新详情
    loadDetail();
  }) as any;

  offCancelFail = onCancelAuctionFail((d) => {
    canceling.value = false;
    ElMessage.error(d?.message || "取消拍卖失败");
  }) as any;

  loadDetail();
});

onUnmounted(() => {
  offDetailSuccess?.();
  offDetailFail?.();
  offBidSuccess?.();
  offBidFail?.();
  offCancelSuccess?.();
  offCancelFail?.();
});

watch(() => props.uuid, () => {
  loadDetail();
});

function formatDate(d: Date) {
  return new Date(d).toLocaleString();
}

function openHistory() {
  historyRef.value?.open();
}

const minBid = computed(() => {
  if (!auction.value) return 1;
  return Math.max(
    auction.value.startPrice,
    (auction.value.currentMaxPrice ?? 0),
    (auction.value.finalPrice ?? auction.value.currentMaxPrice ?? auction.value.startPrice) + (auction.value.minIncrement ?? 1)
  );
});

// 当拍卖非 OPEN 时不允许出价/缴保证金
const canBid = computed(() => {
    return auction.value?.state === "OPEN" && Date.now() < new Date(auction.value!.endAt).getTime()
});

// 仅创建者可见取消按钮，且拍卖处于 OPEN 状态
const showCancelButton = computed(() => {
  if (user.value?.isGm) {
    return true;
  }

  if (auction.value?.currentMaxPriceUserUuid) {
    return false;
  }

  return auction.value?.state === "OPEN" && currentUserUuid.value && auction.value?.creator === currentUserUuid.value;
});

function placeBid() {
  if (!auction.value) return;
  const min = minBid.value;
  if (!Number.isFinite(Number(bidAmount.value)) || Number(bidAmount.value) < min) {
    ElMessage.warning(`出价必须 >= 最低出价 ${min}`);
    return;
  }
  placing.value = true;
  emitPlaceBid({ auctionUuid: auction.value.uuid, bidder: "", amount: Number(bidAmount.value) });
}

async function confirmCancel() {
  if (!auction.value) return;
  try {
    await ElMessageBox.confirm("确认取消该拍卖？取消后将返还未决出价与拍卖物品，但手续费不会返还", "取消拍卖", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }

  canceling.value = true;
  emitCancelAuction(auction.value.uuid);
}
</script>