<template>
  <el-card body-class="relative group h-full">
    <div class="relative flex flex-col items-center justify-between w-full h-full">
      <div class="relative flex flex-col items-center w-full">
        <div
          class="w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3 text-2xl overflow-hidden">
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

        <div
          v-if="building.status === GuildBuildingStatus.NORMAL || building.status === GuildBuildingStatus.PREPARE_UPGRADE">

          <div v-if="isWishingPool" class="mt-2 flex gap-2">
            <GameGuildBuildingEffectWishingPool :guild-uuid="guildUuid"></GameGuildBuildingEffectWishingPool>
          </div>
          <div v-if="isVitalityCatStatue" class="mt-2 flex gap-2">
            <GameGuildBuildingEffectVitalityCatStatue :guild-uuid="guildUuid" />
          </div>
          <div v-if="isDenseFogLightHouse" class="mt-2 flex gap-2">
            <GameGuildBuildingEffectDenseFogLighthouse :guild-uuid="guildUuid" />
          </div>
          <div v-if="isGuildGrandBathhouse" class="mt-2 flex gap-2">
            <GameGuildBuildingEffectGuildGrandBathhouse :guild-uuid="guildUuid" />
          </div>
          <!-- <div v-if="isMeowSpiritMirror" class="mt-2 flex gap-2">
          <GameGuildBuildingEffectMeowSpiritMirror :guild-uuid="guildUuid" />
        </div> -->
        </div>
      </div>

      <!-- 建造消耗 -->
      <div class="flex flex-wrap gap-2 justify-center mb-2" v-if="building.status === 'UNBUILD'">
        <template v-for="(cost, id) in buildingConfig.buildCost" :key="id">
          <GameCommonResourceIconAndName :resource-id="id" :count="cost?.count">
          </GameCommonResourceIconAndName>
        </template>
      </div>
      <!-- 筹备进度 -->
      <div
        v-if="building.status === GuildBuildingStatus.PREPARE || building.status === GuildBuildingStatus.PREPARE_UPGRADE"
        class="w-full mb-2">

        <template v-if="building.status === GuildBuildingStatus.PREPARE_UPGRADE">
          <el-divider></el-divider>
        </template>

        <template v-if="building.status === GuildBuildingStatus.PREPARE">
          <div class="text-xs text-blue-500 mb-4">筹备建造中</div>
        </template>
        <template v-if="building.status === GuildBuildingStatus.PREPARE_UPGRADE">
          <div class="text-xs text-blue-500 mb-4">筹备升级中</div>
        </template>
        <div v-for="fund in fundInfo || []" :key="fund.materialId" class="flex flex-col items-start gap-2 mb-4">
          <div class="flex gap-4 items-center">
            <GameCommonResourceIconAndName :resource-id="fund.materialId" />
            <span class="text-xs text-gray-500">已筹集: {{ formatNumber(fund.collected) }} / {{
              formatNumber(fund.required) }}</span>
          </div>
          <div class="w-full">
            <el-progress :percentage="Math.min(100, Math.floor((fund.collected / fund.required) * 100))"
              :stroke-width="8" status="success" :show-text="false" />
          </div>
        </div>
        <el-button size="small" type="primary" @click="openDonateDialog(building.type)">捐赠材料</el-button>
        <!-- <el-button size="small" type="primary" v-if="hasPremissionToUseGuildInventoryToBuild" @click="openDonateDialog(building.type)">使用公会仓库的材料</el-button> -->
      </div>

      <div v-else-if="building.status == GuildBuildingStatus.BUILDING" class="w-full mb-2 flex flex-col items-center">
        <el-text class="text-yellow-500! mb-8!">建造中</el-text>

        <div class="w-full text-xs text-center flex flex-col items-center gap-2!">
          <el-text size="small">预计完成于: {{ formatTime(building.endBuildAt!) }}</el-text>
          <el-progress class="w-full" :percentage="calcBuildingProgress(building)" :stroke-width="8" status="success"
            :show-text="false" />
          <el-text size="small">{{ calcBuildingProgress(building) }}%</el-text>
        </div>
      </div>
      <div v-else-if="building.status == GuildBuildingStatus.UPGRADING" class="w-full mb-2 flex flex-col items-center">
        <el-text class="text-cyan-500! mb-8!">升级中</el-text>

        <div class="w-full text-xs text-center flex flex-col items-center gap-2!">
          <el-text size="small">预计完成于: {{ formatTime(building.endUpgradeAt!) }}</el-text>
          <el-progress class="w-full" :percentage="calcUpgradingProgress(building)" :stroke-width="8" status="success"
            :show-text="false" />
          <el-text size="small">{{ calcUpgradingProgress(building) }}%</el-text>
        </div>
      </div>

      <!-- 已建造 -->
      <!-- <div v-else-if="building.status === 'NORMAL'" class="text-green-600 text-sm font-bold mt-2">已建造</div> -->
      <!-- 未建造，显示建造按钮 -->
      <el-button v-else-if="building.status === 'UNBUILD'" type="primary" size="small" class="mt-2"
        :disabled="isPreparing" @click="onPrepareBuild(building.type)">
        开始筹备
      </el-button>
    </div>


  </el-card>
  <!-- 捐赠弹窗 -->
  <el-dialog v-model="donateDialog.visible" title="捐赠材料" width="400px" @close="resetDonateDialog">
    <div v-if="donateDialog.buildingType" class="flex flex-col gap-12">
      <template v-for="fund in fundInfo || []" :key="fund.materialId">
        <div v-if="fund.status !== 'COMPLETED'">
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
          <!-- <el-input-number v-model="donateDialog.donateInfo[fund.materialId]" :min="0"
            :max="fund.required - fund.collected" :step="1" class="w-full"
            :placeholder="`最多可捐赠${fund.required - fund.collected}`" /> -->

          <el-slider v-model="donateDialog.donateInfo[fund.materialId]" :min="0"
            :max="Math.min(fund.required - fund.collected, getInventoryResourceCount(fund.materialId))" :step="1"
            show-input :show-input-controls="false" size="small" :format-tooltip="val => `捐赠 ${val}`" :marks="{
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
        <el-button class="w-full" type="primary" @click="onDonate" :loading="donateDialog.loading">捐赠</el-button>
      </div>
    </template>
  </el-dialog>


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
            <span>{{ props.building.level }}</span>
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

        <template v-if="(isLeader || isOfficer) && building.status == GuildBuildingStatus.NORMAL">
          <template v-if="building.level < buildingConfig.maxLevel">
            <el-divider class="my-2! mb-3!"></el-divider>
            <div>
              <el-button type="primary" @click="showPrepareUpgradeDialog = true">筹备升级</el-button>
            </div>
          </template>
        </template>
      </el-tab-pane>
      <el-tab-pane lazy label="募集信息" name="donate">
        <div v-if="donationLevels.length">
          <!-- 新增：等级选择 Tabs -->
          <div class="mb-3">
            <el-tabs v-model="donationLevelTab" type="card">
              <el-tab-pane v-for="level in donationLevels" :key="level" :label="+level == 0 ? '筹建' : ` Lv.${level}`"
                :name="level" />
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

          <!-- 材料分类Tab（当前等级下的材料聚合） -->
          <el-tabs v-model="donationTab" tab-position="left" class="donation-tabs">
            <el-tab-pane :lazy="true" v-for="(donors, materialId) in donationInfo" :key="materialId" :name="materialId">
              <template #label>
                <div class="flex items-center gap-2">
                  <GameCommonSimpleResourceIconAndName :resource-id="materialId" />
                </div>
              </template>

              <!-- 捐赠者排行榜 -->
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
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

  <el-dialog v-model="showPrepareUpgradeDialog" title="筹备升级" width="400px" @close="showPrepareUpgradeDialog = false">
    <div class="flex flex-col gap-4 text-sm text-gray-500 dark:text-gray-400">
      <div class="text-gray-800 dark:text-gray-200">是否确认筹备升级？</div>
      <div>开始筹备后，公会成员便可以进行资源捐赠</div>
      <div>当升级所需的资源筹备完毕后，建筑物将开始进行升级，期间建筑物无法进行使用</div>
      <div>筹备升级期间建筑物使用不受影响</div>

      <div class="mt-4">
        <div class="text-gray-800 dark:text-gray-200">本次升级所需素材：</div>

        <div class="inline-flex flex-wrap gap-2 mt-2">
          <template v-for="(cost, id) in buildingConfig.upgradeCost(building.level)" :key="id">
            <GameCommonResourceIconAndName :resource-id="id" :count="cost?.count">
            </GameCommonResourceIconAndName>
          </template>
        </div>
      </div>
    </div>


    <template #footer>
      <div class="w-full flex gap-2">
        <el-button class="w-full" @click="showPrepareUpgradeDialog = false">取消</el-button>
        <el-button class="w-full" type="primary" @click="onPrepareUpgrade(building.type)" :loading="isPreparing">确认
          筹备</el-button>
      </div>
    </template>

  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive } from "vue";
