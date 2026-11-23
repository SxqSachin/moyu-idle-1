<template>
  <div>
    <el-button :loading="loading" @click="fetchLog">读取交易日志</el-button>
    <el-alert v-if="error" type="error" :title="error" show-icon />
    <div class="filters" style="margin: 16px 0; display: flex; gap: 16px; align-items: center;">
      <el-select
        v-model="filterResourceId"
        filterable
        clearable
        placeholder="筛选物品"
        style="width: 220px"
      >
        <el-option
          v-for="(res, id) in allGameResource"
          :key="id"
          :label="res.name"
          :value="id"
        />
      </el-select>
      <el-input-number
        v-model="filterPriceMin"
        :min="0"
        :max="filterPriceMax || undefined"
        placeholder="最低单价"
        style="width: 120px"
        :step="1"
        :controls="false"
      />
      <span>~</span>
      <el-input-number
        v-model="filterPriceMax"
        :min="filterPriceMin || 0"
        placeholder="最高单价"
        style="width: 120px"
        :step="1"
        :controls="false"
      />
      <el-button @click="resetFilter" type="default" size="small">重置筛选</el-button>
    </div>
    <el-tabs v-if="logsByType" v-model="activeTab" style="margin-top: 16px">
      <el-tab-pane
        v-for="(list, type) in logsByType"
        :key="type"
        :label="typeLabel(type)"
        :name="type"
      >
        <el-table-v2
          v-if="list.length"
          :columns="columns"
          :data="list"
          :height="600"
          :width="1100"
          fixed
          class="trade-log-table"
        />
        <el-empty v-else description="暂无该类型日志" />
      </el-tab-pane>
    </el-tabs>
    <el-empty v-else-if="!loading && !error" description="暂无日志" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { emitGmReadTradeLog, onGmReadTradeLogSuccess, onGmReadTradeLogFail } from "~/api/game/socket/gm"
import { allGameResource } from "~/shared/data/allGameResources"
import type { Column } from "element-plus/es/components/table-v2/src/types"

const logs = ref<any[]>([])
const loading = ref(false)
const error = ref("")
const activeTab = ref("buyFromMarket")

// 筛选相关
const filterResourceId = ref<string | null>(null)
const filterPriceMin = ref<number | null>(null)
const filterPriceMax = ref<number | null>(null)

function resetFilter() {
  filterResourceId.value = null
  filterPriceMin.value = null
  filterPriceMax.value = null
}

function parseLog(raw: string): any[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try {
        const obj = JSON.parse(line)
        if (obj.action === "buyFromMarket" || obj.action === "listToMarket") {
          return obj
        }
      } catch {}
      return null
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

function fetchLog() {
  loading.value = true
  error.value = ""
  emitGmReadTradeLog()
}

onGmReadTradeLogSuccess((res) => {
  loading.value = false
  logs.value = parseLog(res.log)
})

onGmReadTradeLogFail(() => {
  loading.value = false
  error.value = "日志读取失败"
})

// 分类并排序，并应用筛选
const logsByType = computed(() => {
  if (!logs.value.length) return null
  const grouped: Record<string, any[]> = {}
  for (const log of logs.value) {
    // 物品筛选
    if (filterResourceId.value && log.sellResourceId !== filterResourceId.value) continue
    // 单价区间筛选
    if (
      (filterPriceMin.value !== null && Number(log.costPerUnit) < filterPriceMin.value) ||
      (filterPriceMax.value !== null && Number(log.costPerUnit) > filterPriceMax.value)
    ) continue
    if (!grouped[log.action]) grouped[log.action] = []
    grouped[log.action].push(log)
  }
  Object.keys(grouped).forEach(type => {
    grouped[type].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  })
  return grouped
})

function formatResourceName(id: string) {
  return allGameResource[id]?.name || id
}

function typeLabel(type: string) {
  switch (type) {
    case "buyFromMarket": return "市场购买"
    case "listToMarket": return "上架市场"
    default: return type
  }
}

function rowKey(row: any) {
  return row.tradeUuid || row.time
}

const columns: Column[] = [
  {
    key: "time",
    title: "时间",
    dataKey: "time",
    width: 180,
    cellRenderer: ({ rowData }) => rowData.time,
  },
  {
    key: "action",
    title: "操作",
    dataKey: "action",
    width: 120,
    cellRenderer: ({ rowData }) => typeLabel(rowData.action),
  },
  {
    key: "sellerUuid",
    title: "卖家",
    dataKey: "sellerUuid",
    width: 180,
    cellRenderer: ({ rowData }) => rowData.sellerUuid || "-",
  },
  {
    key: "buyerUuid",
    title: "买家",
    dataKey: "buyerUuid",
    width: 180,
    cellRenderer: ({ rowData }) => rowData.buyerUuid || "-",
  },
  {
    key: "sellResourceId",
    title: "物品",
    dataKey: "sellResourceId",
    width: 160,
    cellRenderer: ({ rowData }) => formatResourceName(rowData.sellResourceId),
  },
  {
    key: "buyCount",
    title: "数量",
    dataKey: "buyCount",
    width: 80,
    cellRenderer: ({ rowData }) => rowData.buyCount ?? "-",
  },
  {
    key: "costResourceId",
    title: "货币",
    dataKey: "costResourceId",
    width: 80,
    cellRenderer: ({ rowData }) => formatResourceName(rowData.costResourceId),
  },
  {
    key: "costPerUnit",
    title: "单价",
    dataKey: "costPerUnit",
    width: 80,
    cellRenderer: ({ rowData }) => rowData.costPerUnit ?? "-",
  },
]
</script>

<style scoped>
.trade-log-table .el-table-v2__header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fafafa;
}
</style>