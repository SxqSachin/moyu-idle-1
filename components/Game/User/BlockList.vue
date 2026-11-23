<template>
  <el-card shadow="never" body-style="padding:12px 12px 4px 12px;">
    <div class="flex items-center justify-between mb-2">
      <div class="text-base font-medium">屏蔽列表 <el-tag type="info" size="small">{{ totalCount }}</el-tag></div>
      <el-button size="small" :loading="loading" @click="refresh" type="primary" plain>刷新</el-button>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon class="mb-2" />

    <el-empty v-if="!loading && totalCount === 0" description="暂无屏蔽用户" :image-size="80" />

    <el-collapse v-if="totalCount > 0" accordion>
      <el-collapse-item v-if="all.length" name="all">
        <template #title>
          <span class="text-sm">完全屏蔽 (all)</span>
          <el-tag size="small" class="ml-2" type="danger">{{ all.length }}</el-tag>
        </template>
        <el-table :data="allTable" size="small" style="width:100%;" :border="false">
          <el-table-column prop="uuid" label="玩家UUID" min-width="180" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button size="small" type="danger" text @click="unblock(scope.row.uuid)">解除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
      <el-collapse-item v-if="publicOnly.length" name="public">
        <template #title>
          <span class="text-sm">公屏屏蔽</span>
          <el-tag size="small" class="ml-2" type="warning">{{ publicOnly.length }}</el-tag>
        </template>
        <el-table :data="publicTable" size="small" style="width:100%;" :border="false">
          <el-table-column label="玩家UUID" min-width="180">
            <template #default="scope">
              <GameUserAvatarAndName :uuid="scope.row.uuid"></GameUserAvatarAndName>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button size="small" type="danger" text @click="unblock(scope.row.uuid)">解除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useChatBlock } from '~/composables/useChatBlock'

const { all, publicOnly, totalCount, loading, errorMsg, refresh, unblock } = useChatBlock()

const allTable = computed(() => all.value.map(uuid => ({ uuid })))
const publicTable = computed(() => publicOnly.value.map(uuid => ({ uuid })))

onMounted(() => { refresh() })
</script>

<style scoped></style>
