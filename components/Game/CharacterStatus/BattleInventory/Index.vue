<template>
  <div class="flex flex-col w-full">
    <div v-if="inventoryWithDetail.length" class="flex flex-wrap gap-2">
      <draggable 
        v-model="localInventoryItems"
        :disabled="isInBattle"
        class="flex flex-wrap gap-2 w-full" 
        @end="onDragEnd" 
        item-key="id" 
        handle=".inventory-item-card"
        :animation="220" 
        :ghost-class="'drag-ghost'" 
        :chosen-class="'drag-chosen'" 
        :drag-class="'drag-dragging'"
        :delay="device.isMobile ? 250 : 0"
      >
        <template #item="{ element: item }">
          <div class="relative flex items-start inventory-item-card h-fit transition-all duration-200">
            <GameCharacterStatusBattleInventoryItem
              :item="item"
              :readonly="isInBattle"
            />
          </div>
        </template>
      </draggable>
    </div>
    <el-empty v-else description="物品袋空着" />

    <!-- 添加/更新物品表单 -->
    <el-form :inline="true" @submit.prevent="addItem" class="flex flex-wrap items-center gap-4 py-2">
      <el-form-item label="物品" class="mb-0">
        <el-select v-model="newResourceId" filterable placeholder="请选择要添加的物品" style="width: 200px">
          <el-option v-for="item in inventorySelectable" :key="item.id" :label="item.name" :value="item.id">
            <span class="flex items-center gap-2">
              <GameCommonSimpleResourceIconAndName :resource-id="item.id" />
              <span class="text-xs text-gray-400 ml-2">x{{ item.count }}</span>
            </span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="数量" class="mb-0">
        <el-input-number v-model="newCount" :min="0" :max="currentSelectItemInventoryCount" :step="1" :step-strictly="true" style="width: 160px" :controls="false"
          placeholder="数量" >
          <template #suffix>
            <span class="text-gray-400">/ {{currentSelectItemInventoryCount }}</span>
          </template>
        </el-input-number>
      </el-form-item>

      <el-form-item class="mb-0">
        <el-button type="success" @click="addItem" :disabled="isInBattle || !newResourceId || newCount < 1" :loading="loading"
          class="rounded-full px-6">
          添加到物品袋
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import type { UnitBattleInventoryInfo } from "~/shared/types/unit";
import allGameResource from "~/assets/resource/allGameResource.json";
import {
  emitGetBattleInventory,
  onGetBattleInventorySuccess,
  emitAddResourceToBattleInventory,
  onAddResourceToBattleInventorySuccess,
  onAddResourceToBattleInventoryFail,
  emitReorderCharacterBattleInventory,
  onReorderCharacterBattleInventorySuccess,
  onReorderCharacterBattleInventoryError,
} from "~/api/game/socket/character";
import { emitRefillBattleInventory, emitRemoveResourceFromBattleInventory, emitUpdateBattleUseItemLogic, onRefillBattleInventoryFail, onRefillBattleInventorySuccess, onRemoveResourceFromBattleInventoryFail, onRemoveResourceFromBattleInventorySuccess, onUpdateBattleUseItemLogicFail, onUpdateBattleUseItemLogicSuccess } from '~/api/game/socket/character';
import { useInventory } from '~/composables/game/useInventory';
import type { FuncAction } from "~/shared/types";
import { emitRequestInventory } from "~/api/game/socket/inventory";
import { useBattleInfo } from "~/composables/game/useBattleInfo";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import draggable from 'vuedraggable';

const battleInventory = ref<UnitBattleInventoryInfo>({});
const loading = ref(false);
const localInventoryItems = ref<any[]>([]);
const device = useDevice();

const newResourceId = ref("");
const newCount = ref(1);

const characterInventory = useInventory();
const battleInfo = useBattleInfo()
const room = useCurrentBattleRoom()

const isInBattle = computed(() => {
  return (!!room.value && room.value?.status != 'waiting') || !!battleInfo.value?.battleStatus;
});

const currentSelectItemInventoryCount = computed(() => {
  if (!newResourceId.value) return 0;
  const item = characterInventory.value[newResourceId.value];
  return item?.count || 0;
});

// 可选物品列表：角色背包中有的且有inBattleEffect的物品
const inventorySelectable = computed(() => {
  return Object.entries(characterInventory.value)
    .filter(([id, detail]) => {
      const resource = (allGameResource as any)[id];

      if (battleInventory.value[id]) {
        // 如果物品已经在战斗物品袋中，则不再显示
        return false;
      }

      return (detail?.count ?? 0) > 0 && resource && resource.inBattleEffect;
    })
    .map(([id, detail]) => {
      const resource = (allGameResource as any)[id] || {};
      return {
        id,
        name: resource.name || id,
        count: detail?.count,
      };
    });
});