import { emitGetBuiltGuildBuildings, 
         emitPrepareBuildGuildBuilding, onPrepareBuildGuildBuildingSuccess, onPrepareBuildGuildBuildingFail,
         emitDonateGuildBuildingMaterial, onDonateGuildBuildingMaterialSuccess, 
         onDonateGuildBuildingMaterialFail,
         emitGetGuildBuildingDonationList,
         onGetGuildBuildingDonationListFail,
         onGetGuildBuildingDonationListSuccess,
         emitPrepareUpgradeGuildBuilding,
         onPrepareUpgradeGuildBuildingFail,
         onPrepareUpgradeGuildBuildingSuccess} from "~/api/game/socket/guildBuilding";
import { allGuildBuilding } from "~/shared/data/allGuildBuilding";
import { useMyGuild } from "~/composables/game/useMyGuild";
import { dividerProps, ElMessage } from "element-plus";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { type GuildBuildingConfig, GuildBuildingStatus, GuildRole, type GameGuildBuilding, type GuildMemberInfo } from "~/shared/types/guild";
import { formatNumber, formatTime, randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import { useInventory } from "~/composables/game/useInventory";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

const myGuild = useMyGuild();
const inventory = useInventory();
const guildUuid = computed(() => myGuild.value?.uuid || "");

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
  guildUuid: string;
  building: GameGuildBuilding;
  fundInfo: any[],
  myMemberInfo: GuildMemberInfo
}>();

