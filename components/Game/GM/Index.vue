<template>
  <el-card>
    <el-tabs v-model="activeTab">
      <el-tab-pane :lazy="true" label="添加物品" name="add">
        <GameGMAddItem />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="删除物品" name="rmove">
        <GameGMRemoveItem />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="批量添加" name="batchAdd">
        <GameGMBatchAddItem />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="补货信息" name="restockMarket">
        <GameGMRestockMarket />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="添加称号" name="addTitle">
        <GameGMAddTitle />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="解锁样式" name="grantStyle">
        <GameGMGrantStyle />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="发送广播" name="notice">
        <GameGMBatchSendNotice />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="踢出房间" name="kickFromRoom">
        <GameGMKickFromRoom/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="赞助点数" name="sponsorPoint">
        <GameGMModifySponsorPoint/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="服务核销" name="serviceUsage">
        <GameGMModifyServiceUsage/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="封禁" name="banUser">
        <GameGMBanUser/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="批量封禁" name="batchBanUser">
        <GameGMBatchBanUser/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="世界Boss配置" name="worldBoss">
        <GameGMWorldBossConfig />
      </el-tab-pane>
      <!-- <el-tab-pane :lazy="true" label="交易日志" name="tradeLog">
        <GameGMReadTradeLog/>
      </el-tab-pane> -->
      <el-tab-pane :lazy="true" label="交易" name="trade">
        <GameGMTransactionList/>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="交易（求购）" name="buyerMarket">
        <GameGMBuyerMarketList></GameGMBuyerMarketList>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="赞助记录" name="sponsorPointRecords">
        <GameGMSponsorPointRecordList />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue"
const activeTab = ref("add")
</script>