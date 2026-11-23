<template>
  <div>
    <div class="mb-3 flex flex-col md:flex-row items-center gap-2">
      <el-select
        v-model="queryParam.search"
        @change="reload"
        filterable
        clearable
        placeholder="物品（输入物品名称）"
        remote
        :remote-method="onRemoteSearch"
        :loading="resLoading"
        @focus="onResourceFocus"
        class="min-w-[220px]">
        <el-option label="全部" value=""></el-option>

        <!-- 提示项：默认不展示候选项，提示用户输入 -->
        <el-option
          v-if="resourceOptions.length === 0"
          :label="remoteQueryTrimmed ? (remoteQueryTrimmed.length < MIN_QUERY_LEN ? `请输入至少 ${MIN_QUERY_LEN} 个字符搜索` : '暂无匹配项') : `请输入名称以搜索`"
          :disabled="true"
          value=""
        ></el-option>

        <el-option
          v-for="resource in resourceOptions"
          :key="resource.id"
          :label="resource.name"
          :value="resource.id">
          <GameCommonSimpleResourceIconAndName :resource-id="resource.id" />
        </el-option>
      </el-select>

      <el-select v-model="queryParam.targetType" @change="reload" placeholder="类型">
        <el-option label="全部" value=""></el-option>
        <el-option label="物品" value="ITEM"></el-option>
        <el-option label="特殊" value="TEXT"></el-option>
      </el-select>
      <el-select v-model="queryParam.state" @change="reload" placeholder="状态">
        <el-option label="全部状态" value=""></el-option>
        <el-option label="进行中" value="OPEN"></el-option>
        <el-option label="已结束" value="ENDED"></el-option>
        <el-option label="已结算" value="SETTLED"></el-option>
        <el-option label="已取消" value="CANCELLED"></el-option>
      </el-select>
      <el-button class="w-full md:w-auto" type="primary" @click="reload">搜索</el-button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3" v-if="items.length">
      <GameUserBatchAvatarAndName :uuid-list="Object.values(items).map(u => u.creator)">
        <template v-for="item in items" :key="item.uuid">
          <GameAuctionListItem :item="item" @select="emit('select', item.uuid)"></GameAuctionListItem>
        </template>
      </GameUserBatchAvatarAndName>

    </div>
    <div v-else class="col-span-full text-center text-gray-400 py-8">暂无符合条件的拍卖</div>
    <div class="mt-4 flex justify-center" v-if="total">
      <el-pagination layout="prev, pager, next" :page-size="queryParam.pageSize" :current-page="queryParam.page"
        :total="total" @current-change="onPageChange" small />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { emitGetAuctionList, onGetAuctionListFail, onGetAuctionListSuccess } from "~/api/game/socket/auction";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { allGameResource } from "~/shared/data/allGameResources";
import type { FuncAction } from "~/shared/types";
import type { AuctionDetailDTO, AuctionListQuery, } from "~/shared/types/auction";

const emit = defineEmits<{ (e: "select", uuid: string): void }>();
const items = ref<AuctionDetailDTO[]>([]);
const total = ref(0);

defineExpose({ reload });

const queryParam = ref<AuctionListQuery>(
  {
    page: 1,
    pageSize: 12,
    search: "",
    targetType: undefined,
    state: "OPEN",
  }
)

function reload() {
  emitGetAuctionList(queryParam.value);
}

const ALL_RESOURCE_CANDIDATES = Object.values(allGameResource)
  .filter((r: any) => !r.hideInMarket && !r.hideInShop && !r.isInternal)
  .map((r: any) => ({ id: r.id, name: r.name || r.id }));

const resourceOptions = ref<{ id: string; name: string }[]>([]);
const resLoading = ref(false);

// simple debounce
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 200) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const MAX_SHOW = 80;
const MIN_QUERY_LEN = 1; // 最少输入字符数才触发搜索

const remoteQuery = ref<string>("");

const doSearch = (query = "") => {
  resLoading.value = true;
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    // do not show default candidates on empty input anymore
    resourceOptions.value = [];
    resLoading.value = false;
    return;
  }
  // lightweight filter (name or id)
  const out: typeof resourceOptions.value = [];
  for (let i = 0; i < ALL_RESOURCE_CANDIDATES.length && out.length < MAX_SHOW; i++) {
    const r = ALL_RESOURCE_CANDIDATES[i];
    if (r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) {
      out.push(r);
    }
  }
  resourceOptions.value = out;
  resLoading.value = false;
};

const onRemoteSearch = debounce((query: string) => {
  remoteQuery.value = query || "";
  const qTrim = (query || "").trim();
  if (qTrim.length < MIN_QUERY_LEN) {
    // do not perform search until user types enough characters
    resourceOptions.value = [];
    resLoading.value = false;
    return;
  }
  doSearch(qTrim);
}, 100);

const onResourceFocus = () => {
  // do nothing on focus: user must type to trigger search
  // keep resourceOptions as-is (likely empty), so UI shows prompt option
};

function onPageChange(p: number) {
  queryParam.value.page = p;
  reload();
}

let off1: FuncAction
let off2: FuncAction

onMounted(async () => {
  await waitUtilConnected();

  off1 = onGetAuctionListSuccess((data) => {
    items.value = data.items;
    total.value = data.total;
    queryParam.value.page = data.page;
    queryParam.value.pageSize = data.pageSize;
  });

  off2 = onGetAuctionListFail((error) => {
    console.log(error);
  });
  reload();
});

onUnmounted(() => {
  off1?.()
  off2?.()
})

const remoteQueryTrimmed = computed(() => (remoteQuery.value || "").trim());
</script>