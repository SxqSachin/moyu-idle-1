<template>
  <div>
    <el-form inline>
      <el-form-item label="目标用户 UUID/Name">
        <el-input v-model="target" placeholder="输入用户 UUID 或 昵称"></el-input>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="filterType" placeholder="选择类型" style="width:140px">
          <el-option label="全部" value="all" />
          <el-option label="上架(卖家)" value="listing" />
          <el-option label="求购(买家)" value="purchase" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="error" type="error" :title="error" show-icon style="margin-top:12px" />

  <el-table v-if="list.length" :data="list" style="width:100%; margin-top:12px">
      <el-table-column prop="tradeUuid" label="交易UUID" width="260" />
      <el-table-column prop="seller" label="卖家" width="200">
        <template #default="{ row }">
          <GameUserAvatarAndName :uuid="row.seller"></GameUserAvatarAndName>
        </template>
      </el-table-column>
      <el-table-column prop="sellResourceId" label="物品" width="160" :formatter="formatRes"/>
      <el-table-column prop="sellResourceCount" label="数量" width="100" />
      <el-table-column prop="selledResourceCount" label="已成交" width="100" />
      <el-table-column prop="costPerUnit" label="单价" width="120" />
      <el-table-column prop="isClosed" label="已关闭" width="100" :formatter="(row)=>row.isClosed? '是':'否'"/>
      <el-table-column label="买家信息">
        <template #default="{ row }">
          <div v-for="(b, idx) in row.buyerInfo" :key="idx" style="margin-bottom:6px">
            <div class="flex flex-col">
              <GameUserAvatarAndName :uuid="b.buyer"></GameUserAvatarAndName> 
              <span>x{{ b.count }} {{ b.time ? formatTime(b.time) : '' }} {{ b.rolledBack ? '[已回滚]' : '' }}</span>
            </div>
            <el-button size="small" type="danger" v-if="!b.rolledBack" @click="rollback(row.tradeUuid, idx)">回滚</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top:12px">
      <el-pagination v-if="total>0" background :current-page="page" :page-size="take" :total="total" layout="prev, pager, next, ->, total" @current-change="onPageChange" />
      <el-empty v-else description="暂无数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { allGameResource } from '~/shared/data/allGameResources'
import { emitGmGetUserTransactionList, onGmGetUserTransactionListSuccess, onGmGetUserTransactionListFail, emitGmRollbackMarketSubTrade, onGmRollbackMarketSubTradeSuccess, onGmRollbackMarketSubTradeFail, emitGmRollbackMarketPurchaseSubTrade, onGmRollbackMarketPurchaseSubTradeSuccess, onGmRollbackMarketPurchaseSubTradeFail } from '~/api/game/socket/gm'
import { formatTime } from '~/shared/utils'

const target = ref('')
const list = ref<any[]>([])
const error = ref('')
const page = ref(1)
const take = ref(20)
const total = ref(0)
const filterType = ref<'all'|'listing'|'purchase'>('all')

function formatRes(_row: any, _column: any, value: string) {
  return allGameResource[value]?.name || value
}

function fetchList() {
  error.value = ''
  list.value = []
  if (!target.value) {
    error.value = '请输入目标用户 UUID 或昵称（当前需要传 UUID）'
    return
  }
  console.log('[GM] fetchList target=', target.value)
  emitGmGetUserTransactionList(target.value, page.value, take.value, filterType.value)
}

onGmGetUserTransactionListSuccess((res) => {
  console.log('[GM] getUserTransactionList success', res)
  list.value = res.list || []
  page.value = res.page || 1
  take.value = res.take || take.value
  total.value = res.total || (res.list || []).length
  if (res.filterType) filterType.value = res.filterType as any
})
onGmGetUserTransactionListFail((e) => {
  console.warn('[GM] getUserTransactionList fail', e)
  error.value = e?.message || '查询失败'
})

function rollback(tradeUuid: string, idx: number) {
  error.value = ''
  console.log('[GM] rollback', tradeUuid, idx)
  if (filterType.value === 'purchase') {
    emitGmRollbackMarketPurchaseSubTrade(tradeUuid, idx)
  } else {
    emitGmRollbackMarketSubTrade(tradeUuid, idx)
  }
}

onGmRollbackMarketSubTradeSuccess((res) => {
  // 刷新列表
  console.log('[GM] rollback success', res)
  // reload current page
  fetchList()
})
onGmRollbackMarketSubTradeFail((e) => {
  console.warn('[GM] rollback fail', e)
  error.value = e?.message || '回滚失败'
})

onGmRollbackMarketPurchaseSubTradeSuccess((res) => {
  console.log('[GM] rollback purchase success', res)
  fetchList()
})
onGmRollbackMarketPurchaseSubTradeFail((e) => {
  console.warn('[GM] rollback purchase fail', e)
  error.value = e?.message || '回滚失败'
})

function onPageChange(p: number) {
  page.value = p
  fetchList()
}
</script>

<style scoped>
.el-table .el-button {
  margin-left: 8px;
}
</style>
