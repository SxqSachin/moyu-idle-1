<template>
  <div class="w-full space-y-4">
    <!-- 资源选择和查询 -->
    <div class="flex flex-col md:flex-row items-center gap-2 md:gap-4 justify-center mb-4 md:mb-0">
      <el-select v-model="selectedResourceIdList" multiple filterable clearable placeholder="请选择要查询的物品" class="w-full md:w-auto">
        <el-option v-for="resourceId in filteredResourceList" :key="resourceId"
          :label="allGameResource[resourceId]?.name || resourceId" :value="resourceId">
          <GameCommonSimpleResourceIconAndName :resource-id="resourceId"></GameCommonSimpleResourceIconAndName>
        </el-option>
      </el-select>

      <el-button type="primary" @click="doQuery" :loading="isLoading">查询</el-button>
    </div>

    <!-- 多物品价格对比图表 -->
    <div v-if="hasData" class="chart-container bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="chart-header mb-4">
        <h4 class="text-lg font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Icon name="material-symbols:trending-up" class="text-emerald-500" />
          物品价格对比
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          已选择 {{ selectedResourceIdList.length }} 个物品，共 {{ totalDataPoints }} 个价格数据点
        </p>
        <!-- 移动端提示 -->
        <p v-if="isMobile" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          💡 可以拖拽缩放查看详细数据
        </p>
      </div>

      <!-- 图表 -->
      <div class="w-full">
        <v-chart 
          class="w-full" 
          :option="multiResourceChartOption" 
          autoresize
          :style="{ height: isMobile ? '400px' : '500px', width: '100%' }" 
        />
      </div>

      <!-- 图例说明 -->
      <div class="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <div v-for="(resourceId, index) in resourcesWithData" :key="resourceId" 
             class="flex items-center gap-2 text-sm">
          <div 
            class="w-3 h-3 rounded-full" 
            :style="{ backgroundColor: getResourceColor(index) }"
          ></div>
          <span class="text-gray-700 dark:text-gray-300">
            {{ allGameResource[resourceId]?.name || resourceId }}
          </span>
        </div>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-else-if="selectedResourceIdList.length > 0 && !isLoading" 
         class="no-data flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="text-gray-400 dark:text-gray-500 mb-4">
        <Icon name="material-symbols:bar-chart-off" class="text-6xl" />
      </div>
      <h4 class="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">暂无价格数据</h4>
      <p class="text-sm text-gray-500 text-center max-w-md">
        所选物品暂时没有价格记录，请选择其他物品或稍后再试。
      </p>
    </div>

    <!-- 初始状态 -->
    <div v-else-if="selectedResourceIdList.length === 0" 
         class="text-center py-16 text-gray-500 dark:text-gray-400">
      <Icon name="material-symbols:search" class="text-6xl mb-4" />
      <p>请选择要查询的物品</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AllGameResourceID, AllGameResourceIDWithInternal, GameResourceCategory } from '~/shared/types/gameResource';
import type { MarketPriceData } from '~/shared/types/market';
import { VChart, installEcharts } from '~/utils/echarts';
import { formatCountToStr, formatNumber, ObjectKeys } from '~/shared/utils';
import { waitUtilConnected } from '~/api/game/socket/socket';
installEcharts();
import type { FuncAction } from '~/shared/types';
import { emitBatchGetMarketPriceData, onBatchGetMarketPriceDataError, onBatchGetMarketPriceDataSuccess } from '~/api/game/socket/unifiedMarket';
import { allGameResource, allGameResourceCategoryInfo, allGameResourceIDWithInternal } from '~/shared/data/allGameResources';
import { BANNED_RESOURCE_IN_MARKET } from '~/shared/data/constant';
import type { AllGameActionID } from '~/shared/types/gameAction';

const device = useDevice();
const isMobile = computed(() => device.isMobile);

const selectedResourceIdList = ref<AllGameResourceID[]>([]);
const priceData = ref<Record<string, MarketPriceData>>({});
const isLoading = ref(false);

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
    await waitUtilConnected()

    off1 = onBatchGetMarketPriceDataSuccess(data => {
      priceData.value = data.data;
      isLoading.value = false;
    })

    off2 = onBatchGetMarketPriceDataError(error => {
      isLoading.value = false;
      ElNotification.error({
        title: '获取市场数据失败',
        message: error.message || '无法获取市场数据，请稍后再试。',
        duration: 3000
      });
    })
})

onUnmounted(() => {
    off1?.()
    off2?.()
})

const doQuery = (e: Event) => {
  if (!e.isTrusted) {
    return;
  }

  if (selectedResourceIdList.value.length === 0) {
    ElMessage.warning('请至少选择一个物品');
    return;
  }

  isLoading.value = true;
  emitBatchGetMarketPriceData(selectedResourceIdList.value);
}

