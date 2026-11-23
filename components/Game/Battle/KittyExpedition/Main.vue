<template>
    <div class="p-4">
        <h2 class="text-2xl font-bold mb-4">探险队</h2>
        <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            你可以让你的小猫咪出去探险！
            <ul class="list-decimal list-inside text-xs text-xs/6 mt-2">
                <li>出发探险需要消耗一些资源，探险区域的资源需求可以在创建探险队时查看。</li>
                <li>出发探险后你的小猫咪就无法继续工作咯。不过在探险归来后将会自动继续之前的工作。</li>
                <li>出发前往探索地点、从探索地点回家，都会消耗一定时间（1～2分钟，取决于小猫咪是否专心）。</li>
                <li>在探险队到达探索地点后，将开始自由探索，随着时间推移，随机得到可从此区域获得的战利品。</li>
                <li>如果探险队中的猫咪有多个来源，则不同来源的猫咪所获取的战利品将分别被计算。</li>
                <li>探险队在到达探索地点后，可随时召回探险队。</li>
                <li>探险队在回到家后，会将探索得到的战利品放回仓库，然后继续之前的工作</li>
                <li>探险队中的小猫咪越多，获得物品的数量和概率也越大</li>
                <li>探险队目前没有时间限制，也不受饱食度影响</li>
            </ul>
        </div>

        <el-divider></el-divider>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <template v-for="area in areaList" :key="area.id">
                <el-card class="cursor-pointer hover:shadow-xl transition"
                    body-class="h-full flex flex-col justify-between">
                    <div class="flex flex-col gap-2">
                        <div class="text-lg font-bold">{{ area.name }}</div>

                        <div class="flex flex-row items-center gap-1 mt-2 text-gray-500">

                            <span class="text-sm text-gray-500">
                                所需物资：
                            </span>
                            <template v-for="(count, id) of getExpeditionRequireResource(area.id)" :key="id">
                                <GameCommonResourceIconAndName :resource-id="id" :count="count?.count" :show-inventory-count="true"></GameCommonResourceIconAndName>
                            </template>
                        </div>
                    </div>

                    <div>
                        <!-- <el-divider></el-divider> -->
                        <div class="flex flex-row gap-4 mt-4">
                            <el-button type="primary" class="mx-0! w-full"
                                @click.stop="openCreateExpedition(area)">创建探险队</el-button>
                        </div>
                    </div>
                </el-card>
            </template>
        </div>

        <el-dialog v-model="showCreateDialog" title="创建战斗房间" width="400px">
            <el-form :model="editForm" label-width="100px" class="pt-2">
                <el-form-item label="房间名称" required>
                    <el-input v-model="editForm.name" maxlength="20" show-word-limit placeholder="请输入房间名称" />
                </el-form-item>

                <el-form-item label="选择猫咪" required>
                    <el-select v-model="editForm.kittyUuids" multiple placeholder="选择小猫咪" class="w-full">
                        <el-option v-for="kitty in availableKitties" :key="kitty.uuid" :label="kitty.name"
                            :value="kitty.uuid" />
                    </el-select>
                </el-form-item>
                <el-form-item hidden label="副本" required>
                    <el-input v-model="editForm.expeditionAreaId" disabled />
                </el-form-item>


            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="e => handleCreateExpedition(e)" :disabled="!canCreate"
                    :loading="creatingRoom">创建</el-button>
            </template>
        </el-dialog>

    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { allBattleAreas } from "@/shared/data/allBattleInfo";
