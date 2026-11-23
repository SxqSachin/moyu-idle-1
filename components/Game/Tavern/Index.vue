<template>
  <el-card body-class="p-3! md:p-4! test">
    <h2 class="text-2xl font-bold mb-4">小酒馆</h2>
    <div class="text-gray-600 dark:text-gray-300 mb-6 text-sm">
      这里是长途跋涉的猫猫们的温馨聚集地，这里总有新伙伴到来。你可以在这里遇见各类能干的猫猫专家，他们或许擅长战斗、强化、探险或学习。招募心仪的猫猫，让它们成为你的得力助手，一起开启更多奇妙的冒险吧！
      <br />
      <div class="text-sm mt-4 text-gray-400">
        <div class="flex flex-col gap-1 text-sm">
          <div>专家提供的加成对猫咪助手也会生效</div>
          <div>专家类别会不断扩充</div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <template v-for="cat in talentCats" :key="cat.id">
        <div v-if="!inited">
          <el-skeleton :rows="3" animated />
        </div>
        <template v-else>
          <Card :id="cat.id" @hire="onHire" @renew="onRenew" @pause="onPause" @resume="onResume"
            :state="hiredCatMap[cat.id]?.state" :disabled="!inited || !!hiredCatMap[cat.id]" :inited="inited"
            :expire-time="hiredCatMap[cat.id]?.end_date" />
        </template>
      </template>

    </div>
  </el-card>

  <el-dialog v-model="dialogVisible" title="聘用猫猫" width="350px" :before-close="() => (dialogVisible = false)">
    <div v-if="selectedCat" class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <div class="text-4xl" v-if="selectedCat.icon">{{ selectedCat.icon }}</div>
        <div>
          <div class="font-bold text-lg">{{ selectedCat.name }}</div>
          <div class="text-gray-500 dark:text-gray-400 text-sm mb-1 mt-2">
            {{ selectedCat.description }}
          </div>
          <div class="text-sm mt-2 text-gray-600 dark:text-gray-300 flex flex-wrap items-start justify-start gap-2">
            <span>时薪：</span>
            <div class="inline-flex flex-row flex-wrap gap-2 justify-start">
              <template v-for="item in selectedCatHourlyWage" :key="item.resourceId">
                <GameCommonResourceIconAndName :resource-id="item.resourceId" :count="item.count">
                </GameCommonResourceIconAndName>
              </template>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span>选择时长：</span>
        <el-slider v-model="hireHours" :min="CATTY_EXPERT_MIN_HIRE_HOUR" :max="48" :step="1" :show-input="false"
          class="flex-1" />
        <span class="ml-2">{{ hireHours }} 小时</span>
      </div>
      <el-divider class="my-2!"></el-divider>
      <div class="flex flex-col justify-start text-base">
        <div>
          <el-text>总花费：</el-text>
        </div>
        <div class="inline-flex flex-row flex-wrap gap-2 justify-start">
          <template v-for="item in selectedCatHourlyWage" :key="item.resourceId">
            <GameCommonResourceIconAndName :resource-id="item.resourceId" :count="item.count * hireHours"
              :show-inventory-count="true">
            </GameCommonResourceIconAndName>
          </template>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button class="w-full" type="primary" @click="confirmHire" :disabled="!canHire || loadingHire">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="renewDialogVisible" title="续约猫猫专家" width="350px"
    :before-close="() => (renewDialogVisible = false)">
    <div v-if="renewCatId && renewCat" class="flex flex-col gap-4">
      <div class="text-sm mt-2 text-gray-600 dark:text-gray-300 flex flex-wrap items-start justify-start gap-2">
        <span>时薪：</span>
        <div class="inline-flex flex-row flex-wrap gap-2 justify-start">
          <template v-for="item in renewCatHourlyWage" :key="item.resourceId">
            <GameCommonResourceIconAndName :resource-id="item.resourceId" :count="item.count">
            </GameCommonResourceIconAndName>
          </template>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span>选择续约时长：</span>
        <el-slider v-model="renewHours" :min="CATTY_EXPERT_MIN_HIRE_HOUR" :max="48" :step="1" class="flex-1" />
        <span class="ml-2">{{ renewHours }} 小时</span>
      </div>
      <el-divider class="my-2!"></el-divider>
      <div class="flex flex-col justify-start text-base">
        <div>
          <el-text>总花费：</el-text>
        </div>
        <div class="inline-flex flex-row flex-wrap gap-2 justify-start">
          <template v-for="item in renewCatHourlyWage"
            :key="item.resourceId">
            <GameCommonResourceIconAndName :resource-id="item.resourceId" :count="item.count * renewHours"
              :show-inventory-count="true">
            </GameCommonResourceIconAndName>
          </template>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button class="w-full" type="primary" @click="confirmRenew" :disabled="loadingRenew">确定续约</el-button>
    </template>
  </el-dialog>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import Card from "./Card.vue";
