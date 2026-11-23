<template>
  <div>
    <el-form inline>
      <el-form-item label="目标用户 UUID/Name">
        <el-input v-model="target" placeholder="输入用户 UUID 或 昵称" clearable />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="changeType" placeholder="选择类型" style="width: 160px">
          <el-option label="全部" value="ALL" />
          <el-option label="增加" value="ADD" />
          <el-option label="减少" value="SUBTRACT" />
          <el-option label="设定" value="SET" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="error" type="error" :title="error" show-icon style="margin-top:12px" />

    <el-table v-if="list.length" :data="list" style="width:100%; margin-top:12px">
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column prop="userName" label="用户" width="220">
        <template #default="{ row }">
          <GameUserAvatarAndName :uuid="row.userUuid"></GameUserAvatarAndName>
        </template>
      </el-table-column>
      <el-table-column prop="changeType" label="类型" width="100" :formatter="formatChangeType" />
      <el-table-column prop="amount" label="变动" width="120" />
      <el-table-column prop="beforePoints" label="之前" width="120" />
      <el-table-column prop="afterPoints" label="之后" width="120" />
      <el-table-column prop="reason" label="原因" min-width="220" />
      <el-table-column prop="createdAt" label="时间" width="200">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <div style="margin-top:12px">
      <el-pagination
        v-if="total > 0"
        background
        :current-page="page"
        :page-size="take"
        :total="total"
        layout="prev, pager, next, ->, total"
        @current-change="onPageChange"
      />
      <el-empty v-else description="暂无数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { emitGmGetSponsorPointRecords, onGmGetSponsorPointRecordsSuccess, onGmGetSponsorPointRecordsFail } from '~/api/game/socket/gm'
import { formatTime } from '~/shared/utils'

const target = ref('')
const changeType = ref<'ADD'|'SUBTRACT'|'SET'|'ALL'>('ALL')
const list = ref<any[]>([])
const error = ref('')
const page = ref(1)
const take = ref(20)
const total = ref(0)

function formatChangeType(_row: any, _col: any, val: string) {
  const map: Record<string, string> = { ADD: '增加', SUBTRACT: '减少', SET: '设定' }
  return map[val] || val
}

function fetchList() {
  error.value = ''
  list.value = []
  emitGmGetSponsorPointRecords(page.value, take.value, changeType.value, target.value?.trim() || undefined)
}

onGmGetSponsorPointRecordsSuccess((res) => {
  list.value = res.list || []
  page.value = res.page || 1
  take.value = res.take || take.value
  total.value = res.total || 0
})

onGmGetSponsorPointRecordsFail((e) => {
  error.value = e?.message || '查询失败'
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
