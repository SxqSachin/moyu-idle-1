<template>
    <el-card body-class="relative group h-full">
        <div class="relative flex flex-col items-center justify-start w-full h-full">
            <div class="relative flex flex-col items-center w-full">
                <div
                    class="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3 text-2xl overflow-hidden">
                    <GameCommonSimpleAssetsIcon :icon="buildingConfig.icon" :icon-size="buildingConfig.iconSize ?? 16">
                    </GameCommonSimpleAssetsIcon>
                </div>
                <div class="font-bold text-lg mb-1">{{ buildingConfig.name }}</div>
                <div class="text-gray-500 text-sm mb-2 text-center"
                    v-html="buildingConfig.description.replaceAll('\n', '<br/>')">
                </div>

                <div class="absolute top-0 right-0">
                    <Icon @click="showBuildingInfo" mode="css" name="material-symbols:info-outline"
                        class="block w-8 h-8 text-gray-400 text-2xl cursor-pointer transition-all hover:scale-110 hover:text-blue-500" />
                </div>

                <div v-if="building.status === VillageBuildingStatus.NORMAL || building.status === VillageBuildingStatus.PREPARE_UPGRADE">
                    <div v-if="isBattlePyreAltar" class="mt-2 gap-2">
                        <GameVillageBuildingEffectBattlePyreAltar :building="building"></GameVillageBuildingEffectBattlePyreAltar>
                    </div>
                    <div v-else-if="isCatVillageMonument" class="mt-2 gap-2">
                        <GameVillageBuildingEffectCatVillageMonument :building="building"></GameVillageBuildingEffectCatVillageMonument>
                    </div>
                </div>

                <!-- 建造消耗 -->
                <div class="flex flex-wrap gap-2 justify-center mb-2" v-if="building.status === 'UNBUILD'">
                    <template v-for="(cost, id) in buildingConfig.buildCost" :key="id">
                        <GameCommonResourceIconAndName :resource-id="id" :count="cost?.count">
                        </GameCommonResourceIconAndName>
                    </template>
                </div>
                <!-- 筹备进度（建造/升级） -->
                <div v-if="building.status === 'PREPARE' || building.status === 'PREPARE_UPGRADE'" class="w-full mb-2">
                    <div class="text-xs text-green-500 mb-1">{{ building.status === 'PREPARE' ? '建造筹备中' : '升级筹备中' }}</div>
                    <div class="h-96 overflow-y-auto">
                        <div v-for="fund in fundInfo || []" :key="fund.materialId"
                            class="flex flex-col items-start gap-2 mb-4">
                            <div class="flex gap-4 items-center">
                                <GameCommonResourceIconAndName :resource-id="fund.materialId" />
                                <span class="text-xs text-gray-500">已筹集: {{ formatNumber(fund.collected) }} / {{
                                    formatNumber(fund.required) }}</span>
                            </div>
                            <div class="w-full">
                                <el-progress
                                    :percentage="Math.min(100, Math.floor((fund.collected / fund.required) * 100))"
                                    :stroke-width="8" status="success" :show-text="false" />
                            </div>
                        </div>
                    </div>
                    <el-button size="small" type="primary" @click="openDonateDialog(building.type)">捐赠材料</el-button>
                </div>

                <div v-else-if="building.status == VillageBuildingStatus.BUILDING"
                    class="w-full mb-2 flex flex-col items-center">
                    <el-text class="text-yellow-500! mb-8!">建造中</el-text>

                    <div class="w-full text-xs text-center flex flex-col items-center gap-2!">
                        <el-text size="small">预计完成于: {{ formatTime(building.endBuildAt!, {hideSecond: true}) }}</el-text>
                        <el-progress class="w-full" :percentage="calcBuildingProgress(building)" :stroke-width="8"
                            status="success" :show-text="false" />
                        <el-text size="small">{{ calcBuildingProgress(building) }}%</el-text>
                    </div>
                </div>

                <div v-else-if="building.status == VillageBuildingStatus.UPGRADING"
                    class="w-full mb-2 flex flex-col items-center">
                    <el-text class="text-yellow-500! mb-8!">升级中</el-text>

                    <div class="w-full text-xs text-center flex flex-col items-center gap-2!">
                        <el-text size="small">预计完成于: {{ formatTime(building.endUpgradeAt!) }}</el-text>
                        <el-progress class="w-full" :percentage="calcUpgradeProgress(building)" :stroke-width="8"
                            status="success" :show-text="false" />
                        <el-text size="small">{{ calcUpgradeProgress(building) }}%</el-text>
                    </div>
                </div>

                <!-- 未建造，显示建造按钮 -->
                <el-button v-else-if="building.status === 'UNBUILD'" type="primary" size="small" class="mt-2"
                    :disabled="isPreparing" @click="onPrepareBuild(building.type)">
                    开始筹备
                </el-button>
            </div>

            <!-- 建筑效果区域 -->
            <div v-if="building.status === VillageBuildingStatus.NORMAL">
                <div class="mt-2 flex flex-col gap-2 text-sm text-center">
                    <span class="text-green-600 font-bold mb-4">已建成</span>
                    <div class="flex flex-col gap-2" v-if="!!building.level">
                        <span class="font-bold">当前效果:</span>
                        <div v-for="str in buildingConfig.effectStr(building.level)">
                            <p class="text-gray-500 text-sm">{{ str }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </el-card>

    <!-- 捐赠弹窗 -->
    <el-dialog v-model="donateDialog.visible" title="捐赠材料" width="400px" @close="resetDonateDialog">
        <div v-if="donateDialog.buildingType" class="flex flex-col gap-12">
            <template v-for="fund in fundInfo || []" :key="fund.materialId">
                <div v-if="fund.status !== VillageBuildingMaterialFundStatus.COMPLETED">
                    <div class="flex flex-col items-start gap-2 mb-1">
                        <div>
                            <GameCommonResourceIconAndName :resource-id="fund.materialId" />
                        </div>
                        <div class="flex justify-between w-full">
                            <span class="text-xs text-gray-500">你的库存： {{
                                formatNumber(getInventoryResourceCount(fund.materialId))
                                }}</span>
                            <span class="text-xs text-gray-500">已筹集: {{ formatNumber(fund.collected) }} / {{
                                formatNumber(fund.required)
                                }}</span>
                        </div>
                    </div>

                    <el-slider v-model="donateDialog.donateInfo[fund.materialId]" :min="0"
                        :max="Math.min(fund.required - fund.collected, getInventoryResourceCount(fund.materialId))"
                        :step="1" show-input :show-input-controls="false" size="small"
                        :format-tooltip="val => `捐赠 ${val}`" :marks="{
                            0: '0',
                            [fund.required - fund.collected]: formatNumber(fund.required - fund.collected),
                            [getInventoryResourceCount(fund.materialId)]: formatNumber(getInventoryResourceCount(fund.materialId)),
                        }" class="w-full" />
                </div>
            </template>

        </div>
        <template #footer>
            <div class="w-full pt-4 mt-4 flex gap-2">
                <el-button class="w-full" @click="donateDialog.visible = false">取消</el-button>
                <el-button class="w-full" type="primary" @click="onDonate"
                    :loading="donateDialog.loading">捐赠</el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 建筑信息弹窗 -->
    <el-dialog v-model="infoDialog.visible" width="500px" :title="buildingConfig.name || '建筑信息'">
        <el-tabs v-model="infoDialog.tab">
            <el-tab-pane label="建筑信息" name="info">
                <div class="mb-4">
                    <div class="mb-2 font-bold text-lg">{{ buildingConfig.name }}</div>
                    <div class="mb-2 text-gray-500 whitespace-pre-line">{{ buildingConfig.description }}</div>
                </div>

                <div class="flex flex-col gap-2 mb-6">
                    <div class="flex-sm mb-3">
                        <span class="font-bold">当前等级：</span>
                        <span>{{ building.level }}</span>
                    </div>
                    <div class="flex flex-col gap-2 text-sm">
                        <div class="flex flex-col gap-1" v-if="!!building.level">
                            <span class="font-bold">当前效果:</span>
                            <div v-for="str in buildingConfig.effectStr(building.level)">
                                <p>{{ str }}</p>
                            </div>
                        </div>
                        <div class="flex flex-col gap-1" v-if="building.level < buildingConfig.maxLevel">
                            <span class="font-bold">下一等级效果:</span>
                            <div v-for="str in buildingConfig.effectStr(building.level + 1)">
                                <p>{{ str }}</p>
                            </div>
                            <div class="mt-2">
                                <span class="font-bold">下一等级升级消耗：</span>
                                <div class="inline-flex flex-wrap gap-2">
                                    <template v-for="(cost, id) in nextUpgradeCost" :key="id">
                                        <GameCommonResourceIconAndName :resource-id="id" :count="cost?.count" />
                                    </template>
                                </div>
                            </div>

                            <el-button v-if="building.level != 0 && building.level < buildingConfig.maxLevel" type="primary" size="small" class="block mt-2"
                                :disabled="isPreparing" @click="onPrepareUpgrade(building.type)">
                                升级
                            </el-button>
                        </div>
                    </div>
                </div>

                <div v-if="!!building.level">
                    <span class="font-bold">每周维护费：</span>
                    <div class="inline-flex flex-wrap gap-2">
                        <template v-for="(cost, id) in currentMaintenanceFee" :key="id">
                            <GameCommonResourceIconAndName :resource-id="id" :count="cost?.count" />
                        </template>
                    </div>
                </div>
            </el-tab-pane>
            <el-tab-pane lazy label="募集信息" name="donate">
                <div v-if="Object.keys(donationInfo).length || donationLevels.length">
                    <!-- 等级选择 Tabs -->
                    <div class="mb-3">
                        <el-tabs v-model="donationLevelTab" type="card">
                            <el-tab-pane v-for="level in donationLevels" :key="level"
                                :label="+level == 0 ? '筹建' : ` Lv.${level}`" :name="level" />
                        </el-tabs>
                    </div>

                    <!-- 总体统计信息（当前等级） -->
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-4 text-xs text-gray-400">
                                <div class="">
                                    <span>参与人数：</span>
                                    <span>{{ totalUniqueDonors }}</span> 人
                                </div>
                                <div class="">
                                    <span>捐赠次数：</span>
                                    <span>{{ totalDonationCount }}</span> 次
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 材料分类Tab（当前等级） -->
                    <el-tabs v-model="donationTab" tab-position="left" class="donation-tabs">
                        <el-tab-pane :lazy="true" v-for="(donors, materialId) in donationInfo" :key="materialId"
                            :name="materialId">
                            <template #label>
                                <div class="flex items-center gap-2">
                                    <GameCommonSimpleResourceIconAndName :resource-id="materialId" />
                                </div>
                            </template>

                            <!-- 捐赠者排行榜 -->
                            <div class="flex flex-col gap-3">
                                <div
                                    class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                    <div class="flex items-center gap-2">
                                        <GameCommonSimpleResourceIconAndName :resource-id="materialId" />
                                        <span class="font-medium">募集榜</span>
                                    </div>
                                    <span class="text-sm text-gray-500">共 {{ donors.length }} 人参与</span>
                                </div>

                                <div class="flex flex-col gap-2">
                                    <GameUserBatchAvatarAndName :uuid-list="Object.values(donors).map(u => u.userUuid)">
                                        <div v-for="(donor, index) in donors" :key="donor.userUuid"
                                            class="flex items-center justify-between py-3 px-4 rounded-lg transition-colors"
                                            :class="getRankingClass(index)">
                                            <div class="flex items-center gap-3">
                                                <div class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                                                    :class="getRankBadgeClass(index)">
                                                    {{ index + 1 }}
                                                </div>
                                                <GameUserAvatarAndName :uuid="donor.userUuid" />
                                            </div>
                                            <div class="text-sm font-medium">
                                                {{ formatNumber(donor.amount) }}
                                            </div>
                                        </div>
                                    </GameUserBatchAvatarAndName>
                                </div>
                            </div>
                        </el-tab-pane>
                    </el-tabs>
                </div>
                <div v-else class="text-gray-400 text-center py-8">
                    <div class="text-2xl mb-2">📦</div>
                    <div>暂无捐赠记录</div>
                </div>

            </el-tab-pane>
        </el-tabs>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive, watch } from "vue";
