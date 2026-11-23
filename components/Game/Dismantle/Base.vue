<template>
    <div class="w-full flex flex-col gap-4">
        <!-- 物品选择区 -->
        <div class="flex items-center gap-3">
            <div
                class="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-100 relative flex items-center justify-center border-2 border-blue-400 shadow">
                <span v-if="selectedItem" class="text-3xl">
                    <GameCommonSimpleResourceIconAndName :resource-id="selectedItem.itemId" :icon-size="10"
                        :hide-name="true" />
                </span>
                <span v-else class="text-gray-400 text-xl">?</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-blue-700 truncate">
                    {{ selectedItem?.name ? selectedItem.name : "请选择物品" }}
                </div>
            </div>
            <el-popover placement="bottom" width="330" popper-class="pb-8!" trigger="click" ref="popoverRef">
                <template #reference>
                    <el-button type="primary" plain>
                        <span v-if="selectedItem">更换</span>
                        <span v-else>选择</span>
                        <el-icon class="ml-1"><arrow-down /></el-icon>
                    </el-button>
                </template>
                <div class="flex flex-row flex-wrap gap-x-4 gap-y-8 h-64 overflow-y-auto">
                    <template v-for="item in dismantlableList" :key="item.itemId">
                        <div class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                            @click="selectItem(item.itemId)">
                            <div class="relative w-full h-full flex items-center justify-center">
                                <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                                    :resource-id="item.itemId" :icon-size="8" :show-extra-text="true" :hide-name="true">
                                </GameCommonSimpleResourceIconAndName>
                                <div
                                    class="flex justify-end items-end text-sm text-yellow-600 dark:text-cyan-600 absolute w-16 h-16 right-1 bottom-0.5 break-all text-right drop-shadow-sm">
                                    {{ inventory[item.itemId]?.count }}
                                </div>
                            </div>
                            <div
                                class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                                {{ item.name }}
                            </div>
                        </div>
                    </template>
                </div>
            </el-popover>
<!-- 
            <el-dropdown trigger="click" @command="selectItem">
                <el-button type="primary" plain>
                    <span v-if="selectedItem">更换</span>
                    <span v-else>选择</span>
                    <el-icon class="ml-1"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item v-for="item in dismantlableList" :key="item.itemId" :command="item.itemId"
                            class="flex items-center" :disabled="item.count === 0">
                            <GameCommonSimpleResourceIconAndName :resource-id="item.itemId" />
                            <span class="ml-2 text-xs text-gray-500">(库存: {{ item.count }})</span>
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown> -->
        </div>

        <!-- 分解信息区 -->
        <div v-if="selectedItem" class="mt-2">
            <div class="flex flex-col items-start gap-4">
                <div>
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">分解可获得</div>
                    <div class="flex flex-wrap gap-2">
                        <div v-for="reward in dismantleRewards" :key="reward.id"
                            class="flex items-center gap-1 rounded py-1">
                            <GameCommonResourceIconAndName :resource-id="reward.id">
                                <span class="text-xs text-gray-500">x{{ (reward.count ?? 0) * dismantleCount }}</span>
                            </GameCommonResourceIconAndName>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">分解耗时</div>
                    <div class="flex flex-wrap gap-2">
                        <el-text> {{ formatDuration(dismantleDuration * dismantleCount) }} </el-text>
                    </div>
                </div>
            </div>

            <el-divider class="my-4!"></el-divider>

            <div class="flex flex-col md:flex-row items-center gap-4">
                <el-text class="mx-1">可分解</el-text>
                <div class="flex items-center h-8">
                    <el-input-number v-model="dismantleCount" :min="1" :max="selectedItem.count" :step-strictly="true"
                        :step="1" class="mx-2 w-48! md:w-48!" :disabled="selectedItem.count === 0"
                        controls-position="right">
                        <template #suffix>
                            <span> / {{ formatCountToStr(selectedItem.count) }}</span>
                        </template>
                    </el-input-number>
                    <el-text class="mx-1">次</el-text>
                </div>
                <span class="text-xs text-gray-400 ml-2">(库存: {{ selectedItem.count }})</span>
            </div>
            <div class="flex flex-row mt-2">
                <el-button type="primary" :disabled="selectedItem.count < 1 || !dismantleAction" @click="addToQueue()"
                    class="w-full mt-4 md:mt-4">
                    加入到队列
                </el-button>
                <el-button type="primary" :disabled="selectedItem.count < 1 || !dismantleAction"
                    @click="immediatelyStart()" class="w-full mt-4 md:mt-4">
                    立即开始分解
                </el-button>
            </div>

            <template v-if="kittyList.length && !dismantleAction?.banToKitty">
                <el-divider class="my-4! md:my-4!" />
                <div class="flex items-center mb-4">
                    <span class="text-base font-bold text-yellow-600 mr-2 w-42">🐱 小猫咪助手</span>
                    <el-select v-model="selectedKittyUuid" placeholder="选择小猫咪" class="w-full">
                        <el-option v-for="kitty in kittyList" :key="kitty.uuid" :label="kitty.name"
                            :value="kitty.uuid" />
                    </el-select>
                </div>
                <el-button type="success" class="w-full"
                    :disabled="selectedItem.count < 1 || !dismantleAction || !selectedKittyUuid"
                    @click="assignTaskToKitty">
                    指派给小猫咪完成
                </el-button>
            </template>

        </div>
        <div v-else class="text-gray-400 text-center py-8">请选择要分解的物品</div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import { useInventory } from '~/composables/game/useInventory';