// 物品详细信息合并
const inventoryWithDetail = computed(() => {
  return Object.entries(battleInventory.value).map(([id, detail]) => {
    const resource = (allGameResource as any)[id] || {};
    return {
      id,
      name: resource.name || id,
      description: resource.description || "",
      inBattleEffect: resource.inBattleEffect,
      remainingCount: detail?.remainingCount ?? 0,
      prepareCount: detail?.prepareCount ?? 0,
      ai: detail?.ai || [],
      order: detail?.order ?? 0, // 添加排序字段
      useWhen: detail?.useWhen || [],
    };
  });
});

// 监听物品变化，按order排序并更新本地数组
watch(inventoryWithDetail, (val) => {
  localInventoryItems.value = [...val].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}, { immediate: true });

function fetchInventory() {
  emitGetBattleInventory();
}

function addItem(e: Event) {
  if (!e.isTrusted) return

  if (!newResourceId.value || newCount.value < 1) return;
  loading.value = true;

  emitAddResourceToBattleInventory(newResourceId.value, newCount.value);
  newResourceId.value = "";
  newCount.value = 1;
}

// 拖拽结束处理
function onDragEnd() {
  const itemOrder = localInventoryItems.value.map(item => item.id);
  if (itemOrder.length > 0) {
    // 发送重新排序请求到服务器
    // 你需要根据实际API调整这里
    emitReorderCharacterBattleInventory(itemOrder); // 需要实现此API
  }
}

let off: FuncAction
let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction

let off5: FuncAction
let off6: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction
let off10: FuncAction
onMounted(() => {
  fetchInventory();

  off = onGetBattleInventorySuccess((data) => {
    battleInventory.value = data;
    loading.value = false;
  });

  off1 = onAddResourceToBattleInventorySuccess((data) => {
    battleInventory.value = data;
    loading.value = false;

    ElNotification({
      title: "添加成功",
      type: "success",
    });
    emitRequestInventory()
  });
  off2 = onAddResourceToBattleInventoryFail((data) => {
    ElNotification({
      title: "添加失败:" + data.message,
      type: "error",
    });
    loading.value = false;
  });

  off3 = onReorderCharacterBattleInventorySuccess((data) => {
    battleInventory.value = data;
    ElNotification({
      title: "排序成功",
      type: "success",
    });
  })
    off4 = onReorderCharacterBattleInventoryError((data) => {
      ElNotification({
        title: "排序失败:" + data.message,
        type: "error",
      });
    });

  off5 = onRemoveResourceFromBattleInventorySuccess((data) => {
    loading.value = false;

    ElNotification({
      title: "移除成功",
      type: "success",
    });
    emitRequestInventory()
    emitGetBattleInventory()
  });
  off6 = onRemoveResourceFromBattleInventoryFail((data) => {
    ElNotification({
      title: "取回失败:" + data.message,
      type: "error",
    });
    loading.value = false;
  });


  off7 = onRefillBattleInventorySuccess((data) => {
    loading.value = false;

    ElNotification({
      title: "补充成功",
      type: "success",
    });
    emitRequestInventory()
    emitGetBattleInventory()
  });
  off8 = onRefillBattleInventoryFail((data) => {
    ElNotification({
      title: "补充失败:" + data.message,
      type: "error",
    });
    loading.value = false;
  })

  off9 = onUpdateBattleUseItemLogicSuccess((data) => {
    loading.value = false;

    ElNotification({
      title: "自动使用逻辑设置成功",
      type: "success",
    });
    emitGetBattleInventory()
  });

  off10 = onUpdateBattleUseItemLogicFail((data) => {
    loading.value = false;

    ElNotification({
      title: "自动使用逻辑设置失败:" + data.message,
      type: "error",
    });
  });

});

onUnmounted(() => {
  off?.();
  off1?.();
  off2?.();
  off3?.();
  off4?.();
  off5?.();
  off6?.();
  off7?.();
  off8?.();
  off9?.();
  off10?.();
});
</script>

<style scoped>
.inventory-item-card {
  margin: 0;
  padding: 0;
  transition: box-shadow 0.2s, transform 0.2s;
}

.drag-ghost {
  opacity: 0.5;
  background: #f3f4f6;
}

.drag-chosen {
  box-shadow: 0 0 8px 2px #6366f1;
  transform: scale(1.04);
  z-index: 10;
}

.drag-dragging {
  opacity: 0.8;
  background: #e0e7ff;
}
</style>