import { emitGetBuiltVillageBuildings, 
         emitPrepareBuildVillageBuilding, onPrepareBuildVillageBuildingSuccess, onPrepareBuildVillageBuildingFail,
         emitDonateVillageBuildingMaterial, onDonateVillageBuildingMaterialSuccess, 
         onDonateVillageBuildingMaterialFail,
         emitGetVillageBuildingDonationList,
         emitGetVillageBuildingMaterialFund,
         onGetVillageBuildingDonationListFail,
     onGetVillageBuildingDonationListSuccess,
     emitPrepareUpgradeVillageBuilding,
     onPrepareUpgradeVillageBuildingSuccess,
     onPrepareUpgradeVillageBuildingFail,
    } from "~/api/game/socket/village/building";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import { formatNumber, formatTime } from "~/shared/utils";
import { useInventory } from "~/composables/game/useInventory";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { VillageBuildingMaterialFundStatus, VillageBuildingStatus, type GameVillageBuilding, type VillageBuildingConfig } from "~/shared/types/village/building";

const inventory = useInventory();

const donationList = ref<{
    materialId: string;
    donorUuid: string;
    amount: number;
    buildingLevel: number;
}[]>([]);

const infoDialog = ref({
  visible: false,
  tab: "info",
  buildingType: "",
});