import { allDismantlableResource, allDismantleAction } from '~/shared/data/allGameActions';
import allGameResource from '~/assets/resource/allGameResource.json';
import type { AllGameResourceID } from "~/shared/types/gameResource";
import type { GameActionReward } from "~/shared/types/gameAction";
import { formatCountToStr, formatDuration, } from "~/shared/utils";
import type { GameTask } from "~/shared/types/gameTask";
import { emitAddTask, emitImmediatelyStartTask } from "~/api/game/socket/taskQueue";
import { useKittyInfo } from "~/composables/game/useKittyInfo";
import { emitAddKittyTask } from "~/api/game/socket/kitty";

const props = defineProps<{
    initSelectResourceId?: AllGameResourceID; // Replace with actual type if available
}>();

const popoverRef = ref()

onMounted(() => {
    // 初始化时如果有传入物品ID，则自动选择
    if (props.initSelectResourceId) {
        selectItem(props.initSelectResourceId);
    }
})

const inventory = useInventory();

const kittyList = useKittyInfo()
const selectedKittyUuid = ref<string | undefined>(kittyList.value[0]?.uuid)

const dismantlableList = computed(() => {
  return allDismantlableResource
    .map((pItemId: AllGameResourceID) => {
        const itemId = pItemId as keyof typeof allGameResource;
      const itemInfo = allGameResource[itemId] || {};
      return {
        itemId,
        name: itemInfo.name || itemId,
        // @ts-ignore
        icon: itemInfo.icon,
        count: inventory.value[itemId]?.count || 0,
      };
    })
    .filter((item) => item.count > 0);
});

const selectedItemId = ref<string | null>(null);
const selectedItem = computed(() =>
  selectedItemId.value
    ? dismantlableList.value.find((item) => item.itemId === selectedItemId.value) || null
    : null
);

const dismantleAction = computed(() => {
    if (!selectedItem.value) return null;
    return allDismantleAction["dismantle_" + selectedItem.value.itemId] || null;
})

const dismantleCount = ref(1);
watch(selectedItem, (val) => {
  // 切换物品时重置分解数量
  dismantleCount.value = 1;
});

// 通过 allDismantleAction 获取分解产出
const dismantleRewards = computed(() => {
  if (!dismantleAction.value) return [];
  if (!dismantleAction || !dismantleAction.value.rewards) return [];
    return dismantleAction.value.rewards.map((r: GameActionReward) => {
        let rewardId = r.id as keyof typeof allGameResource;
        return {
            id: rewardId,
            name: allGameResource[rewardId]?.name || r.id,

            // @ts-ignore
            icon: allGameResource[rewardId]?.icon,
            count: r.count,
        }
    });
});

const dismantleDuration = computed(() => {
    if (!dismantleAction.value) return 0;
    // 假设每次分解耗时5秒
    return dismantleAction.value.baseDuration;
}); 

function selectItem(id: string) {
  selectedItemId.value = id;
  popoverRef.value?.hide?.();
}

function addToQueue() {
    if (!selectedItem.value || !dismantleAction.value) {
        ElMessage.warning({
            message: "请选择可分解的物品"
        })
        return
    }
    if (selectedItem.value.count === 0) {
        ElMessage.warning({
            message: "所选物品库存不足"
        })
        return
    }

    let count = dismantleCount.value
    if (!count || !Number.isInteger(count) || count <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }
    const task: GameTask = {
        actionId: dismantleAction.value?.id,
        repeatCount: count,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitAddTask(task)
    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${dismantleAction.value.name} * ${count} 次`,
        duration: 3800
    })
}
function immediatelyStart() {
    if (!selectedItem.value || !dismantleAction.value) {
        ElMessage.warning({
            message: "请选择可分解的物品"
        })
        return
    }
    if (selectedItem.value.count === 0) {
        ElMessage.warning({
            message: "所选物品库存不足"
        })
        return
    }

    let count = dismantleCount.value
    if (!count || !Number.isInteger(count) || count <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }
    const task: GameTask = {
        actionId: dismantleAction.value?.id,
        repeatCount: count,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitImmediatelyStartTask(task)
    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${dismantleAction.value.name} * ${count} 次`,
        duration: 3800
    })
}

const assignTaskToKitty = () => {
    dismantleCount.value = +dismantleCount.value
    if (!selectedKittyUuid.value || !dismantleAction.value || dismantleCount.value < 1) {
        ElMessage.warning('请选择小猫咪并输入有效次数')
        return
    }

    if (!dismantleCount.value || !Number.isInteger(dismantleCount.value) || dismantleCount.value <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }

    const task: GameTask = {
        actionId: dismantleAction.value.id,
        repeatCount: dismantleCount.value,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitAddKittyTask(selectedKittyUuid.value, task)
}
</script>