const filteredResourceList = computed(() => {
  let allResourceId = Object.keys(allGameResource)

  allResourceId = allResourceId.filter(id => {
    const resource = allGameResource[id];

    if (!resource) {
      return false;
    }

    if (resource.hideInMarket) {
      return false;
    }

    return resource && !resource.isInternal && resource.id !== 'gold' && resource.id !== 'catnip';
  });

  allResourceId = allResourceId.filter(id => !BANNED_RESOURCE_IN_MARKET.includes(id as AllGameResourceIDWithInternal));

  return allResourceId
});

// 有数据的资源列表
const resourcesWithData = computed(() => {
  return selectedResourceIdList.value.filter(resourceId => {
    const data = priceData.value[resourceId];
    return data && data.recentPrices.sellOrders && data.recentPrices.sellOrders.length > 0;
  });
});

// 是否有数据
const hasData = computed(() => {
  return resourcesWithData.value.length > 0;
});

// 总数据点数
const totalDataPoints = computed(() => {
  return resourcesWithData.value.reduce((total, resourceId) => {
    const data = priceData.value[resourceId];
    return total + (data?.recentPrices.sellOrders?.length || 0);
  }, 0);
});

// 预定义颜色列表
const colorPalette = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308', '#dc2626', '#9333ea', '#0891b2'
];

// 获取资源对应的颜色
const getResourceColor = (index: number) => {
  return colorPalette[index % colorPalette.length];
};

const getDataZoomConfig = (dataLength: number) => {
  if (!isMobile.value || dataLength <= 10) return [];
  
  return [
    {
      type: 'inside', // 内置缩放，支持触摸拖拽
      start: Math.max(0, 100 - (10 / dataLength) * 100), // 显示最近10个数据点
      end: 100,
      zoomOnMouseWheel: false,
      moveOnMouseMove: true,
      moveOnMouseWheel: false
    },
    {
      type: 'slider', // 滑动条缩放
      show: true,
      start: Math.max(0, 100 - (10 / dataLength) * 100),
      end: 100,
      height: 20,
      bottom: 5,
      backgroundColor: '#f5f5f5',
      fillerColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: '#ddd',
      handleStyle: {
        color: '#3b82f6'
      },
      textStyle: {
        color: '#666',
        fontSize: 10
      }
    }
  ];
};

// 按天归类处理每个资源的数据
const processResourceDataByDay = (resourceId: string) => {
  const data = priceData.value[resourceId];
  if (!data?.recentPrices.sellOrders) {
    return new Map();
  }

  const sellOrders = data.recentPrices.sellOrders;
  const dayDataMap = new Map<string, {
    date: Date;
    dateKey: string;
    prices: number[];
    volumes: number[];
    totalVolume: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
  }>();

  // 按日期分组数据
  sellOrders.forEach(order => {
    const date = new Date(order.date);
    const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    if (!dayDataMap.has(dateKey)) {
      dayDataMap.set(dateKey, {
        date: date,
        dateKey: dateKey,
        prices: [],
        volumes: [],
        totalVolume: 0,
        minPrice: Infinity,
        maxPrice: -Infinity,
        avgPrice: 0
      });
    }

    const dayData = dayDataMap.get(dateKey)!;
    dayData.prices.push(order.costPerUnit);
    dayData.volumes.push(order.count);
    dayData.totalVolume += order.count;
    dayData.minPrice = Math.min(dayData.minPrice, order.costPerUnit);
    dayData.maxPrice = Math.max(dayData.maxPrice, order.costPerUnit);
  });

  // 计算平均价格
  dayDataMap.forEach(dayData => {
    const totalWeightedPrice = dayData.prices.reduce((sum, price, index) => {
      return sum + (price * dayData.volumes[index]);
    }, 0);
    dayData.avgPrice = totalWeightedPrice / dayData.totalVolume;
  });

  return dayDataMap;
};

// 获取所有日期的联合集合
const getAllDateKeys = computed(() => {
  const allDateKeys = new Set<string>();
  
  resourcesWithData.value.forEach(resourceId => {
    const dayDataMap = processResourceDataByDay(resourceId);
    dayDataMap.forEach((_, dateKey) => {
      allDateKeys.add(dateKey);
    });
  });
  
  return Array.from(allDateKeys).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });
});

