<template>
  <div class="space-y-4">
    <!-- 已安装的家具 -->
    <el-card v-if="installedFurniture.length > 0" class="border-gray-200 dark:border-gray-700">
      <template #header>
        <div class="flex items-center gap-2">
          <Icon name="material-symbols:check-circle" class="w-4 h-4 text-green-500" />
          <span class="font-medium text-gray-900 dark:text-gray-100">已安装家具</span>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="furniture in installedFurniture" :key="furniture.uuid" class="furniture-item group">
          <div class="flex items-start gap-3 p-4 border 
                        rounded-lg 
                        hover:shadow-md transition-all duration-200"
                        :class="{
                          'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20': furniture.isActive,
                          'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800': !furniture.isActive
                        }">
            <div class="w-10 h-10 flex items-center justify-center text-2xl flex-shrink-0">
              <GameCommonSimpleAssetsIcon :icon-size="10" :icon="getFurnitureConfig(furniture.furnitureId)?.icon"></GameCommonSimpleAssetsIcon>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ getFurnitureConfig(furniture.furnitureId)?.name || furniture.furnitureId }}
                  </span>
                  <div>
                    <!-- <el-tag size="small" type="success">Lv.{{ furniture.level }}</el-tag> -->
                    <el-tag size="small" :type="furniture.isActive ? 'success' : 'info'">
                      {{ furniture.isActive ? '运行中' : '已停止' }}
                    </el-tag>
                  </div>
                </div>

                <el-icon v-if="allKittyFurniture[furniture.furnitureId].hasConfig"
                  @click="showFurnitureConfig(furniture.furnitureId)" :size="18" class="cursor-pointer">
                  <Icon name="material-symbols:settings-rounded" class="text-gray-400 text-2xl" />
                </el-icon>
              </div>

              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                {{ getFurnitureConfig(furniture.furnitureId)?.description }}
              </div>

              <!-- 耐久度 -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">耐久度</span>
                <el-progress :percentage="furniture.durability" :stroke-width="6"
                  :color="getDurabilityColor(furniture.durability)" class="flex-1" />
              </div>

              <!-- 效果描述 -->
              <div class="text-xs text-blue-600 dark:text-blue-400 mb-3 line-clamp-2">
                {{ getFurnitureEffectDescription(furniture.furnitureId, furniture.level) }}
              </div>

              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <el-button size="small" :type="furniture.isActive ? 'warning' : 'success'"
                  @click="toggleFurniture(furniture)" :loading="toggleLoading === furniture.uuid" class="flex-1">
                  {{ furniture.isActive ? '停用' : '启用' }}
                </el-button>

                <el-button size="small" plain @click="showRepairDialog(furniture)"
                  :disabled="furniture.durability >= 50" :loading="repairLoading === furniture.uuid" class="flex-1">
                  修理
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 可安装的家具 -->
    <el-card class="border-gray-200 dark:border-gray-700">
      <template #header>
        <div class="flex items-center gap-2">
          <Icon name="material-symbols:add-circle" class="w-4 h-4 text-blue-500" />
          <span class="font-medium text-gray-900 dark:text-gray-100">可安装家具</span>
        </div>
      </template>

      <div v-if="availableFurniture.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        <Icon name="material-symbols:furniture" class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>所有家具都已安装！</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="[furnitureId, config] in availableFurniture" :key="furnitureId" class="furniture-item group"
          :class="{ 'opacity-50': !canInstallFurniture(furnitureId) }">
          <div class="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 
                              rounded-lg bg-white dark:bg-gray-800 
                              hover:bg-gray-50 dark:hover:bg-gray-700
                              hover:border-gray-300 dark:hover:border-gray-600
                              hover:shadow-md transition-all duration-200
                              group-hover:scale-[1.01] transform">
            <div class="w-10 h-10 flex items-center justify-center text-2xl flex-shrink-0">
              <GameCommonSimpleAssetsIcon :icon-size="10" :icon="config.icon"></GameCommonSimpleAssetsIcon>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {{ getFurnitureName(furnitureId) }}
                </span>
              </div>

              <div class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                {{ config.description }}
              </div>

              <!-- 制作需求 -->
              <div class="mb-3">
                <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  制作需要：
                </div>
                <div class="flex flex-wrap gap-1">
                  <template v-for="req in config.installRequirement[0]?.resource || []" :key="req.id">
                    <GameCommonResourceIconAndName :resource-id="req.id" :count="req.count" :show-inventory-count="true"
                      class="text-xs" />
                  </template>
                </div>
              </div>

              <!-- 效果描述 -->
              <div class="text-xs text-blue-600 dark:text-blue-400 mb-3 line-clamp-2">
                {{ getFurnitureEffectDescription(config.id, 1) }}
              </div>

              <el-button size="small" type="primary" @click="installFurniture(furnitureId)"
                :disabled="!canInstallFurniture(furnitureId)" :loading="installLoading === furnitureId" class="w-full">
                <template #icon>
                  <Icon name="material-symbols:build" class="w-4 h-4" />
                </template>
                安装
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 家具配置对话框 - 自动投喂器 -->
    <el-dialog v-model="furnitureConfigDialogVisible['autoFeeder']"
      @close="furnitureConfigDialogVisible['autoFeeder'] = false">
      <template #header>
        <span>{{ getFurnitureName('autoFeeder') }}</span>
      </template>

      <div class="mb-4">
        <label class="block mb-1 font-medium">选择食物：</label>
        <el-select v-model="autoFeederSelectedFoodId" placeholder="请选择食物" class="w-full" filterable>
          <el-option v-for="food in foodList" :key="food.id" :label="food.name" :value="food.id">
            <GameCommonSimpleResourceIconAndName :resource-id="food.id">({{ food.count }})
            </GameCommonSimpleResourceIconAndName>
          </el-option>
        </el-select>
      </div>

      <div class="mb-4">
        <label class="block mb-1 font-medium">每次自动喂食数量(每只猫咪)：</label>
        <el-input-number step-strictly :step="1" v-model="autoFeederSelectedFoodCount" :min="1" :max="100">
        </el-input-number>
      </div>

      <div v-if="autoFeederSelectedFoodId" class="mb-4 flex flex-col gap-2">
        <span class="text-gray-600 dark:text-gray-300 ml-2">库存量: {{ inventory[autoFeederSelectedFoodId]?.count }}
        </span>
        <span class="text-gray-600 dark:text-gray-300 ml-2">每份提供: +{{getSatietyRestore(autoFeederSelectedFoodId)}}😋 饱食度
        </span>
        <span v-if="moodRestore" class="text-gray-600 dark:text-gray-300 ml-2">每份提供: +{{moodRestore}} 😄心情
        </span>
        <span v-if="maxMoodRestore" class="text-gray-600 dark:text-gray-300 ml-2">每份提供: +{{maxMoodRestore}} 😄最大心情
        </span>
      </div>

      <template #footer>
        <el-button @click="furnitureConfigDialogVisible['autoFeeder'] = false">取消</el-button>
        <el-button type="primary" :disabled="!autoFeederSelectedFoodId" @click="updateAutoFeedSetting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 家具修理确认对话框 -->
    <el-dialog v-model="repairDialogVisible" title="修理家具" :width="device.isMobile ? '90%' : '500px'" align-center center>
      <div v-if="currentRepairFurniture" class="space-y-4">
        <!-- 家具信息 -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <GameCommonSimpleAssetsIcon :icon-size="10" :icon="getFurnitureConfig(currentRepairFurniture.furnitureId)?.icon"></GameCommonSimpleAssetsIcon>
          </div>
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">
              {{ getFurnitureConfig(currentRepairFurniture.furnitureId)?.name }}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              当前耐久度: {{ currentRepairFurniture.durability.toFixed(1) }}%
            </div>
          </div>
        </div>

        <!-- 修理需求 -->
        <div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            修理所需材料:
          </div>
          
          <div v-if="getRepairRequirements(currentRepairFurniture.furnitureId).length === 0" 
               class="text-gray-500 dark:text-gray-400 text-sm">
            此家具无需材料即可修理
          </div>
          
          <div v-else class="flex flex-wrap gap-2">
            <template v-for="req in getRepairRequirements(currentRepairFurniture.furnitureId)" 
                 :key="req.id"
                 >
              <GameCommonResourceIconAndName 
                :resource-id="req.id" 
                :count="req.count"
                :show-inventory-count="true"
                class="text-sm" />
            </template>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="repairDialogVisible = false">
            取消
          </el-button>
          <el-button 
            type="primary" 
            @click="confirmRepairFurniture"
            :disabled="!canRepairFurniture(currentRepairFurniture?.furnitureId)"
            :loading="repairLoading === currentRepairFurniture?.uuid">
            <template #icon>
              <Icon name="material-symbols:build" class="w-4 h-4" />
            </template>
            确认修理
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { allKittyFurniture, type AllKittyFurnitureID } from '~/shared/data/allKittyFurniture';
import type { UserKittyFurnitureInstance } from '~/shared/types/kittyFurniture';
import type { FuncAction } from '~/shared/types';
import { useInventory } from '~/composables/game/useInventory';
import { waitUtilConnected } from '~/api/game/socket/socket';
import {
  emitGetUserFurniture,
  onGetUserFurniture,
  onGetUserFurnitureFail,
  emitInstallFurniture,
  onInstallFurnitureSuccess,
  onInstallFurnitureFail,
  emitRepairFurniture,
  onRepairFurnitureSuccess,
  onRepairFurnitureFail,
  emitToggleFurniture,
  onToggleFurnitureSuccess,
  onToggleFurnitureFail,
  onFurnitureInstalled,
  onFurnitureRepaired,
  onFurnitureToggled,
  emitConfigureFurniture_AutoFeeder,
} from '~/api/game/socket/kittyFurniture';
import { type AllGameResourceID, GameResourceCategory } from '~/shared/types/gameResource';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';

