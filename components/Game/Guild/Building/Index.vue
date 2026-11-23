<template>
  <div class="p-1 md:p-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
      <template v-for="building in allBuildingInfo" :key="building.type">
        <GameGuildBuildingCard :my-member-info="myMemberInfo" :building="building" :fund-info="materialFundMap[building.type] ?? []" :guild-uuid="guildUuid"></GameGuildBuildingCard>
      </template>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive } from "vue";
import { emitGetBuiltGuildBuildings, onGetBuiltGuildBuildingsSuccess, onGetBuiltGuildBuildingsFail,
         emitGetGuildBuildingMaterialFund, onGetGuildBuildingMaterialFundSuccess,
         onDonateGuildBuildingMaterialSuccess,
         } from "~/api/game/socket/guildBuilding";
import { allGuildBuilding } from "~/shared/data/allGuildBuilding";
import { useMyGuild } from "~/composables/game/useMyGuild";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { GuildBuildingStatus, type GameGuildBuilding, type GuildMemberInfo } from "~/shared/types/guild";

defineProps<{
  myMemberInfo: GuildMemberInfo
}>()

const myGuild = useMyGuild();
const guildUuid = computed(() => myGuild.value?.uuid || "");

const allBuildingInfo = ref<GameGuildBuilding[]>([]);
// const allBuiltBuildings = ref<GameGuildBuilding[]>([]);
const materialFundMap = reactive<Record<string, any[]>>({});

let off1: FuncAction
let off2: FuncAction
let off5: FuncAction
let off6: FuncAction

// 获取所有建筑
function fetchBuildings() {
  if (!guildUuid.value) return;
  emitGetBuiltGuildBuildings(guildUuid.value);
}
onMounted(async () => {
  await waitUtilConnected()
  fetchBuildings();

  allBuildingInfo.value = initAllBuildingInfo();
  off1 = onGetBuiltGuildBuildingsSuccess((data) => {
    // 先初始化为所有未建造
    const merged = initAllBuildingInfo();
    // 用已建造数据覆盖
    data.list.forEach((b: GameGuildBuilding) => {
      const idx = merged.findIndex(item => item.type === b.type);
      if (idx !== -1) merged[idx] = b;
    });
    allBuildingInfo.value = merged;

    // 拉取所有处于筹备中的建筑的材料筹集情况
    data.list.forEach((b: any) => {
      if (b.status === GuildBuildingStatus.PREPARE || b.status === GuildBuildingStatus.PREPARE_UPGRADE) {
        emitGetGuildBuildingMaterialFund(guildUuid.value, b.type);
      }
    });
  });

  off2 = onGetBuiltGuildBuildingsFail((data) => {
    ElNotification.error({
      title: "获取建筑失败",
      message: data.message || "获取建筑失败，请稍后再试"
    });
  });
  off5 = onGetGuildBuildingMaterialFundSuccess((data) => {
    materialFundMap[data.buildingType] = data.fundList;
  });

  off6 = onDonateGuildBuildingMaterialSuccess(() => {
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
  const arr: GameGuildBuilding[] = [];
  Object.values(allGuildBuilding).forEach((cfg) => {
    arr.push({
      uuid: "",
      guildUuid: guildUuid.value,
      type: cfg.id,
      level: 0,
      exp: 0,
      maxLevel: cfg.maxLevel,
      status: GuildBuildingStatus.UNBUILD,

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