const props = defineProps<{
  building: GameVillageBuilding;
  fundInfo: {
      collected: number,
      required: number,
      materialId: string,
      status: VillageBuildingMaterialFundStatus
  }[]
}>();

const isBattlePyreAltar = computed(() => props.building.type === 'battlePyreAltar');
const isCatVillageMonument = computed(() => props.building.type === 'catVillageMonument');

const isPreparing = ref(false);

const buildingConfig = computed<VillageBuildingConfig>(() => {
    return allVillageBuilding[props.building.type] || {};
})

const currentMaintenanceFee = computed<ItemCountInfo>(() => {
    return buildingConfig.value.maintenanceFee(props.building?.level ?? 0)
})

// 下一次升级消耗（以当前等级为基准）
const nextUpgradeCost = computed<Record<string, { count: number }>>(() => {
    if (!props.building) return {} as Record<string, { count: number }>
    const lv = props.building.level
    if (lv >= buildingConfig.value.maxLevel) return {} as Record<string, { count: number }>
    return buildingConfig.value.upgradeCost(lv) as Record<string, { count: number }>
})

const donationTab = ref(''); // 募集信息内的材料tab

// 等级 Tabs 与分组
const donationLevelTab = ref<string>(''); // 当前查看的 buildingLevel
const donationLevels = computed<string[]>(() => {
    const set = new Set<number>();
    for (const d of donationList.value) set.add(d.buildingLevel ?? 0);
    return Array.from(set).sort((a, b) => a - b).map(l => String(l));
});