// 响应式数据
const installedFurniture = ref<UserKittyFurnitureInstance[]>([]);
const installLoading = ref<string | null>(null);
const toggleLoading = ref<string | null>(null);
const repairLoading = ref<string | null>(null);

// 修理对话框相关
const repairDialogVisible = ref(false);
const currentRepairFurniture = ref<UserKittyFurnitureInstance | null>(null);

const device = useDevice();

// 组合式函数
const inventory = useInventory();

// 事件监听器清理函数
let offGetUserFurniture: FuncAction;
let offGetUserFurnitureFail: FuncAction;
let offInstallSuccess: FuncAction;
let offInstallFail: FuncAction;
let offToggleSuccess: FuncAction;
let offToggleFail: FuncAction;
let offFurnitureInstalled: FuncAction;
let offFurnitureRepaired: FuncAction;
let offFurnitureToggled: FuncAction;

// 计算属性
const availableFurniture = computed(() => {
  return Object.entries(allKittyFurniture).filter(([id]) => {
    // 排除已安装的家具
    return !installedFurniture.value.some(f => f.furnitureId === id);
  });
});

// 辅助函数
function getFurnitureConfig(furnitureId: string) {
  return allKittyFurniture[furnitureId as AllKittyFurnitureID];
}

function getFurnitureName(furnitureId: string) {
  return allKittyFurniture[furnitureId as AllKittyFurnitureID]?.name || furnitureId;
}

