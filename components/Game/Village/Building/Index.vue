<template>
  <div class="p-1 md:p-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
      <template v-for="building in allBuildingInfo" :key="building.type">
        <GameVillageBuildingCard :building="building" :fund-info="materialFundMap[building.type] ?? []"></GameVillageBuildingCard>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from "vue";
import { emitGetBuiltVillageBuildings, onGetBuiltVillageBuildingsSuccess, onGetBuiltVillageBuildingsFail,
         emitGetVillageBuildingMaterialFund, onGetVillageBuildingMaterialFundSuccess,
         onDonateVillageBuildingMaterialSuccess,
         } from "~/api/game/socket/village/building";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { VillageBuildingMaterialFundStatus, VillageBuildingStatus, type GameVillageBuilding } from "~/shared/types/village/building";

const allBuildingInfo = ref<GameVillageBuilding[]>([]);
const materialFundMap = reactive<
    Record<string, {
        collected: number,
        required: number,
        materialId: string,
        status: VillageBuildingMaterialFundStatus
    }[]>
>({});

let off1: FuncAction
let off2: FuncAction
let off5: FuncAction
let off6: FuncAction

// 获取所有建筑
function fetchBuildings() {
  emitGetBuiltVillageBuildings();
}

onMounted(async () => {
  await waitUtilConnected()
  fetchBuildings();

  allBuildingInfo.value = initAllBuildingInfo();
  
  off1 = onGetBuiltVillageBuildingsSuccess((data) => {
    // 先初始化为所有未建造
    const merged = initAllBuildingInfo();
    // 用已建造数据覆盖
    data.list.forEach((b: GameVillageBuilding) => {
      const idx = merged.findIndex(item => item.type === b.type);
      if (idx !== -1) merged[idx] = b;
    });
    allBuildingInfo.value = merged;

    // 拉取所有处于筹备中的建筑（建造/升级）的材料筹集情况
    data.list.forEach((b: any) => {
      if (b.status === "PREPARE" || b.status === "PREPARE_UPGRADE") {
        emitGetVillageBuildingMaterialFund(b.type);
      }
    });
  });

  off2 = onGetBuiltVillageBuildingsFail((data) => {
    ElNotification.error({
      title: "获取建筑失败",
      message: data.message || "获取建筑失败，请稍后再试"
    });
  });
  
  off5 = onGetVillageBuildingMaterialFundSuccess((data) => {
    materialFundMap[data.buildingType] = data.fundList;
  });

  off6 = onDonateVillageBuildingMaterialSuccess(() => {
    ElNotification.success({
      title: "捐赠成功",
    });
  });
});

onUnmounted(() => {
  if (off1) off1();
  if (off2) off2();
  if (off5) off5();
  off6?.()
});

function initAllBuildingInfo() {
  const arr: GameVillageBuilding[] = [];
  Object.values(allVillageBuilding).forEach((cfg) => {
    arr.push({
      uuid: "",
      type: cfg.id,
      level: 0,
      exp: 0,
      maxLevel: cfg.maxLevel,
      status: VillageBuildingStatus.UNBUILD,

      startBuildAt: null,
      endBuildAt: null,
      startUpgradeAt: null,
      endUpgradeAt: null,

      createdAt: new Date(0),
      updatedAt: new Date(0),
      extra: null,
    });
  });
  return arr;
}
</script>