type DonorEntry = { userUuid: string; amount: number };
const donationInfoByLevel = computed<Record<string, Record<string, DonorEntry[]>>>(() => {
    const res: Record<string, Record<string, DonorEntry[]>> = {};

    for (const d of donationList.value) {
        const lvlKey = String(d.buildingLevel ?? 0);
        res[lvlKey] ||= {};
        res[lvlKey][d.materialId] ||= [];

        const arr = res[lvlKey][d.materialId];
        const idx = arr.findIndex(u => u.userUuid === d.donorUuid);
        if (idx >= 0) {
            arr[idx].amount += d.amount;
        } else {
            arr.push({ userUuid: d.donorUuid, amount: d.amount });
        }
    }

    for (const lvl in res) {
        for (const materialId in res[lvl]) {
            res[lvl][materialId].sort((a, b) => b.amount - a.amount);
        }
    }
    return res;
});

// 当前等级下的材料→捐赠者映射
const donationInfo = computed<Record<string, DonorEntry[]>>(() => {
    const lvl = donationLevelTab.value;
    if (!lvl) return {};
    return donationInfoByLevel.value[lvl] || {};
});

// 默认选中最新等级
watch(donationLevels, (levels) => {
    if (!levels.length) {
        donationLevelTab.value = '';
        return;
    }
    if (!donationLevelTab.value || !levels.includes(donationLevelTab.value)) {
        donationLevelTab.value = levels[levels.length - 1];
    }
}, { immediate: true });