import allTalentCat from "~/shared/data/allTalentCat";
import { useInventory } from "~/composables/game/useInventory";
import { CATTY_EXPERT_MIN_HIRE_HOUR } from "~/shared/data/constant";
import {
  emitTavernHireExpert,
  onTavernHireExpertSuccess,
  onTavernHireExpertError,
  emitTavernGetMyExperts,
  onTavernGetMyExpertsSuccess,
  onTavernGetMyExpertsError,
  onTavernRenewExpertSuccess,
  onTavernRenewExpertError,
  emitTavernRenewExpert,
  onTavernPauseExpertSuccess,
  onTavernPauseExpertError,
  onTavernResumeExpertSuccess,
  onTavernResumeExpertError,
  emitPauseExpert,
  emitResumeExpert,
} from "~/api/game/socket/tavern";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { useTavern } from "~/composables/game/useTavern";
import type { FuncAction } from "~/shared/types";
import { useCharacterStatusInfo } from "~/composables/game/useCharacterStatusInfo";

const inventory = useInventory();

const talentCats = allTalentCat;

const dialogVisible = ref(false);
const selectedCatId = ref<string | null>(null);
const hireHours = ref(10);
const loadingHire = ref(false);

const inited = ref(false);

// 已招募猫猫专家列表
const hiredCats = useTavern()
const hiredCatMap = computed(() => {
  const map: Record<string, any> = {};
  for (const cat of hiredCats.value) {
    map[cat.type] = cat;
  }
  return map;
});

const selectedCat = computed(() =>
  allTalentCat.find(cat => cat.id === selectedCatId.value) || null
);

const characterStatus = useCharacterStatusInfo()
const selectedCatHourlyWage = computed(() =>{
  let hourlyWage = selectedCat.value?.hourlyWage || []
  if (selectedCat.value?.dynamicHourlyWage) {
    hourlyWage = selectedCat.value.dynamicHourlyWage(characterStatus.value);
  }

  return hourlyWage;
})

const canHire = computed(() => {
  if (!selectedCat.value || !selectedCatHourlyWage.value) return false;

  if (selectedCat.value.id && hiredCatMap.value[selectedCat.value.id]) return false;

  return selectedCatHourlyWage.value.every(item => {
    const resourceCount = inventory.value[item.resourceId]?.count ?? 0;
    return resourceCount >= item.count * hireHours.value;
  });
});

// 招募成功/失败监听解绑
let offHireSuccess: (() => void) | null = null;
let offHireError: (() => void) | null = null;
let offGetExpertsSuccess: (() => void) | null = null;
let offGetExpertsError: (() => void) | null = null;

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction

function onHire(catId: string) {
  if (hiredCatMap.value[catId]) return; // 已招募不能再招募
  selectedCatId.value = catId;
  hireHours.value = 10;
  dialogVisible.value = true;
}

const renewDialogVisible = ref(false);
const renewCatId = ref<string | null>(null);
const renewHours = ref(10);
const loadingRenew = ref(false);


