<template>
  <el-card body-class="w-full flex flex-col gap-4">
    <el-empty v-if="!history.length" description="暂无强化历史" />
    <el-collapse accordion>
      <template v-for="(record, idx) in history" :key="idx">
        <el-collapse-item :name="idx.toString()">
          <template #title="">
            <div class="flex gap-4">
              <div class="flex gap-2">
                <div> 强化： </div>
                <div>
                  <GameCommonResourceIconAndName :resource-id="record.enhanceItemId" />
                </div>
              </div>
              <div class="hidden md:block">
                <span>
                  结果：{{ getLastEnhanceResultOfHistoryInString(record) }}
                </span>
              </div>
            </div>
          </template>

          <GameEnhanceHistoryRecord :record="record" />

        </el-collapse-item>

      </template>

    </el-collapse>
  </el-card>
</template>

<script setup lang="ts">
import { GameCommonResourceIconAndName } from '#components';
import { ElCard, ElTag, ElEmpty, ElDivider } from 'element-plus'
import { emitGetAutoEnhanceHistory, onGetAutoEnhanceHistorySuccess } from '~/api/game/socket/enhance';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';
import { AutoEnhanceRequestStatus, type AutoEnhanceRequestResult, type AutoEnhanceResult } from '~/shared/types/enhance';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import { formatTimeToStr } from '~/shared/utils';

const history = ref<AutoEnhanceRequestResult[]>([])

let off1: FuncAction

const getLastEnhanceResultOfHistory = (history: AutoEnhanceRequestResult) => {
  return history.eachResult.at(-1)
}

const getLastEnhanceResultOfHistoryInString = (history: AutoEnhanceRequestResult) => {
  if (history.status == AutoEnhanceRequestStatus.CANCELLED) {
    return '取消';
  }

  const lastResult = getLastEnhanceResultOfHistory(history);
  if (!lastResult) return '无结果';

  if (lastResult.result === 'error') {
    return `错误：${lastResult.reason}`;
  }

  return lastResult.result === 'success' ? '成功' : lastResult.result === 'failed' ? '失败' : '错误';
}


onMounted(async () => {
  await waitUtilConnected();

  off1 = onGetAutoEnhanceHistorySuccess(data => {
    history.value = data
  })

  emitGetAutoEnhanceHistory()
})
onUnmounted(() => {
  off1?.();
})
</script>