const isLeader = computed(() => myGuild.value?.uuid == props.myMemberInfo.guildUuid && props.myMemberInfo.role === GuildRole.LEADER)
const isOfficer = computed(() => myGuild.value?.uuid == props.myMemberInfo.guildUuid && props.myMemberInfo.role === GuildRole.OFFICER)

const hasPremissionToUseGuildInventoryToBuild = computed(() => {
  return isLeader.value || isOfficer.value
})

// const allBuildingInfo = ref<GameGuildBuilding[]>([]);
// const allBuiltBuildings = ref<GameGuildBuilding[]>([]);
// const materialFundMap = reactive<Record<string, any[]>>({});
const isPreparing = ref(false);
const showPrepareUpgradeDialog = ref(false);

const buildingConfig = computed<GuildBuildingConfig>(() => {
    return allGuildBuilding[props.building.type] || {};
})

const currentMaintenanceFee = computed<ItemCountInfo>(() => {
    return buildingConfig.value.maintenanceFee(props.building?.level ?? 0)
})

const isWishingPool = computed(() => props.building.type === 'wishing_pool');
const isVitalityCatStatue = computed(() => props.building.type === 'vitalityCatStatue');
const isDenseFogLightHouse = computed(() => props.building.type === 'denseFogLighthouse');
const isGuildGrandBathhouse = computed(() => props.building.type === 'guildGrandBathhouse');
// const isMeowSpiritMirror = computed(() => props.building.type === 'meowSpiritMirror');

const donationTab = ref(''); // 募集信息内的材料tab

// 新增：等级 Tabs 选择与可选等级列表
const donationLevelTab = ref<string>(''); // 当前查看的 buildingLevel
const donationLevels = computed<string[]>(() => {
  const set = new Set<number>();
  for (const d of donationList.value) set.add(d.buildingLevel ?? 0);
  // 升序排列，转成字符串作为 Tabs 的 name
  return Array.from(set).sort((a, b) => a - b).map(l => String(l));
});

// 新增：按等级→材料→捐赠者 聚合后的完整数据
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

  // 各材料内按捐赠量倒序
  for (const lvl in res) {
    for (const materialId in res[lvl]) {
      res[lvl][materialId].sort((a, b) => b.amount - a.amount);
    }
  }
  return res;
});

// 保持原变量名 donationInfo，但它现在是“当前等级”的材料→捐赠者映射
const donationInfo = computed<Record<string, DonorEntry[]>>(() => {
  const lvl = donationLevelTab.value;
  if (!lvl) return {};
  return donationInfoByLevel.value[lvl] || {};
});

// 当可选等级变化时，默认选中最后一个（通常为最新/最高等级）
watch(donationLevels, (levels) => {
  if (!levels.length) {
    donationLevelTab.value = '';
    return;
  }
  if (!donationLevelTab.value || !levels.includes(donationLevelTab.value)) {
    donationLevelTab.value = levels[levels.length - 1];
  }
}, { immediate: true });

