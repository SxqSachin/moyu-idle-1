<template>
  <div class="flex flex-col">
    <div class="mb-4">
      <h2 class="text-xl font-bold mb-2">公会仓库</h2>
      <p class="text-gray-500 text-sm">管理公会的共享物品资源</p>
    </div>

    <el-tabs v-model="activeTab">
      <!-- 库存情况 -->
      <el-tab-pane :lazy="true" label="库存情况" name="inventory" v-if="myMemberInfo">
        <GameGuildInventoryList :guild-uuid="guildUuid" :my-member-info="myMemberInfo" />
      </el-tab-pane>

      <!-- 捐赠物品 -->
      <!-- <el-tab-pane :lazy="true" label="捐赠物品" name="donate">
        <GameGuildInventoryDonate :guild-uuid="guildUuid" :my-iember-info="myMemberInfo" />
      </el-tab-pane> -->

      <!-- 捐赠记录 -->
      <el-tab-pane :lazy="true" label="捐赠记录" name="donations" v-if="myMemberInfo">
        <GameGuildInventoryDonations :guild-uuid="guildUuid"  :my-member-info="myMemberInfo" />
      </el-tab-pane>

      <!-- 提取记录 -->
      <el-tab-pane :lazy="true" label="提取记录" name="withdrawals" v-if="myMemberInfo">
        <GameGuildInventoryWithdrawals :guild-uuid="guildUuid" :my-member-info="myMemberInfo" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { GuildMemberInfo } from '~/shared/types/guild';

defineProps<{
  guildUuid: string
  myMemberInfo: GuildMemberInfo
}>()

const activeTab = ref('inventory')
</script>