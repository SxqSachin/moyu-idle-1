<template>
  <div class="flex flex-col gap-4 mx-1">
    <div class="flex justify-between items-center">
      <div class="font-bold text-lg">捐赠记录</div>
      <el-button @click="refreshDonations" :loading="donationsLoading">刷新</el-button>
    </div>

    <div v-if="donations.length" class="flex flex-col gap-4">
      <template v-for="donation in donations" :key="`${donation.itemId}-${donation.donorUuid}`">
        <el-card class="donation-card">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
              <GameUserAvatarAndName :uuid="donation.donorUuid" />
              <div class="flex flex-col items-start gap-2 mb-2 md:mb-0">
                <div class="flex items-center flex-wrap gap-2 mb-2 md:mb-0">
                  <div class="text-gray-400 text-sm md:text-md">捐赠了:</div>
                  <template v-for="(count, id) in donation.info" :key="id">
                    <GameCommonResourceIconAndName :resource-id="id" :count="count?.count" />
                  </template>
                </div>
                <div v-if="donation.reason" class="text-xs text-gray-400">
                  备注：{{ donation.reason }}
                </div>
              </div>
            </div>
            <div class="text-gray-400 text-sm">
              {{ formatTime(donation.createdAt) }}
            </div>
          </div>
        </el-card>
      </template>
    </div>
    <div v-else class="text-center py-8 text-gray-400">
      <div class="text-4xl mb-2">📜</div>
      <div>暂无捐赠记录</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { formatTime } from '~/shared/utils'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { GuildInventoryDonation, GuildMemberInfo } from '~/shared/types/guild'
import type { FuncAction } from '~/shared/types'

import {
  emitGetGuildInventoryDonations,
  onGetGuildInventoryDonationsSuccess,
  onGetGuildInventoryDonationsFail
} from '~/api/game/socket/guildInventory'

const props = defineProps<{
  guildUuid: string
  myMemberInfo: GuildMemberInfo
}>()

const donations = ref<GuildInventoryDonation[]>([])
const donationsLoading = ref(false)

// 事件处理
let offFunctions: FuncAction[] = []

onMounted(async () => {
  await waitUtilConnected()
  
  // 注册事件监听
  offFunctions.push(
    onGetGuildInventoryDonationsSuccess((data) => {
      donations.value = data.donations
      donationsLoading.value = false
    }),
    onGetGuildInventoryDonationsFail((data) => {
      ElNotification.error({title: '获取失败', message: data.message || '获取捐赠记录失败'})
      donationsLoading.value = false
    })
  )

  fetchDonations()
})

onUnmounted(() => {
  offFunctions.forEach(off => off())
})

function fetchDonations() {
  donationsLoading.value = true
  emitGetGuildInventoryDonations(props.guildUuid)
}

function refreshDonations() {
  fetchDonations()
}
</script>

<style lang="scss" scoped>
.donation-card {
  transition: all 0.3s ease;
}

.donation-card:hover {
  transform: translateY(-2px);
}
</style>