const renewCat = computed(() =>
  allTalentCat.find(cat => cat.id === renewCatId.value) || null
);
const renewCatHourlyWage = computed(() =>{
  let hourlyWage = renewCat.value?.hourlyWage || []
  if (renewCat.value?.dynamicHourlyWage) {
    hourlyWage = renewCat.value.dynamicHourlyWage(characterStatus.value);
  }

  return hourlyWage;
})

let offRenewSuccess: (() => void) | null = null;
let offRenewError: (() => void) | null = null;

function handleRenewSuccess(record: any) {
  loadingRenew.value = false;
  renewDialogVisible.value = false;
  ElMessage.success(`续约成功！`);
  emitTavernGetMyExperts(); // 刷新专家列表
}

function handleRenewError(err: { message: string }) {
  loadingRenew.value = false;
  ElMessage.error(err.message || "续约失败");
}

function onRenew(catId: string) {
  renewCatId.value = catId;
  renewHours.value = 10;
  renewDialogVisible.value = true;
}

function confirmRenew() {
  if (!renewCatId.value) return;
  loadingRenew.value = true;
  emitTavernRenewExpert(renewCatId.value, renewHours.value);
}

function confirmHire() {
  if (!selectedCat.value) return;
  loadingHire.value = true;
  emitTavernHireExpert(selectedCat.value.id, hireHours.value);
}

function onPause(catId: string) {
  if (!hiredCatMap.value[catId]) return; // 未招募不能暂停
  emitPauseExpert(catId);
}

function onResume(catId: string) {
  if (!hiredCatMap.value[catId]) return; // 未招募不能恢复
  emitResumeExpert(catId);
}

function handleHireSuccess(record: any) {
  loadingHire.value = false;
  dialogVisible.value = false;
  ElMessage.success(`已成功聘用${selectedCat.value?.name} ${hireHours.value}小时！`);
  emitTavernGetMyExperts(); // 刷新专家列表
}

function handleHireError(err: { message: string }) {
  loadingHire.value = false;
  ElMessage.error(err.message || "聘用失败");
}

function handleGetExpertsSuccess(list: any[]) {
  inited.value = true;
  hiredCats.value = list || [];
}

function handleGetExpertsError(err: { message: string }) {
  ElMessage.error(err.message || "获取已招募猫猫失败");
}

onMounted(async () => {
  await waitUtilConnected()
  offHireSuccess = onTavernHireExpertSuccess(handleHireSuccess);
  offHireError = onTavernHireExpertError(handleHireError);
  offGetExpertsSuccess = onTavernGetMyExpertsSuccess(handleGetExpertsSuccess);
  offGetExpertsError = onTavernGetMyExpertsError(handleGetExpertsError);

  offRenewSuccess = onTavernRenewExpertSuccess(handleRenewSuccess);
  offRenewError = onTavernRenewExpertError(handleRenewError);

  off1 = onTavernPauseExpertSuccess((data) => {
  })
  off2 = onTavernPauseExpertError((data) => {
    ElNotification.error({
      title: "暂停失败",
      message: data.message || "暂停失败，请稍后再试",
    });
  })
  off3 = onTavernResumeExpertSuccess((data) => {
    ElNotification.success({
      title: "恢复成功",
      message: "专家已恢复工作",
    });
  })
  off4 = onTavernResumeExpertError((data) => {
    ElNotification.error({
      title: "恢复失败",
      message: data.message || "恢复失败，请稍后再试",
    })
  })

  emitTavernGetMyExperts();
});

onUnmounted(() => {
  offHireSuccess && offHireSuccess();
  offHireError && offHireError();
  offGetExpertsSuccess && offGetExpertsSuccess();
  offGetExpertsError && offGetExpertsError();

  offRenewSuccess && offRenewSuccess();
  offRenewError && offRenewError();

  off1?.();
  off2?.();
  off3?.();
  off4?.();
});
</script>