// 材料 Tab 的默认选中逻辑基于“当前等级”
    watch(donationInfo, (newDonationInfo) => {
        const materialIds = Object.keys(newDonationInfo);
        if (materialIds.length > 0 && !donationTab.value) {
            donationTab.value = materialIds[0];
        }
    }, { immediate: true });

// 统计数据限定到当前等级
const totalUniqueDonors = computed(() => {
    const lvl = Number(donationLevelTab.value);
    const set = new Set<string>();
    for (const d of donationList.value) {
        if (d.buildingLevel === lvl) set.add(d.donorUuid);
    }
    return set.size;
});
const totalDonationCount = computed(() => {
    const lvl = Number(donationLevelTab.value);
    return donationList.value.filter(d => d.buildingLevel === lvl).length;
});

watch(donationInfo, (newDonationInfo) => {
  const materialIds = Object.keys(newDonationInfo);
  if (materialIds.length > 0 && !donationTab.value) {
    donationTab.value = materialIds[0];
  }
}, { immediate: true });

function getRankingClass(index: number) {
    if (index === 0) return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800';
    if (index === 1) return 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    if (index === 2) return 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800';
    return 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800';
}

// 获取排名徽章样式
function getRankBadgeClass(index: number) {
    if (index === 0) return 'bg-yellow-400 text-white';
    if (index === 1) return 'bg-gray-400 text-white';
    if (index === 2) return 'bg-orange-400 text-white';
    return 'bg-blue-50 dark:bg-blue-900 text-blue-400 dark:text-blue-400';
}

let off3: FuncAction
let off4: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction
let off10: FuncAction
let off11: FuncAction

// 获取所有建筑
function fetchBuildings() {
  emitGetBuiltVillageBuildings();
}

onMounted(async () => {
  await waitUtilConnected()
  fetchBuildings();

  off3 = onPrepareBuildVillageBuildingSuccess((data) => {
    fetchBuildings();
  });
  off4 = onPrepareBuildVillageBuildingFail((data) => {
    ElNotification.error({
      title: "筹备失败",
      message: data.message || "筹备失败"
    });
    isPreparing.value = false;
  });
  off7 = onDonateVillageBuildingMaterialFail((data) => {
    ElNotification.error({
      title: "捐赠失败",
      message: data.message || "捐赠失败"
    });
    donateDialog.loading = false;
  });

  off8 = onGetVillageBuildingDonationListSuccess((data) => {
    donationList.value = data.list
  });
  off9 = onGetVillageBuildingDonationListFail((data) => {
    ElNotification.error({
      title: "获取捐赠信息失败",
      message: data.message || "获取捐赠信息失败"
    });
  });
    off10 = onPrepareUpgradeVillageBuildingSuccess((data) => {
        fetchBuildings();
    });
    off11 = onPrepareUpgradeVillageBuildingFail((data) => {
        ElNotification.error({
            title: "升级筹备失败",
            message: data.message || "升级筹备失败"
        });
        isPreparing.value = false;
    });
});