function getFurnitureEffectDescription(furnitureId: AllKittyFurnitureID, level: number) {
    return allKittyFurniture[furnitureId]?.effectDescription?.[level - 1];
}

function getDurabilityColor(durability: number) {
  if (durability >= 80) return '#67c23a';
  if (durability >= 50) return '#e6a23c';
  if (durability >= 20) return '#f56c6c';
  return '#909399';
}

function hasEnoughResource(resourceId: string, count: number) {
  return (inventory.value[resourceId]?.count || 0) >= count;
}

function canInstallFurniture(furnitureId: AllKittyFurnitureID) {
  const config = getFurnitureConfig(furnitureId);
  if (!config) return false;
  
  const requirements = config.installRequirement[0];
  if (!requirements) return true;
  
  // 检查资源需求
  if (requirements.resource) {
    for (const req of requirements.resource) {
      if (!hasEnoughResource(req.id, req.count)) return false;
    }
  }
  
  return true;
}

// 获取修理需求
function getRepairRequirements(furnitureId: string) {
  const config = getFurnitureConfig(furnitureId);
  if (!config || !config.repairRequirement || !config.repairRequirement[0]) {
    return [];
  }
  
  return config.repairRequirement[0].resource || [];
}

// 检查是否可以修理
function canRepairFurniture(furnitureId?: string) {
  if (!furnitureId) return false;
  const requirements = getRepairRequirements(furnitureId);
  
  // 如果没有修理需求，说明可以免费修理
  if (requirements.length === 0) {
    return true;
  }
  
  // 检查所有材料是否充足
  return requirements.every(req => hasEnoughResource(req.id, req.count));
}

const furnitureConfigDialogVisible = ref<Record<AllKittyFurnitureID, boolean>>({});
function showFurnitureConfig(furnitureId: AllKittyFurnitureID) {
    furnitureConfigDialogVisible.value[furnitureId] = true;
}

// 显示修理对话框
function showRepairDialog(furniture: UserKittyFurnitureInstance) {
  currentRepairFurniture.value = furniture;
  repairDialogVisible.value = true;
}

// 操作函数
function refreshFurnitureList() {
  emitGetUserFurniture();
}

async function installFurniture(furnitureId: AllKittyFurnitureID) {
  installLoading.value = furnitureId;
  emitInstallFurniture(furnitureId);
}

async function toggleFurniture(furniture: UserKittyFurnitureInstance) {
  toggleLoading.value = furniture.uuid;
  emitToggleFurniture(furniture.furnitureId as AllKittyFurnitureID, !furniture.isActive);
}