import { allGameEnemies } from "@/shared/data/allGameEnemy";
import { GameCommonResourceIconAndName } from "#components";
import type { Enemy, ItemDrop } from "~/shared/types/emeny";
import { ElMessage } from "element-plus";
import { emitBattleRoomCreate } from "~/api/game/socket/battleRoom";
import type { AllBattleAreaID, BattleArea } from "~/shared/types/battle";
import { ATTACK_EXP_PER_DEAL_DAMAGE, ATTACK_PER_BATTLE_LEVEL, BATTLE_EXPERIENCE_DROP_PERCENT, BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, DAMAGE_EXP_SHARE_PERCENT, DEFENCE_EXP_PER_DEAL_DAMAGE, DEFENCE_PER_BATTLE_LEVEL, DEX_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_TAKE_DAMAGE, HP_REGEN_PER_TURN_PRE_STAMINA, INTELLIGENCE_EXP_PRE_CAST_SKILL, MIN_BATTLE_ROUND, MP_REGEN_PER_TURN_PRE_INTELLIGENCE, SOMMONER_DAMAGE_EXP_SHARE_PERCENT, STAMINA_EXP_PER_TAKE_DAMAGE, STRENGTH_EXP_PER_DEAL_DAMAGE } from "~/shared/data/constant";
import type { BattleRoom } from "~/shared/types/battleRoom";
import { emitCreateExpeditionTeam, onCreateExpeditionTeamFail, onCreateExpeditionTeamSuccess } from "~/api/game/socket/kittyExpedition";
import type { KittyExpeditionTeamEditForm } from "~/shared/types/kittyExpedition";
import { useKittyInfo } from "~/composables/game/useKittyInfo";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { useMyKittyExpeditionInfo } from "~/composables/game/useMyKittyExpeditionInfo";

const emits = defineEmits(["createRoomSuccess"])

const kitties = useKittyInfo()
const myKittyExpedition = useMyKittyExpeditionInfo()

const availableKitties = computed(() => {
    let a1 = kitties.value.filter(kitty => !kitty.isInExpedition);

    let inExpeditionKittyList: string[] = []

    for(const kittyUuid of Object.keys(myKittyExpedition.value)) {
        inExpeditionKittyList.push(kittyUuid)
        let expedition = myKittyExpedition.value[kittyUuid]

        if (expedition) {
            inExpeditionKittyList.push(...expedition.kittyUuids)
        }
    }

    a1 = a1.filter(kitty => !inExpeditionKittyList.includes(kitty.uuid));

    return a1;
});

const areaList = computed(() => {
    return Object.values<BattleArea>(allBattleAreas).filter(area => area.expeditionRewardInfo?.length);
});

// 创建房间相关
const showCreateDialog = ref(false);
const creatingRoom = ref(false);
const editForm = ref<KittyExpeditionTeamEditForm>({
    name: "",
    kittyUuids: [],
    expeditionAreaId: 'forest_001',
});

const canCreate = computed(() => !!editForm.value.name && !!editForm.value.expeditionAreaId && editForm.value.kittyUuids.length > 0);

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
    await waitUtilConnected()

    off1 = onCreateExpeditionTeamSuccess((data) => {
        ElNotification.success("探险队创建成功")
        emits("createRoomSuccess")
    })

    off2 = onCreateExpeditionTeamFail((data) =>{
        ElNotification.error({
            title: "创建失败",
            message: data.message,
        })
    })
});
onUnmounted(() => {
    off1?.();
    off2?.();
});

function openCreateExpedition(area: BattleArea) {
    editForm.value.name = area.name + "的探险队";
    editForm.value.expeditionAreaId = area.id;
    editForm.value.kittyUuids = [];

    showCreateDialog.value = true;
}

async function handleCreateExpedition(e: Event) {
    if (!canCreate.value) return;
    if (!e.isTrusted) return;

    if (!editForm.value.kittyUuids.length) {
        ElMessage.error("请至少选择一只小猫咪参与探险");
        return;
    }

    if (!editForm.value.expeditionAreaId) {
        ElMessage.error("请选择探险区域");
        return;
    }

    if (!editForm.value.name) {
        ElMessage.error("请填写房间名称");
        return;
    }

    creatingRoom.value = true;
    showCreateDialog.value = false;
    creatingRoom.value = false;
    
    emitCreateExpeditionTeam(editForm.value.kittyUuids, editForm.value.name, editForm.value.expeditionAreaId)
}

const getExpeditionRequireResource = (areaId: string) => {
    // @ts-ignore
    const requireResource = allBattleAreas[areaId] as BattleArea

    return requireResource.expeditionRequireResource || {};
}
</script>