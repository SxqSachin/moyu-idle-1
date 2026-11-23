<template>
  <div>
    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-3">
      <el-input
        v-model="search"
        clearable
        placeholder="搜索店铺名称/描述"
        class="sm:w-64"
        @keyup.enter="doSearch"
      />

      <el-select
        v-model="selectedResourceId"
        clearable
        filterable
        remote
        :remote-method="onRemoteSearch"
        :loading="resLoading"
        placeholder="筛选出售物品"
        class="sm:w-64"
        @change="onResourceChange"
        @focus="onResourceFocus"
      >
        <el-option label="全部" value=""></el-option>

        <!-- 提示项：默认不展示候选项，提示用户输入 -->
        <el-option
          v-if="resourceOptions.length === 0"
          :label="remoteQueryTrimmed ? (remoteQueryTrimmed.length < MIN_QUERY_LEN ? `请输入至少 ${MIN_QUERY_LEN} 个字符搜索` : '暂无匹配项') : `请输入名称以搜索`"
          :disabled="true"
          value=""
        ></el-option>

        <el-option v-for="item in resourceOptions" :key="item.id" :label="item.name" :value="item.id">
          <GameCommonSimpleResourceIconAndName :resource-id="item.id"></GameCommonSimpleResourceIconAndName>
        </el-option>
      </el-select>

      <div class="flex gap-2 items-center">
        <el-button type="primary" @click="doSearch">搜索</el-button>
        <el-button class="ml-0!" v-if="hasFilter" plain @click="resetFilters">重置</el-button>
      </div>
    </div>
    <div v-if="!shops || shops.length === 0" class="py-8">
      <el-empty description="暂无店铺" />
    </div>
    <div v-else>
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-2">
        <GamePlayerShopCard v-for="s in shops" :key="s.uuid" :shop="s" />
      </div>
      <div class="flex justify-end mt-2" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="(p: number) => emit('page', p)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PlayerShopDTO } from "~/shared/types/playerShop";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { allGameResource } from "~/shared/data/allGameResources";

const props = defineProps<{ shops: PlayerShopDTO[]; total: number; page: number; pageSize: number; defaultSearch?: string; defaultResourceId?: AllGameResourceID }>()
const emit = defineEmits<{
  (e: 'open', uuid: string): void;
  (e: 'search', keywords: string): void;
  (e: 'filter', payload: { resourceId?: AllGameResourceID; keywords?: string }): void;
  (e: 'page', page: number): void;
}>()

const search = ref(props.defaultSearch || '')

const selectedResourceId = ref<AllGameResourceID | ''>(props.defaultResourceId || '')
// Remote search for resources to avoid rendering all options at once
const ALL_RESOURCE_CANDIDATES = Object.values(allGameResource)
  .filter((r: any) => !r.hideInShop && !r.hideInMarket)
  .map((r: any) => ({ id: r.id as AllGameResourceID, name: r.name || r.id }))

const resourceOptions = ref<{ id: AllGameResourceID; name: string }[]>([])
const resLoading = ref(false)

// simple debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 150) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

const MAX_SHOW = 80
const MIN_QUERY_LEN = 1

const remoteQuery = ref<string>("")

const performResourceSearch = (query = "") => {
  resLoading.value = true
  const q = (query || "").trim().toLowerCase()
  if (!q) {
    resourceOptions.value = []
    resLoading.value = false
    return
  }

  const out: typeof resourceOptions.value = []
  for (let i = 0; i < ALL_RESOURCE_CANDIDATES.length && out.length < MAX_SHOW; i++) {
    const r = ALL_RESOURCE_CANDIDATES[i]
    if (r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) {
      out.push(r)
    }
  }
  resourceOptions.value = out
  resLoading.value = false
}

const onRemoteSearch = debounce((query: string) => {
  remoteQuery.value = query || ""
  const qTrim = (query || "").trim()
  if (qTrim.length < MIN_QUERY_LEN) {
    resourceOptions.value = []
    resLoading.value = false
    return
  }
  performResourceSearch(qTrim)
}, 100)

const onResourceFocus = () => {
  // Do nothing: require user input to trigger search to avoid loading many options
}

const remoteQueryTrimmed = computed(() => (remoteQuery.value || "").trim())

const hasFilter = computed(() => !!(search.value || selectedResourceId.value))

function doSearch() {
  emit('search', search.value || '') // 兼容旧事件
  emit('filter', {
    resourceId: (selectedResourceId.value || undefined) as AllGameResourceID | undefined,
    keywords: search.value || undefined,
  })
}

function onResourceChange() {
  // 选择商品即触发筛选，同时保留关键字
  doSearch()
}

function resetFilters() {
  search.value = ''
  selectedResourceId.value = ''
  doSearch()
}
</script>

<style scoped></style>