// 多资源对比图表配置
const multiResourceChartOption = computed(() => {
  if (!hasData.value) return {};

  const allDateKeys = getAllDateKeys.value;
  
  // 构建 series 数据 - 每个资源一条折线
  const seriesData = resourcesWithData.value.map((resourceId, index) => {
    const dayDataMap = processResourceDataByDay(resourceId);
    const resourceColor = getResourceColor(index);
    
    // 为每个日期生成数据，没有数据的点设为 null
    const seriesValues = allDateKeys.map(dateKey => {
      const dayData = dayDataMap.get(dateKey);
      return dayData ? dayData.avgPrice : null;
    });

    return {
      name: allGameResource[resourceId]?.name || resourceId,
      type: 'line',
      data: seriesValues,
      symbol: 'circle',
      symbolSize: isMobile.value ? 4 : 6,
      lineStyle: {
        width: isMobile.value ? 2 : 3,
        color: resourceColor
      },
      itemStyle: {
        color: resourceColor,
        borderColor: '#ffffff',
        borderWidth: isMobile.value ? 1 : 2
      },
      connectNulls: true, // 连接空值点，使线条连贯
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: isMobile.value ? 2 : 3,
          shadowBlur: isMobile.value ? 5 : 10,
          shadowColor: resourceColor + '30'
        }
      }
    };
  });

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      formatter: function(params: any) {
        const dateKey = allDateKeys[params[0].dataIndex];
        const displayDate = new Date(dateKey).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        let content = `<div style="margin-bottom: 8px;"><strong>${displayDate}</strong></div>`;
        
        params.forEach((param: any) => {
          if (param.value !== null) {
            // 获取对应的资源数据来显示详细信息
            const resourceId = resourcesWithData.value[param.seriesIndex];
            const dayDataMap = processResourceDataByDay(resourceId);
            const dayData = dayDataMap.get(dateKey);
            
            if (dayData) {
              content += `
                <div style="margin: 8px 0; padding: 8px;">
                  <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
                    <span style="font-weight: bold; color: #333;">${param.seriesName}</span>
                  </div>
                  <div style="margin-left: 18px; font-size: 12px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; gap:4px; margin: 2px 0;">
                    <div>
                      <span style="color: #666;">均价:</span>
                      <span style="font-weight: bold; color: #333;">${formatNumber(dayData.avgPrice)}</span>
                    </div>  
                    <div>
                      <span style="color: #666;">最高:</span>
                      <span style="font-weight: bold; color: #e74c3c;">${formatNumber(dayData.maxPrice)}</span>
                    </div>  
                    <div>
                      <span style="color: #666;">最低:</span>
                      <span style="font-weight: bold; color: #27ae60;">${formatNumber(dayData.minPrice)}</span>
                    </div>  
                    </div>
                    <div class="flex gap-2">
                    <div style="display: flex;">
                      <span style="color: #666;">总交易量:</span>
                      <span style="font-weight: bold; color: #3498db;">${dayData.totalVolume.toLocaleString()}</span>
                    </div>
                    <div style="display: flex;">
                      <span style="color: #666;">交易次数:</span>
                      <span style="color: #666;">${dayData.prices.length} 笔</span>
                    </div>
                    </div>
                  </div>
                </div>
              `;
            }
          }
        });
        
        return content;
      }
    },
    legend: {
      show: true,
      top: 10,
      type: 'scroll',
      textStyle: {
        fontSize: isMobile.value ? 10 : 12
      }
    },
    grid: {
      left: isMobile.value ? '5%' : '3%',
      right: isMobile.value ? '5%' : '4%',
      bottom: isMobile.value ? '15%' : '8%',
      top: resourcesWithData.value.length > 5 ? 80 : 60,
      containLabel: true
    },
    dataZoom: getDataZoomConfig(allDateKeys.length),
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: allDateKeys.map(dateKey => {
        const date = new Date(dateKey);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      axisLabel: {
        fontSize: isMobile.value ? 10 : 11,
        rotate: isMobile.value ? 0 : 45,
        interval: 'auto',
        margin: isMobile.value ? 8 : 12
      },
      axisTick: {
        alignWithLabel: true
      },
      axisLine: {
        lineStyle: {
          color: isMobile.value ? '#ddd' : '#999'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '价格',
      nameTextStyle: {
        fontSize: isMobile.value ? 10 : 12
      },
      axisLabel: {
        fontSize: isMobile.value ? 10 : 12,
        formatter: function(value: number) {
          return isMobile.value ? formatCountToStr(value) : formatNumber(value);
        }
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          opacity: 0.3
        }
      }
    },
    series: seriesData,
    animation: true,
    animationDuration: 1000,
  };
});
</script>

<style scoped>
.no-data {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dark .no-data {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
}

/* 确保图表在暗色模式下正常显示 */
.dark .price-chart {
  color-scheme: dark;
}

/* 折叠动画样式 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  height: 0 !important;
  opacity: 0;
}
</style>