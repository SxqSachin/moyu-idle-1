<template>
    <template v-if="res.result == 'restart'">
        <div
            class="relative flex flex-col md:flex-row items-center gap-2 text-sm  border-b border-gray-200 dark:border-gray-600 py-4">
            <span class="relative text-gray-600 dark:text-gray-400 text-xs md:mb-0 mr-0 md:mr-3">
                第 {{ index }} 次:
                <span class="inline-block w-12">强化</span>
                <div class="inline-flex flex-row items-center text-md ml-4 gap-4">
                    <span>{{ res.reason }}</span>
                    <GameCommonResourceIconAndName :resource-id="res.currentItemId" />
                </div>
            </span>
        </div>

    </template>
    <template v-else-if="res.result !== 'error'">
        <div
            class="relative flex flex-col md:flex-row items-start gap-2 text-sm  border-b border-gray-200 dark:border-gray-600 py-4">
            <span class="relative text-gray-600 dark:text-gray-400 text-xs top-1.5 mb-2 md:mb-0 mr-0 md:mr-3">
                第 {{ index }} 次:
                <span :class="{
                        'text-green-600': res.result === 'success',
                        'text-red-600': res.result === 'failed',
                      }">
                    强化{{ getRecordResultText(res) }}
                </span>
            </span>

            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs w-10 text-gray-600 dark:text-gray-400"> 获得： </span>
                    <div class="flex-1">
                        <GameCommonResourceIconAndName :resource-id="res.increaseItemId">
                        </GameCommonResourceIconAndName>
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-3 md:mt-0">
                    <span class="text-xs w-10 text-gray-600 dark:text-gray-400"> 消耗： </span>
                    <div class="flex-1 flex flex-wrap gap-2">
                        <template v-for="(count, id) in res.decreaseItemId" :key="id">
                            <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
                            </GameCommonResourceIconAndName>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </template>
    <template v-else>
        <div class="flex gap-4 items-center py-4">
            <el-tag type="info" class="mt-1">
                {{ getRecordResultText(res) }}
            </el-tag>
            <span>{{ res.reason }}</span>
        </div>
    </template>
</template>

<script setup lang="tsx">
import { type AutoEnhanceResult } from '~/shared/types/enhance';

defineProps<{
    index: number
    res: AutoEnhanceResult
}>()

const getRecordResultText = (record: AutoEnhanceResult) => {
  if (record.result === 'success') {
    return `成功`;
  } else if (record.result === 'failed') {
    return `失败`;
  } else if (record.result === 'restart') {
    return `异常`;
  } else {
    return `错误`;
  }
}



</script>