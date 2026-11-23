<template>
  <div>
    <el-form inline>
      <el-form-item label="目标用户 UUID/Name">
        <el-input v-model="target" placeholder="输入用户 UUID 或 昵称"></el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询求购</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="error" type="error" :title="error" show-icon style="margin-top:12px" />

    <el-table v-if="list.length" :data="list" style="width:100%; margin-top:12px">
      <el-table-column prop="tradeUuid" label="求购UUID" width="260" />
      <el-table-column prop="buyer" label="买家" width="200">
        <template #default="{ row }">
          <GameUserAvatarAndName :uuid="row.buyer" />
        </template>
      </el-table-column>
      <el-table-column prop="requireResourceId" label="物品" width="160" :formatter="formatRes"/>
      <el-table-column prop="requireResourceCount" label="需求数量" width="120" />
      <el-table-column prop="doneResourceCount" label="已完成" width="100" />
      <el-table-column prop="payPerUnit" label="单价" width="120" />
      <el-table-column prop="isClosed" label="已关闭" width="100" :formatter="(row)=>row.isClosed? '是':'否'"/>
      <el-table-column label="卖家明细">
        <template #default="{ row }">
          <div v-for="(s, idx) in (row.sellerInfo || [])" :key="idx" style="margin-bottom:6px">
            <div class="flex flex-col">
              <GameUserAvatarAndName :uuid="s.seller" />
              <span>x{{ s.count }} {{ s.time ? formatTime(s.time) : '' }} {{ s.rolledBack ? '[已回滚]' : '' }}</span>
            </div>
            <el-button size="small" type="danger" v-if="!s.rolledBack" @click="rollbackEntry(row.tradeUuid, idx)">回滚该笔</el-button>
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
import { ref, reactive } from 'vue'
import { allGameResource } from '~/shared/data/allGameResources'
import { emitGmGetUserBuyerMarketList, onGmGetUserBuyerMarketListSuccess, onGmGetUserBuyerMarketListFail, emitGmRollbackBuyerMarketSubTrade, onGmRollbackBuyerMarketSubTradeSuccess, onGmRollbackBuyerMarketSubTradeFail } from '~/api/game/socket/gm'
import { formatTime } from '~/shared/utils'

const target = ref('')
const list = ref<any[]>([])
const error = ref('')
const page = ref(1)
const take = ref(20)
const total = ref(0)
const rollbackCount = reactive<Record<string, number>>({})

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
  emitGmGetUserBuyerMarketList(target.value, page.value, take.value)
}

onGmGetUserBuyerMarketListSuccess((res) => {
  list.value = res.list || []
  page.value = res.page || 1
  take.value = res.take || take.value
  total.value = res.total || (res.list || []).length
  // 初始化每条的默认回滚数量为1
  rollbackCountReset()
})

function rollbackCountReset() {
  rollbackCountClear()
  list.value.forEach((row: any) => {
    rollbackCount[row.tradeUuid] = 1
  })
}

function rollbackCountClear() {
  Object.keys(rollbackCount).forEach(k => delete rollbackCount[k])
}

onGmGetUserBuyerMarketListFail((e) => {
  error.value = e?.message || '查询失败'
})

function rollbackEntry(tradeUuid: string, idx: number) {
  error.value = ''
  emitGmRollbackBuyerMarketSubTrade(tradeUuid, idx)
}

onGmRollbackBuyerMarketSubTradeSuccess((_res) => {
  fetchList()
})
onGmRollbackBuyerMarketSubTradeFail((e) => {
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