// 材料 Tab 的默认选中逻辑仍保留，但基于“当前等级的数据”
watch(donationInfo, (newDonationInfo) => {
  const materialIds = Object.keys(newDonationInfo);
  if (materialIds.length > 0 && !donationTab.value) {
    donationTab.value = materialIds[0];
  } else if (!materialIds.includes(donationTab.value)) {
    donationTab.value = materialIds[0] || '';
  }
}, { immediate: true });

// 统计数据改为“当前等级”
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
// let off6: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction

let off10: FuncAction
let off11: FuncAction

// 获取所有建筑
function fetchBuildings() {
  if (!guildUuid.value) return;
  emitGetBuiltGuildBuildings(guildUuid.value);
}
onMounted(async () => {
  await waitUtilConnected()
  fetchBuildings();

  off3 = onPrepareBuildGuildBuildingSuccess((data) => {
    fetchBuildings();
  });
  off4 = onPrepareBuildGuildBuildingFail((data) => {
    ElNotification.error({
      title: "筹备失败",
      message: data.message || "筹备失败"
    });
    isPreparing.value = false;
  });

  off7 = onDonateGuildBuildingMaterialFail((data) => {
    ElNotification.error({
      title: "捐赠失败",
      message: data.message || "捐赠失败"
    });
    donateDialog.loading = false;
  });

  off8 = onGetGuildBuildingDonationListSuccess((data) => {
    donationList.value = data.list
  });
  off9 = onGetGuildBuildingDonationListFail((data) => {
    ElNotification.error({
      title: "获取捐赠信息失败",
      message: data.message || "获取捐赠信息失败"
    });
  });
  off10 = onPrepareUpgradeGuildBuildingSuccess((data) => {
    fetchBuildings();
    showPrepareUpgradeDialog.value = false;
    infoDialog.value.visible = false;
  });
  off11 = onPrepareUpgradeGuildBuildingFail((data) => {
    ElNotification.error({
      title: "筹备升级失败",
      message: data.message || "筹备升级失败"
    })
    isPreparing.value = false;
    infoDialog.value.visible = false;
    showPrepareUpgradeDialog.value = false;
  })
});
onUnmounted(() => {
  if (off3) off3();
  if (off4) off4();
  // if (off6) off6();
  if (off7) off7();
  if (off8) off8();
  if (off9) off9();

  off10?.()
  off11?.()
});

// 筹备
function onPrepareBuild(type: string) {
  if (!guildUuid.value) return;
  isPreparing.value = true;
  emitPrepareBuildGuildBuilding(guildUuid.value, type);
}

function onPrepareUpgrade(type: string) {
  if (!guildUuid.value) return;
  isPreparing.value = true;
  emitPrepareUpgradeGuildBuilding(guildUuid.value, type);
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
}
function resetDonateDialog() {
  donateDialog.visible = false;
  donateDialog.buildingType = "";
  donateDialog.donateInfo = {};
  donateDialog.loading = false;
}
function onDonate() {
  if (!guildUuid.value || !donateDialog.buildingType) return;
  donateDialog.loading = true;
  // 组装捐赠数据
  const info: Record<string, { count: number }> = {};
  for (const id in donateDialog.donateInfo) {
    const count = donateDialog.donateInfo[id];
    if (count > 0) info[id] = { count };
  }
  emitDonateGuildBuildingMaterial(guildUuid.value, donateDialog.buildingType, info);
  donateDialog.loading = false;
  donateDialog.visible = false;
}

function calcBuildingProgress(building: GameGuildBuilding) {
  if (building.status === GuildBuildingStatus.BUILDING || building.status === GuildBuildingStatus.UPGRADING) {
    const start = new Date(building.startBuildAt!).getTime();
    const end = new Date(building.endBuildAt!).getTime();
    return Math.min(100, Math.floor(((Date.now() - start) / (end - start)) * 100));
  }
  return 0;
}

function calcUpgradingProgress(building: GameGuildBuilding) {
  if (building.status === GuildBuildingStatus.BUILDING || building.status === GuildBuildingStatus.UPGRADING) {
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

  emitGetGuildBuildingDonationList(guildUuid.value, props.building.type);
}

const userListBatchDone = ref(false);
function handleBatchDone() {
    userListBatchDone.value = true
}

</script>