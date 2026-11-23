<template>
  <div class="w-full mb-2" v-if="sellChartData.length !== 0">
    <el-collapse>
      <el-collapse-item>
        <template #title>
          <div>
            <Icon name="material-symbols:trending-up" class="text-emerald-500" /> 历史出售订单价格
          </div>
        </template>
        <!-- 可折叠的图表区域 -->
        <div class="charts-container space-y-6">
          <div
            class="chart-container bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div class="chart-header mb-4">
              <h4 class="text-lg font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              </h4>
            </div>

            <!-- 无出售数据状态 -->
            <div v-if="sellChartData.length === 0" class="no-data flex flex-col items-center justify-center py-16">
              <div class="text-gray-400 dark:text-gray-500 mb-4">
                <Icon name="material-symbols:bar-chart-off" class="text-6xl" />
              </div>
              <h4 class="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">暂无出售数据</h4>
              <p class="text-sm text-gray-500 text-center max-w-md">
                当前物品还没有出售记录。
              </p>
            </div>

            <!-- 出售价格图表 -->
            <div v-else class="w-full">
              <v-chart class="w-full" :option="sellChartOption" autoresize
                :style="{ height: isMobile ? '300px' : '350px', width: '100%' }" />
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>


  </div>
</template>

<script setup lang="ts">
import type { AllGameResourceID } from '~/shared/types/gameResource';
import type { MarketPriceData } from '~/shared/types/market';
import { VChart, installEcharts } from '~/utils/echarts';
import { formatCountToStr, formatNumber } from '~/shared/utils';

installEcharts();

const device = useDevice();
const isMobile = computed(() => device.isMobile);

const props = defineProps<{
  resourceId: AllGameResourceID;
  priceData: MarketPriceData;
}>();

// 折叠状态管理
const isExpanded = ref(false);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

// 动画钩子函数
const onEnter = (el: Element) => {
  const element = el as HTMLElement;
  element.style.height = '0';
  element.style.overflow = 'hidden';
  
  // 强制重排
  element.offsetHeight;
  
  element.style.transition = 'height 0.3s ease-out';
  element.style.height = `${element.scrollHeight}px`;
  
  const onTransitionEnd = () => {
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.removeEventListener('transitionend', onTransitionEnd);
  };
  
  element.addEventListener('transitionend', onTransitionEnd);
};

// 处理出售订单数据
const sellChartData = computed(() => {
  const sellOrders = props.priceData.recentPrices.sellOrders || [];
  
  return sellOrders.map((order) => ({
    price: order.costPerUnit,
    volume: order.count,
    time: order.date
  })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
});

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

// 出售订单图表配置
const sellChartOption = computed(() => {
  const data = sellChartData.value;
  
  if (data.length === 0) {
    return {};
  }

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
        const param = params[0];
        const dataPoint = data[param.dataIndex];
        const time = new Date(dataPoint.time).toLocaleString();
        
        return `
          <div style="margin-bottom: 8px;"><strong>${param.axisValue}</strong></div>
          <div style="margin: 4px 0; display: flex; align-items: center;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
            <span style="min-width: 60px;">出售价格:</span>
            <span style="font-weight: bold; margin-left: 8px;">${formatNumber(param.value ?? 0)}</span>
          </div>
          <div style="margin: 2px 0 8px 18px; font-size: 12px; color: #666;">
            <div>交易量: ${dataPoint.volume}</div>
            <div>时间: ${time}</div>
          </div>
        `;
      }
    },
    grid: {
      left: isMobile.value ? '0%' : '3%',
      right: isMobile.value ? '3%' : '4%',
      bottom: isMobile.value ? '5%' : '3%',
      top: 40,
      containLabel: true
    },
    dataZoom: getDataZoomConfig(data.length),
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => {
        const date = new Date(d.time);
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
    series: [
      {
        name: '出售价格',
        type: 'line',
        data: data.map(d => d.price),
        symbol: 'circle',
        symbolSize: isMobile.value ? 6 : 8,
        lineStyle: {
          width: isMobile.value ? 2 : 3,
          color: '#10b981'
        },
        itemStyle: {
          color: '#10b981',
          borderColor: '#ffffff',
          borderWidth: isMobile.value ? 1 : 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ]
          }
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#059669',
            borderColor: '#ffffff',
            borderWidth: isMobile.value ? 2 : 3,
            shadowBlur: isMobile.value ? 5 : 10,
            shadowColor: 'rgba(16, 185, 129, 0.3)'
          }
        }
      }
    ],
    animation: true,
    animationDuration: 1000
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