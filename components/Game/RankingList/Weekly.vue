<template>
  <div class="flex flex-row">
    <!-- 榜单类别选择 -->
    <el-tabs v-model="selectedCategory" class="mb-0" tab-position="left">
      <el-tab-pane v-for="category in availableCategories" :key="category.key" :label="category.name"
        :name="category.key" />
    </el-tabs>


    <!-- 排行榜内容 -->
    <div class="ranking-content flex-1" v-if="currentRankingData">
      <!-- 日期选择器 -->
      <div class="date-selector mb-4 p-2 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="flex items-center md:space-x-4">
          <div class="text-sm font-medium">选择周次:</div>
          <el-date-picker v-model="selectedDate" type="week" format="gggg年 第 WW 周" value-format="YYYY-MM-DD"
            placeholder="选择周次" size="default" class="w-full! md:w-48!" :clearable="false" :editable="false"
            :show-week-number="true" @change="onDateChange" />
          <el-button @click="goToCurrentWeek" type="primary" size="small" class="w-full md:w-auto" :icon="Calendar">
            本周
          </el-button>
          <!-- <el-text class="text-xs text-gray-500">
            当前选择: {{ formatSelectedWeekInfo() }}
          </el-text> -->
        </div>
      </div>
      <!-- 金币榜 -->
      <div v-if="selectedCategory === 'goldEarned'">
        <GameUserBatchAvatarAndName :uuid-list="currentRankingData.entries.map(item => item.userUuid) || []">
          <el-table :data="currentRankingData?.entries || []" empty-text="暂无数据" :loading="loading" stripe
            class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700">
            <el-table-column label="排名" width="70" align="center">
              <template #default="{ $index }">
                <div class="flex items-center justify-center">
                  <el-icon v-if="$index === 0" class="text-yellow-500 text-xl mr-1">
                    <Trophy />
                  </el-icon>
                  <el-icon v-else-if="$index === 1" class="text-gray-400 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <el-icon v-else-if="$index === 2" class="text-orange-500 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <span :class="getRankTextClass($index + 1)">{{ $index + 1 }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="userUuid" label="用户名" align="left">
              <template #default="{ row }">
                <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.userUuid" />
              </template>
            </el-table-column>
            <el-table-column prop="value" label="金币">
              <template #default="{ row }">
                {{ formatValue(row.value) }}
              </template>
            </el-table-column>
          </el-table>
        </GameUserBatchAvatarAndName>
      </div>

      <!-- 总经验榜 -->
      <div v-if="selectedCategory === 'total'">
        <GameUserBatchAvatarAndName :uuid-list="currentRankingData?.entries.map(item => item.userUuid) || []">
          <el-table :data="currentRankingData?.entries || []" empty-text="暂无数据" :loading="loading" stripe
            class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700">
            <el-table-column label="排名" width="70" align="center">
              <template #default="{ $index }">
                <div class="flex items-center justify-center">
                  <el-icon v-if="$index === 0" class="text-yellow-500 text-xl mr-1">
                    <Trophy />
                  </el-icon>
                  <el-icon v-else-if="$index === 1" class="text-gray-400 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <el-icon v-else-if="$index === 2" class="text-orange-500 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <span :class="getRankTextClass($index + 1)">{{ $index + 1 }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="userUuid" label="用户名" align="left">
              <template #default="{ row }">
                <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.userUuid" />
              </template>
            </el-table-column>
            <el-table-column prop="value" label="总经验">
              <template #default="{ row }">
                {{ formatValue(row.value) }}
              </template>
            </el-table-column>
          </el-table>
        </GameUserBatchAvatarAndName>
      </div>

      <!-- 各属性经验榜 -->
      <div v-if="!['goldEarned', 'total'].includes(selectedCategory)">
        <GameUserBatchAvatarAndName :uuid-list="currentRankingData?.entries.map(item => item.userUuid) || []">
          <el-table :data="currentRankingData?.entries || []" empty-text="暂无数据" :loading="loading" stripe
            class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700">
            <el-table-column label="排名" width="70" align="center">
              <template #default="{ $index }">
                <div class="flex items-center justify-center">
                  <el-icon v-if="$index === 0" class="text-yellow-500 text-xl mr-1">
                    <Trophy />
                  </el-icon>
                  <el-icon v-else-if="$index === 1" class="text-gray-400 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <el-icon v-else-if="$index === 2" class="text-orange-500 text-xl mr-1">
                    <Medal />
                  </el-icon>
                  <span :class="getRankTextClass($index + 1)">{{ $index + 1 }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="userUuid" label="用户名" align="left">
              <template #default="{ row }">
                <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.userUuid" />
              </template>
            </el-table-column>
            <el-table-column prop="value" :label="getCurrentCategoryLabel()">
              <template #default="{ row }">
                {{ formatValue(row.value) }}
              </template>
            </el-table-column>
          </el-table>
        </GameUserBatchAvatarAndName>
      </div>

      <!-- 统计信息 -->
      <div v-if="currentRankingData?.entries?.length" class="block mt-2">
        <el-text size="small">
          数据30分钟更新一次
         | 参与人数: {{ currentRankingData.totalCount || currentRankingData.entries.length }} 人
        </el-text>
      </div>

      <!-- 空数据提示 -->
      <div v-else-if="!loading && currentRankingData && !currentRankingData.entries?.length"
        class="empty-state text-center py-8">
        <el-empty description="该周次暂无排行数据" />
      </div>
    </div>

    <!-- 玩家信息弹窗 -->
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
      :close-on-click-modal="true" destroy-on-close>
      <template #header>
        <span>玩家信息</span>
      </template>
      <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { Trophy, Medal, Calendar } from '@element-plus/icons-vue'
import { waitUtilConnected } from "~/api/game/socket/socket"
import { formatNumber } from "~/shared/utils"
import { allCharacterStatus } from "~/shared/data/allCharacterStatus"
import type { LeaderboardCategory } from '~/shared/types/weeklyPlayerStats'
import type { WeeklyLeaderboardEntry, LeaderboardResponse } from '~/shared/types/weeklyPlayerStats'
import { emitRequestWeeklyRankingList, onDispatchWeeklyRankingList } from '~/api/game/socket/rankingList'
import type { FuncAction } from '~/shared/types'

// 响应式数据
const loading = ref(false)
const selectedCategory = ref<LeaderboardCategory>('goldEarned')
const selectedDate = ref<string>(new Date().toISOString().split('T')[0]) // 默认当前日期
const weeklyRankingData = ref<Record<string, Record<LeaderboardCategory, LeaderboardResponse>>>({})

// 弹窗相关
const playerInfoDialogVisible = ref(false)
const currentSelectPlayerUuid = ref<string | null>(null)

// 可用的榜单类别
const availableCategories = computed(() => [
  { key: 'goldEarned' as const, name: '💰 金币榜' },
  { key: 'total' as const, name: '📈 总经验榜' },
  { key: 'collecting' as const, name: `${allCharacterStatus.collecting?.icon || '🌿'} 采集榜` },
  { key: 'fishing' as const, name: `${allCharacterStatus.fishing?.icon || '🎣'} 钓鱼榜` },
  { key: 'mining' as const, name: `${allCharacterStatus.mining?.icon || '⛏️'} 挖掘榜` },
  { key: 'farmingAnimal' as const, name: `${allCharacterStatus.farmingAnimal?.icon || '🐄'} 畜牧榜` },
  { key: 'farmingPlant' as const, name: `${allCharacterStatus.farmingPlant?.icon || '🌱'} 种植榜` },
  { key: 'cooking' as const, name: `${allCharacterStatus.cooking?.icon || '🍳'} 烹饪榜` },
  { key: 'forging' as const, name: `${allCharacterStatus.forging?.icon || '🔨'} 锻造榜` },
  { key: 'sewing' as const, name: `${allCharacterStatus.sewing?.icon || '✂️'} 缝纫榜` },
  { key: 'manufacturing' as const, name: `${allCharacterStatus.manufacturing?.icon || '🏭'} 制造榜` },
  { key: 'trading' as const, name: `${allCharacterStatus.trading?.icon || '🏪'} 交易榜` },
  { key: 'knowledge' as const, name: `${allCharacterStatus.knowledge?.icon || '📚'} 学识榜` },
  { key: 'mysterious' as const, name: `${allCharacterStatus.mysterious?.icon || '🔮'} 神秘榜` },
  { key: 'enhance' as const, name: `${allCharacterStatus.enhance?.icon || '⬆️'} 强化榜` },
  { key: 'exploring' as const, name: `${allCharacterStatus.exploring?.icon || '🗺️'} 探索榜` },
  { key: 'luck' as const, name: `${allCharacterStatus.luck?.icon || '🍀'} 幸运榜` },
  { key: 'battle' as const, name: `${allCharacterStatus.battle?.icon || '⚔️'} 战斗榜` },
  { key: 'strength' as const, name: `${allCharacterStatus.strength?.icon || '💪'} 力量榜` },
  { key: 'dexterity' as const, name: `${allCharacterStatus.dexterity?.icon || '🏃'} 敏捷榜` },
  { key: 'intelligence' as const, name: `${allCharacterStatus.intelligence?.icon || '🧠'} 智力榜` },
  { key: 'stamina' as const, name: `${allCharacterStatus.stamina?.icon || '❤️'} 耐力榜` },
  { key: 'attacking' as const, name: `${allCharacterStatus.attacking?.icon || '🗡️'} 攻击榜` },
  { key: 'defencing' as const, name: `${allCharacterStatus.defencing?.icon || '🛡️'} 防御榜` },
])

// 当前选中榜单的数据
const currentRankingData = computed(() => {
  const dateKey = selectedDate.value
  return weeklyRankingData.value[dateKey]?.[selectedCategory.value] || null
})

// 工具函数
const formatValue = (value: number | bigint): string => {
  const num = typeof value === 'bigint' ? Number(value) : value
  return formatNumber(num)
}

const getRankTextClass = (rank: number): string => {
  switch (rank) {
    case 1: return 'text-yellow-600 dark:text-yellow-400 font-bold'
    case 2: return 'text-gray-600 dark:text-gray-400 font-bold'
    case 3: return 'text-orange-600 dark:text-orange-400 font-bold'
    default: return 'text-gray-900 dark:text-white font-medium'
  }
}

const getCurrentCategoryLabel = (): string => {
  if (selectedCategory.value === 'goldEarned') return '金币'
  if (selectedCategory.value === 'total') return '总经验'
  return '经验值'
}

const formatWeeklyPeriod = (periodId: string): string => {
  const match = periodId.match(/^(\d{4})-(\d{3})$/)
  if (match) {
    const year = match[1]
    const week = parseInt(match[2])
    return `${year}年第${week}周`
  }
  return periodId
}

const formatSelectedWeekInfo = (): string => {
  if (!selectedDate.value) return ''
  
  const date = new Date(selectedDate.value)
  const year = date.getFullYear()
  
  // 计算周数 (ISO 8601 标准)
  const tempDate = new Date(date.getTime())
  tempDate.setHours(0, 0, 0, 0)
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7))
  
  const week1 = new Date(tempDate.getFullYear(), 0, 4)
  const week = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  
  return `${year}年第${week}周`
}

const showPlayerInfo = (row: WeeklyLeaderboardEntry) => {
  currentSelectPlayerUuid.value = row.userUuid
  playerInfoDialogVisible.value = true
}

const goToCurrentWeek = () => {
  selectedDate.value = new Date().toISOString().split('T')[0]
}

// 请求排行榜数据
const requestRankingData = () => {
  if (!selectedDate.value) return
  
  loading.value = true
  const requestDate = new Date(selectedDate.value)
  
  emitRequestWeeklyRankingList({ 
    category: selectedCategory.value, 
    date: requestDate 
  })
}

// 日期变化处理
const onDateChange = (value: string | null) => {
  if (value) {
    selectedDate.value = value
    requestRankingData()
  }
}

// 监听分类变化
watch(selectedCategory, () => {
  requestRankingData()
})

// 监听日期变化
watch(selectedDate, () => {
  requestRankingData()
}, { immediate: true })

let off1: FuncAction
onMounted(async () => {
  await waitUtilConnected()
  
  off1 = onDispatchWeeklyRankingList((data: LeaderboardResponse) => {
    // 根据日期和类别存储数据
    const dateKey = selectedDate.value
    if (!weeklyRankingData.value[dateKey]) {
      weeklyRankingData.value[dateKey] = {} as Record<LeaderboardCategory, LeaderboardResponse>
    }
    
    weeklyRankingData.value[dateKey][data.category] = data
    loading.value = false
  })
})

onUnmounted(() => {
  if (off1) off1()
})
</script>

<style scoped>
.ranking-content {
  min-height: 400px;
}

.date-selector {
  border: 1px solid #e5e7eb;
}

.dark .date-selector {
  border-color: #374151;
}

@media (max-width: 768px) {
  .date-selector .flex {
    flex-direction: column;
    space-y: 2;
  }
  
  .date-selector .flex > * {
    margin-bottom: 8px;
  }
}
</style>