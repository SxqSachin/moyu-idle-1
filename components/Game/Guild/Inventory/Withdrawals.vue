<template>
  <div class="flex flex-col gap-4 mx-1">
    <div class="flex justify-between items-center">
      <div class="font-bold text-lg">提取记录</div>
      <div class="flex gap-2">
        <el-button @click="refreshWithdrawals" :loading="withdrawalsLoading">刷新</el-button>
      </div>
    </div>

    <!-- 待审批申请 (仅管理员可见) -->
    <!-- <div v-if="isAdmin && pendingRequests.length" class="mb-6">
      <div class="font-bold text-lg mb-3 text-orange-600">待审批申请</div>
      <div class="grid gap-4">
        <template v-for="request in pendingRequests" :key="`pending-${request.itemId}-${request.withdrawerUuid}`">
          <el-card class="pending-request-card border-orange-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <GameUserAvatarAndName :uuid="request.withdrawerUuid" />
                <div class="text-gray-500">申请提取</div>
                <GameCommonResourceIconAndName :resource-id="request.itemId" :count="Number(request.amount)" />
                <div v-if="request.reason" class="text-gray-400 text-sm">
                  ({{ request.reason }})
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="text-gray-400 text-sm">
                  {{ formatTime(request.createdAt) }}
                </div>
                <el-button size="small" type="success" @click="onApproveRequest(request, true)">
                  批准
                </el-button>
                <el-button size="small" type="danger" @click="onApproveRequest(request, false)">
                  拒绝
                </el-button>
              </div>
            </div>
          </el-card>
        </template>
      </div>
    </div> -->

    <!-- 所有提取记录 -->
    <div v-if="withdrawals.length" class="grid gap-4">
      <template v-for="withdrawal in withdrawals" :key="`${withdrawal.itemId}-${withdrawal.withdrawerUuid}-${withdrawal.createdAt}`">
        <el-card class="withdrawal-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <GameUserAvatarAndName :uuid="withdrawal.withdrawerUuid" />
              <div class="text-gray-500">提取了</div>
              <GameCommonResourceIconAndName :resource-id="withdrawal.itemId" :count="Number(withdrawal.amount)" />
              <div v-if="withdrawal.reason" class="text-gray-400 text-sm">
                ({{ withdrawal.reason }})
              </div>
            </div>
            <div class="flex items-center gap-2">
              <el-tag 
                :type="getWithdrawalStatusTagType(withdrawal.status)"
                size="small"
              >
                {{ getWithdrawalStatusText(withdrawal.status) }}
              </el-tag>
              <div class="text-gray-400 text-sm">
                {{ formatTime(withdrawal.createdAt) }}
              </div>
            </div>
          </div>
        </el-card>
      </template>
      <div class="flex justify-end mt-4">
        <el-pagination
          background
          layout="prev, pager, next, jumper"
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          @current-change="onPageChange"
          @update:current-page="onPageChange"
        />
      </div>
    </div>
    <div v-else class="text-center py-8 text-gray-400">
      <div class="text-4xl mb-2">📋</div>
      <div>暂无提取记录</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { formatTime } from '~/shared/utils'
import { useMyGuild } from '~/composables/game/useMyGuild'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { GuildRole, type GuildInventoryWithdrawal, type GuildInventoryWithdrawStatus, type GuildMemberInfo } from '~/shared/types/guild'
import type { FuncAction } from '~/shared/types'

import {
  emitGetGuildInventoryWithdrawals,
  onGetGuildInventoryWithdrawalsSuccess,
  onGetGuildInventoryWithdrawalsFail,
  emitGetPendingWithdrawRequests,
  onGetPendingWithdrawRequestsSuccess,
  onGetPendingWithdrawRequestsFail,
  emitApproveWithdrawRequest,
  onApproveWithdrawRequestSuccess,
  onApproveWithdrawRequestFail
} from '~/api/game/socket/guildInventory'

const props = defineProps<{
  guildUuid: string
  myMemberInfo: GuildMemberInfo
}>()

const withdrawals = ref<GuildInventoryWithdrawal[]>([])
const pendingRequests = ref<GuildInventoryWithdrawal[]>([])
const withdrawalsLoading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 权限检查
const isAdmin = computed(() => {
  return props.myMemberInfo?.role === GuildRole.LEADER || props.myMemberInfo?.role === GuildRole.OFFICER
})

// 事件处理
let offFunctions: FuncAction[] = []

onMounted(async () => {
  await waitUtilConnected()
  
  // 注册事件监听
  offFunctions.push(
    onGetGuildInventoryWithdrawalsSuccess((data) => {
      withdrawals.value = data.withdrawals
      total.value = data.total
      page.value = data.page
      pageSize.value = data.pageSize
      withdrawalsLoading.value = false
    }),
    onGetGuildInventoryWithdrawalsFail((data) => {
      ElMessage.error(data.message || '获取提取记录失败')
      withdrawalsLoading.value = false
    }),
    // onGetPendingWithdrawRequestsSuccess((data) => {
    //   pendingRequests.value = data.pendingRequests
    // }),
    // onGetPendingWithdrawRequestsFail((data) => {
    //   ElMessage.error(data.message || '获取待审批申请失败')
    // }),
    // onApproveWithdrawRequestSuccess(() => {
    //   ElNotification.success({ title: '审批成功' })
    //   // 刷新数据
    //   fetchPendingRequests()
    //   fetchWithdrawals()
    // }),
    // onApproveWithdrawRequestFail((data) => {
    //   ElMessage.error(data.message || '审批失败')
    // })
  )

  fetchWithdrawals();
  // fetchPendingRequests()
})

onUnmounted(() => {
  offFunctions.forEach(off => off())
})

function fetchWithdrawals() {
  withdrawalsLoading.value = true
  emitGetGuildInventoryWithdrawals(props.guildUuid, page.value, pageSize.value)
}

function onPageChange(p: number) {
  page.value = p
  fetchWithdrawals()
}

// function fetchPendingRequests() {
//   if (isAdmin.value) {
//     emitGetPendingWithdrawRequests(props.guildUuid)
//   }
// }

function refreshWithdrawals() {
  page.value = 1
  fetchWithdrawals()
  // if (isAdmin.value) {
  //   fetchPendingRequests()
  // }
}

// function onApproveRequest(request: GuildInventoryWithdrawal, approve: boolean) {
//   emitApproveWithdrawRequest(
//     props.guildUuid,
//     request.withdrawerUuid,
//     request.itemId,
//     approve
//   )
// }

// 状态相关方法
function getWithdrawalStatusText(status: GuildInventoryWithdrawStatus) {
  const statusMap = {
    'PENDING': '待审批',
    'APPROVED': '已批准',
    'REJECTED': '已拒绝',
    'CANCELLED': '已取消'
  }
  return statusMap[status] || status
}

function getWithdrawalStatusTagType(status: GuildInventoryWithdrawStatus) {
  const typeMap = {
    'PENDING': 'info',
    'APPROVED': 'success',
    'REJECTED': 'danger',
    'CANCELLED': 'info'
  } as const
  return typeMap[status] || 'info'
}
</script>

<style lang="scss" scoped>
.withdrawal-card {
  transition: all 0.3s ease;
}

.withdrawal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.pending-request-card {
  transition: all 0.3s ease;
  border-left: 4px solid #f39c12;
}

.pending-request-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.2);
}
</style>