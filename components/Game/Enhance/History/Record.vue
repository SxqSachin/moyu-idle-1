<template>
    <div class="flex flex-col gap-2 border-t border-gray-200 dark:border-gray-600 pt-4">
        <div class="text-xs text-gray-600 dark:text-gray-400 mb-4 space-y-2">
            <div v-if="record.targetResourceId">
                <span> 目标： </span>
                <GameCommonResourceIconAndName :resource-id="record.targetResourceId"> </GameCommonResourceIconAndName>
            </div>
            <div v-if="record.targetRepeatCount"> 目标强化次数：{{ record.targetRepeatCount }} </div>
        </div>

        <div class="text-xs text-gray-500 flex gap-4">
            <span> 共强化：{{ record.repeatCount }} 次</span>
            <span> 开始时间：{{ formatTimeToStr(record.startAt) }} </span>
            <span v-if="record.endAt">结束时间：{{ formatTimeToStr(record.endAt) }}</span>
        </div>

        <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-gray-600 dark:text-gray-400 w-16"> 共获得： </span>
            <div class="flex gap-2 flex-wrap">
                <template v-for="(count, id) in getHistoryTotalGetResource(record)" :key="id">
                    <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
                    </GameCommonResourceIconAndName>
                </template>
            </div>
        </div>

        <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-gray-600 dark:text-gray-400 w-16"> 共消耗： </span>
            <div class="flex gap-2 flex-wrap">
                <template v-for="(count, id) in getHistoryTotalUsedResource(record)" :key="id">
                    <GameCommonResourceIconAndName :resource-id="id" :count="count?.count">
                    </GameCommonResourceIconAndName>
                </template>
            </div>
        </div>

        <el-divider class="mt-2! mb-0!"></el-divider>

        <!-- 分页数据展示 -->
        <div class="flex flex-col gap-1 max-h-96 overflow-y-auto">
            <template v-for="(res, i) in currentPageResults.toReversed()" :key="`${currentPage}-${i}`">
                <GameEnhanceHistoryItem :index="getResultIndex(i)" :res="res" />
            </template>
        </div>

        <!-- 分页控制 -->
        <div v-if="allResults.length > pageSize">
            <el-divider class="mt-2!"></el-divider>
            <div class="flex justify-between items-center">
                <div class="text-xs text-gray-500">
                    最近 {{ allResults.length }} 条记录
                </div>
                <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                    :total="allResults.length" layout="prev, pager, next, jumper" background size="small"/>
            </div>
        </div>

        <!-- 没有数据时的提示 -->
        <div v-if="allResults.length === 0" class="text-center py-8 text-gray-400">
            <div class="text-2xl mb-2">📄</div>
            <div class="text-sm">暂无强化记录</div>
        </div>
    </div>
</template>

<script setup lang="tsx">
import { ElPagination, ElDivider } from 'element-plus'
import type { AutoEnhanceRequestResult } from '~/shared/types/enhance';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import { formatTimeToStr } from '~/shared/utils';

const props = defineProps<{
  record: AutoEnhanceRequestResult
}>()

// 分页状态
const currentPage = ref(1)
const pageSize = ref(50)

// 计算属性：所有结果数据
const allResults = computed(() => {
    return props.record.eachResult
})

// 计算属性：当前页的结果
const currentPageResults = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    return allResults.value.slice(startIndex, endIndex)
})

// 获取结果的实际索引（用于显示第几次）
const getResultIndex = (currentIndex: number) => {
    const startIndex = (currentPage.value - 1) * pageSize.value
    // 因为数据是 reversed 的，所以索引要反向计算
    const globalIndex = startIndex + currentIndex
    return allResults.value.length - globalIndex
}

// 监听记录变化，重置分页
watch(() => props.record, () => {
    currentPage.value = 1
}, { deep: true })

// 监听页面大小变化，重置到第一页
watch(pageSize, () => {
    currentPage.value = 1
})

const getHistoryTotalGetResource = (history: AutoEnhanceRequestResult) => {
    if (history.allGetItems) {
        return history.allGetItems;
    }
    const totalUsed: ItemCountInfo = {};
    history.eachResult.forEach(result => {
        if (result.result === 'success' || result.result === 'failed') {
            let id = result.increaseItemId
            if (!totalUsed[id]) totalUsed[id] = { count: 0 };
            totalUsed[id].count += 1
        }
    });
    return totalUsed;
}

const getHistoryTotalUsedResource = (history: AutoEnhanceRequestResult) => {
    if (history.allUsedItems) {
        return history.allUsedItems
    }
    const totalUsed: ItemCountInfo = {};
    history.eachResult.forEach(result => {
        if (result.result === 'success' || result.result === 'failed') {
            Object.entries(result.decreaseItemId).forEach(([id, info]) => {
                if (!totalUsed[id]) totalUsed[id] = { count: 0 };
                totalUsed[id].count += (info?.count ?? 0);
            });
        }
    });
    return totalUsed;
}
</script>