onUnmounted(() => {
  if (off3) off3();
  if (off4) off4();
  if (off7) off7();
  if (off8) off8();
  if (off9) off9();
    if (off10) off10();
    if (off11) off11();
});

// 筹备
function onPrepareBuild(type: string) {
  isPreparing.value = true;
  emitPrepareBuildVillageBuilding(type);
}

// 升级筹备
function onPrepareUpgrade(type: string) {
    infoDialog.value.visible = false;
    isPreparing.value = true;
    emitPrepareUpgradeVillageBuilding(type);
}

// 捐赠弹窗
const donateDialog = reactive({
  visible: false,
  buildingType: "",
  donateInfo: {} as Record<string, number>,
  loading: false,
});

function openDonateDialog(type: string) {
  donateDialog.visible = true;
  donateDialog.buildingType = type;
  donateDialog.donateInfo = {};
  // 初始化每种材料的最大可捐赠数量
  const funds = props.fundInfo || [];
  funds.forEach(fund => {
    donateDialog.donateInfo[fund.materialId] = 0;
  });
    // 确保弹窗打开时获取到最新的筹资列表（尤其是升级筹备阶段）
    emitGetVillageBuildingMaterialFund(type);
}

function resetDonateDialog() {
  donateDialog.visible = false;
  donateDialog.buildingType = "";
  donateDialog.donateInfo = {};
  donateDialog.loading = false;
}

// 当筹资列表更新且弹窗仍打开时，确保滑块模型具备对应键值
watch(() => props.fundInfo, (newFunds) => {
    if (!donateDialog.visible) return;
    for (const f of newFunds || []) {
        if (donateDialog.donateInfo[f.materialId] == null) {
            donateDialog.donateInfo[f.materialId] = 0;
        }
    }
}, { deep: true });

function onDonate() {
  if (!donateDialog.buildingType) return;
  donateDialog.loading = true;
  // 组装捐赠数据
  const info: Record<string, { count: number }> = {};
  for (const id in donateDialog.donateInfo) {
    const count = donateDialog.donateInfo[id];
    if (count > 0) info[id] = { count };
  }
  emitDonateVillageBuildingMaterial(donateDialog.buildingType, info);
  donateDialog.loading = false;
  donateDialog.visible = false;
}

function calcBuildingProgress(building: GameVillageBuilding) {
  if (building.status === VillageBuildingStatus.BUILDING) {
    const start = new Date(building.startBuildAt!).getTime();
    const end = new Date(building.endBuildAt!).getTime();
    return Math.min(100, Math.floor(((Date.now() - start) / (end - start)) * 100));
  }
  return 0;
}

function calcUpgradeProgress(building: GameVillageBuilding) {
    if (building.status === VillageBuildingStatus.UPGRADING) {
        const start = new Date(building.startUpgradeAt!).getTime();
        const end = new Date(building.endUpgradeAt!).getTime();
        return Math.min(100, Math.floor(((Date.now() - start) / (end - start)) * 100));
    }
    return 0;
}

function getInventoryResourceCount(resourceId: string): number {
  const resourceCount = inventory.value[resourceId]?.count ?? 0
  return resourceCount
}

function showBuildingInfo() {
  infoDialog.value.visible = true;
  infoDialog.value.tab = "info";
  infoDialog.value.buildingType = props.building.type;
  // 拉取捐赠信息
  emitGetVillageBuildingDonationList(props.building.type);
}
</script>