// 确认修理家具
async function confirmRepairFurniture() {
  if (!currentRepairFurniture.value?.furnitureId) return;
  
  emitRepairFurniture(currentRepairFurniture.value.furnitureId as AllKittyFurnitureID);

  repairLoading.value = currentRepairFurniture.value.uuid;
  repairDialogVisible.value = false;
  currentRepairFurniture.value = null;
}

const autoFeederSelectedFoodId = ref<AllGameResourceID>()
const autoFeederSelectedFoodCount = ref<number>()
const foodList = computed(() =>
  Object.values(allGameResourceWithInternal)
    .filter(r => r.category?.includes(GameResourceCategory.Food))
    .filter(r => (inventory.value[r.id]?.count ?? 0) > 0)
    .map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      count: inventory.value[r.id]?.count || 0
    }))
)

function getSatietyRestore(foodId: AllGameResourceID): number {
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 1
  let restore = 0
  for (const action of food.onUse) {
    if (action.resourceEffect) {
      for (const eff of action.resourceEffect) {
        if (eff.resource === "__satiety" && typeof eff.increase === "number") {
          restore += eff.increase 
        }
      }
    }
  }
  return restore
}

const moodRestore = computed(() => {
  const foodId = autoFeederSelectedFoodId.value
  if (!foodId) return 0
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 0
  let restore = 0
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "mood" && typeof eff.increase === "number") {
          restore += eff.increase 
        }
      }
    }
  }
  return restore
})

const maxMoodRestore = computed(() => {
  const foodId = autoFeederSelectedFoodId.value
  if (!foodId) return 0
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 0
  let restore = 0
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "maxMood" && typeof eff.increase === "number") {
          restore += eff.increase 
        }
      }
    }
  }
  return restore
})

async function updateAutoFeedSetting() {
  furnitureConfigDialogVisible.value.autoFeeder = false

  if (!autoFeederSelectedFoodId.value) {
    ElMessage.error('请选择食物');
    return;
  }

  emitConfigureFurniture_AutoFeeder(autoFeederSelectedFoodId.value, autoFeederSelectedFoodCount.value || 1);
}

// 生命周期
onMounted(async () => {
  await waitUtilConnected();
  
  // 设置事件监听器
  offGetUserFurniture = onGetUserFurniture(({ furniture }) => {
    installedFurniture.value = furniture;

    let autoFeeder = furniture.find(f => f.furnitureId === 'autoFeeder')
    
    if (autoFeeder) {
      autoFeederSelectedFoodId.value = autoFeeder?.config?.foodId
      autoFeederSelectedFoodCount.value = autoFeeder?.config?.count || 1
    }
  });

  offGetUserFurnitureFail = onGetUserFurnitureFail(({ message }) => {
    ElMessage.error(message || '获取家具列表失败');
  });

  offInstallSuccess = onInstallFurnitureSuccess(({ furnitureId }) => {
    installLoading.value = null;
    ElMessage.success('家具安装成功！');
    refreshFurnitureList();
  });

  offInstallFail = onInstallFurnitureFail(({ furnitureId, message }) => {
    installLoading.value = null;
    ElMessage.error(message || '安装失败');
  });

  offToggleSuccess = onToggleFurnitureSuccess(({ furnitureId, active }) => {
    toggleLoading.value = null;
    ElMessage.success(`家具已${active ? '启用' : '停用'}`);
    refreshFurnitureList();
  });

  offToggleFail = onToggleFurnitureFail(({ furnitureId, active, message }) => {
    toggleLoading.value = null;
    ElMessage.error(message || '操作失败');
  });

  // 监听实时事件
  offFurnitureInstalled = onFurnitureInstalled(({ name }) => {
    ElMessage.success(`${name} 已安装！`);
    refreshFurnitureList();
  });

  offFurnitureRepaired = onFurnitureRepaired(({ name }) => {
    ElMessage.success(`${name} 已修理完成！`);
    refreshFurnitureList();
  });

  offFurnitureToggled = onFurnitureToggled(({ name, active }) => {
    ElMessage.info(`${name} 已${active ? '启用' : '停用'}`);
    refreshFurnitureList();
  });

  // 初始加载家具列表
  refreshFurnitureList();
});

onUnmounted(() => {
  // 清理所有事件监听器
  offGetUserFurniture?.();
  offGetUserFurnitureFail?.();
  offInstallSuccess?.();
  offInstallFail?.();
  offToggleSuccess?.();
  offToggleFail?.();
  offFurnitureInstalled?.();
  offFurnitureRepaired?.();
  offFurnitureToggled?.();
});

// 暴露刷新方法
defineExpose({ refresh: refreshFurnitureList });
</script>

<style scoped>
.furniture-item {
  @apply transition-all duration-200;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .furniture-item .group-hover\:scale-\[1\.01\] {
    transform: none;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.furniture-item {
  animation: fadeIn 0.3s ease-out;
}
</style>