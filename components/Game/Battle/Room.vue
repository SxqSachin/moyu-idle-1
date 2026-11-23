<template>
  <div class="p-0 md:p-6" v-if="room">

    <template v-if="isBeginner">
        <h2 class="mb-4 flex flex-col gap-2">
          <span class="text-base font-bold"> 喵呜~见习猫猫的战斗小提醒： </span>
            <el-text class="self-start!">在战斗中的前几步放慢一点也没关系！猫猫村中的每个人都可以有自己的节奏。</el-text>
            <el-text class="self-start!">你可以慢慢熟悉战斗，逐步接触装备、技能、专精、祝福等战斗系统。</el-text>
            <el-text class="self-start! flex flex-col gap-2">
              <span> 如果你独自进行探险，你可以：</span>
              <ul class="ml-4 flex flex-col gap-2">
                <li> 在“镇中心”->“征战圣火纪念碑”处获取“见习猫猫战斗祝福”，帮助你更安全的适应战斗。</li>
                <li> 在“酒馆”中以十分优惠的时薪聘请“雇佣兵猫猫”带你熟悉战斗！（如果还没有建造“酒馆”，可以在“家园”->“建造”中进行建造）。</li>
              </ul>
            </el-text>
        </h2>
      </template>

    <el-card shadow="never" class="mb-4" body-class="p-3! md:p-4!">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
        <span class="text-lg font-bold">房间：{{ room.name || room.uuid }}</span>

        <div class="my-1"></div> 

        <div class="flex items-center flex-wrap gap-2! space-x-0!">
          <el-tag :type="room?.isPublic ? 'success' : 'info'">{{ room.isPublic ? "公开" : "私有" }}</el-tag>

          <el-button class="ml-0!" size="small" @click="e => linkToChat(e)"
            :disabled="room.status !== 'waiting'">分享到聊天</el-button>

          <el-button class="ml-0!" size="small" type="primary" plain
            v-if="room.battleType == 'normal' && room.denseFogMode && room.denseFogModeConflictEncounter?.length"
            @click="showDenseFogModeConflictEncounterDialog = true">查看迷雾遭遇</el-button>

          <template v-if="room.publicBattleLoot">
          <el-popover :show-after="180" placement="right" width="300px">
              <template #reference>
                  <div>
                    <el-button class="ml-0!" size="small" type="primary" plain
                      @click="requestBattleRewardInfo">查看战斗奖励</el-button>
                  </div>
              </template>
              <div>
                显示房间内当前成员在此房间通过战斗获得的战利品信息
                <br/>
                战利品信息最多可在房间停止战斗后保留6小时
              </div>
          </el-popover>
          </template>

          <el-button v-if="isOwner" class="ml-0!" size="small" type="primary" @click="showEditDialog = true"
            :disabled="room.status !== 'waiting'">修改房间</el-button>
          <el-button v-if="isOwner && room.battleType === 'normal'" class="ml-0!" size="small" type="primary"
            @click="showAutoWBDialog = true" >自动挑战“大麻烦”</el-button>
        </div>
      </div>
      <el-divider class="my-2!"></el-divider>
      <div class="flex flex-col gap-2">
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-300 flex items-center">房主：
          <GameUserAvatarAndName :uuid="room.ownerId" :avatar-size="52"></GameUserAvatarAndName>
        </div>
        <BattleRoomInfoWorldBoss v-if="room.battleType == 'worldBoss'" :room="room" />
        <BattleRoomInfoNormal v-else-if="room.battleType == 'normal'" :room="room" :current-user-id="userInfo?.uuid">
          <template #resetDenseFog>
            <template v-if="room.disableDenseFogModeBecausePlayerLose && isOwner && isInPrepareState">
              <el-button class="ml-2" size="small" type="warning" @click="resetDenseFogMode">重置迷雾</el-button>
            </template>
          </template>
        </BattleRoomInfoNormal>
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-300">
          <template v-if="room.status === 'waiting_for_restart' && room.waitingForRestartTime">
            <div class="mb-2">状态：等待自动重启</div>
            <el-progress :percentage="calcProgress(room.waitingForRestartTime, room.lastUpdateAt, 15 * 1000)" :stroke-width="4">
              <span class="ml-2">{{ formatCountdown(room.waitingForRestartTime) }}</span>
            </el-progress>
          </template>
          <template v-else-if="room.status === 'waiting_for_autostart' && room.waitingForAutoStartTime">
            <div class="mb-2">状态：等待自动开启战斗</div>
            <el-progress :percentage="calcProgress(room.waitingForAutoStartTime, room.lastUpdateAt, 4 * 1000)" :stroke-width="4" >
              <span class="ml-2">{{ formatCountdown(room.waitingForAutoStartTime) }}</span>
            </el-progress>
          </template>
          <template v-else-if="room.status === 'go_to_area' && room.arriveAreaTime">
            <div class="mb-2">状态：正在路上</div>
            <el-progress :percentage="calcProgress(room.arriveAreaTime, undefined, GO_TO_AREA_DURATION)" :stroke-width="4">
              <span class="ml-2">{{ formatCountdown(room.arriveAreaTime) }}</span>
            </el-progress>
          </template>
          <template v-else>
            状态：{{ statusText(room, room.status) }}
          </template>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="mb-4" body-class="p-3! md:p-4!">
      <div class="font-bold mb-4">成员列表</div>
      <draggable v-if="isDraggable" v-model="room.memberIds" item-key="id" handle=".drag-handle" tag="div"
        class="flex flex-col gap-2" @end="onMemberSortEnd" ghost-class="drag-ghost" chosen-class="drag-chosen">
        <template #item="{ element: row, index }">
          <el-card body-class="flex items-center p-2! pr-4! h-18" :key="row" shadow="never">
            <el-icon class="drag-handle cursor-move mr-2 text-gray-400">
              <Icon name="mdi:drag"></Icon>
            </el-icon>
            <div class="flex-1 flex flex-row items-center">
              <div class="w-28 p-2 md:w-auto truncate">
                <GameUserAvatarAndName :uuid="row" @click="showPlayerInfo(row)" :avatar-size="48"></GameUserAvatarAndName>
              </div>
              <div class="flex flex-row gap-2 ml-4">
                <el-tag :disable-transitions="true" v-if="room.ownerId === row" type="warning" class="ml-2">房主</el-tag>
                <el-tag :disable-transitions="true" v-if="room.readyMap[row]" type="success" class="ml-2">已准备</el-tag>
                <el-tag :disable-transitions="true" v-else type="info" class="ml-2">未准备</el-tag>
                <template v-if="isSelfBattleLevelDesync && row == userInfo.uuid" placement="top">
                  <el-popover width="260">
                    <template #reference>
                      <el-tag type="primary">
                        <el-icon>
                          <Icon name="game-icons:player-time" mode="css"></Icon>
                        </el-icon>
                      </el-tag>
                    </template>
                    <div>
                      <span>此房间的战斗等级偏高，你的经验及战利品获取效率将会更接近你当前战斗等级的阶段。</span>
                    </div>
                  </el-popover>
                </template>
              </div>
            </div>
            <el-button v-if="row !== userInfo.uuid" :disabled="room.status != 'waiting'" size="small" type="danger"
              @click="kickUser(row)">踢出</el-button>
          </el-card>
        </template>
      </draggable>
      <div v-else class="flex flex-col gap-2">

        <template v-for="row in room.memberIds" :key="row">
          <el-card body-class="flex items-center p-2! pr-4! h-14" shadow="never">
            <div class="flex-1 p-2 flex flex-row items-center">
              <GameUserAvatarAndName :uuid="row" @click="showPlayerInfo(row)" :avatar-size="48"></GameUserAvatarAndName>
              <div class="flex flex-row gap-2 ml-4">
                <el-tag :disable-transitions="true" v-if="room.ownerId === row" type="warning" class="ml-2">房主</el-tag>
                <el-tag :disable-transitions="true" v-if="room.readyMap[row]" type="success" class="ml-2">已准备</el-tag>
                <el-tag :disable-transitions="true" v-else type="info" class="ml-2">未准备</el-tag>
                <template v-if="isSelfBattleLevelDesync && row == userInfo.uuid" placement="top">
                  <el-popover width="260">
                    <template #reference>
                      <el-tag type="primary">
                        <el-icon>
                          <Icon name="game-icons:player-time" mode="css"></Icon>
                        </el-icon>
                      </el-tag>
                    </template>
                    <div>
                      <span>此房间的战斗等级偏高，你的经验及战利品获取效率将会更接近你当前战斗等级的阶段。</span>
                    </div>
                  </el-popover>
                </template>
              </div>
            </div>
          </el-card>
        </template>
      </div>
    </el-card>
<!-- 
    <el-card shadow="never" class="mb-4" body-class="p-3! md:p-4!">
      <div class="font-bold mb-4">
        <span>幻象</span>
        <span class="ml-4"><el-button size="small" @click="showPhantomSelectDialog = true">加入幻象</el-button>
        </span>
      </div>
      <template v-if="roomPhantoms.length">
        <div class="flex flex-col gap-2">
          <template v-for="row in roomPhantoms" :key="row">
            <el-card body-class="flex items-center p-2! pr-4! h-14" shadow="never">
              <div class="flex flex-row items-center w-52">
                <GameUserAvatarAndName :uuid="row.borrower" @click="showPlayerInfo(row.borrower)" name-suffix="的幻象"></GameUserAvatarAndName>
              </div>

              <el-popover width="260">
                <template #reference>
                  <el-button size="small" plain>查看幻象</el-button>
                </template>

                <GameBattleBaseBattleUnit :unit="row.snapshot"></GameBattleBaseBattleUnit>
              </el-popover>

              <el-button size="small" plain type="warning" v-if="row.borrower == user?.uuid" @click="e => handleRemovePhantom(e, row)">移除</el-button>
            </el-card>
          </template>
        </div>
      </template>
      <template v-else>
        <div class="flex-1 flex flex-row items-center">
          <span class="text-xs text-center text-gray-400">暂无幻象</span>
        </div>
      </template>
    </el-card> -->

    <GameBattleOfferingSection
      v-if="room"
      :room="room"
      :is-in-prepare-state="isInPrepareState"
    />

    <div class="flex space-x-2">
      <el-button type="danger" @click="leaveRoom">离开房间</el-button>
      <el-button v-if="room.status == 'battling'" type="warning" @click="(e) => stopBattle(e)">
        结束战斗
      </el-button>
      <el-button v-if="isOwner" type="primary" :disabled="(!isOwner || !allReady) || room.status != 'waiting'"
        @click="(e) => startBattle(e)">
        开始战斗
      </el-button>
      <el-button type="success" :plain="isReady" @click="(e) => toggleReady(e)"
        :disabled="!['waiting', 'ended'].includes(room.status)">
        {{ isReady ? '取消准备' : '准备' }}
      </el-button>
    </div>

    <!-- 玩家信息弹窗 -->
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
      :close-on-click-modal="true" destroy-on-close>
      <template #header>
        <span>玩家信息</span>
      </template>

      <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>

  </div>
  <el-dialog v-model="showEditDialog" title="修改房间信息" width="480px">
    <EditBattleRoomForm
      :room="room!"
      :members="room?.memberIds || []"
      :loading="editingRoom"
      @submit="handleEditRoom"
      @cancel="() => (showEditDialog = false)"
    />
  </el-dialog>

  <el-dialog v-model="showAutoWBDialog" title="自动加入“大麻烦”战斗" :width="isMobile ? '100%' : '480px'">
    <div class="p-2">
      <el-form label-width="80px">
        <el-form-item label="模式">
          <el-radio-group v-model="autoWBForm.type">
            <el-radio label="none">关闭</el-radio>
            <el-radio label="switch">自动切换到“大麻烦”</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="选择Boss" v-if="autoWBForm.type === 'switch'">
          <el-select v-model="autoWBForm.config.bossId" placeholder="请选择Boss" filterable :loading="loadingBoss">
            <el-option v-for="boss in availableBossList" :key="boss.id" :label="`${boss.name} (版本: ${boss.version})`" :value="boss.id" />
          </el-select>

          <div class="flex flex-wrap items-center gap-2 mt-2 w-full" v-if="autoWBForm.config.bossId && currentSelectedAutoWorldBoss">
            <game-battle-world-boss-card :boss="currentSelectedAutoWorldBoss">
            </game-battle-world-boss-card>
          </div>

        </el-form-item>

        <div class="flex justify-end mt-4">
          <el-button @click="showAutoWBDialog = false">取消</el-button>
          <el-button type="primary" class="ml-2" @click="submitAutoWorldBossConf">保存</el-button>
        </div>
      </el-form>
    </div>
  </el-dialog>

  <el-dialog v-model="showDenseFogModeConflictEncounterDialog" title="迷雾遭遇（最近10次）" width="360px">
    <el-table :data="room?.denseFogModeConflictEncounter" stripe size="small" height='400px'>
      <el-table-column label="结果" width="58" fixed="left">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <span>{{ getDesenFogModEncounterResultStr(row.result) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="80">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <span>{{ formatTimeToStr(new Date(row.date)) }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="幻象">
        <template #default="{ row }">
          <template v-for="enemyPlayerUuid in row.enemyPlayerUuidList">
            <GameUserAvatarAndName @click="showPlayerInfo(enemyPlayerUuid)" :uuid="enemyPlayerUuid" />
          </template>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <!-- <el-dialog v-model="showPhantomSelectDialog" title="幻象">
    <GameBattleRoomPhantomSelect @select="handleSelectPhantom"></GameBattleRoomPhantomSelect>
  </el-dialog> -->

  <el-dialog v-model="showBattleRewardInfoDialog" title="战利品情况" @close="showBattleRewardInfoDialog = false">
    <template v-if="!battleRewardInfo">
      <el-empty description="暂无数据"></el-empty>
    </template>
    <template v-else>
      <GameUserBatchAvatarAndName :uuid-list="Object.keys(battleRewardInfo)">
        <div v-if="selfUser?.uuid" class="mb-2">
          <el-button @click="requestResetSelfBattleRewardInfo">重置自身统计数据</el-button>
        </div>
        <div class="flex flex-col gap-4 divide-y divide-gray-200 dark:divide-gray-700">
          <template v-for="(info, userUuid) in battleRewardInfo">
            <div class="flex flex-col gap-2 pb-4">
              <GameUserAvatarAndName :uuid="userUuid" :avatar-size="48"></GameUserAvatarAndName>
              <div class="flex flex-row flex-wrap gap-2">
                <GameCommonItemCountInfoIconAndName :item-count-info="info" :show-count="true">
                </GameCommonItemCountInfoIconAndName>
              </div>
            </div>
          </template>
        </div>
      </GameUserBatchAvatarAndName>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import { useFTCurrentChatMsg } from "~/composables/game/useLocalChatMsg";
import { emitStopBattle } from "~/api/game/socket/battle";
import draggable from "vuedraggable";
import {
  emitLeaveBattleRoom,
  onLeaveBattleRoomSuccess,
  onLeaveBattleRoomError,
  emitKickBattleRoomUser,
  onKickBattleRoomSuccess,
  onKickBattleRoomError,
  onBattleRoomKicked,
  onBattleRoomUpdate,
  emitUpdateReadyState,
  onUpdateReadyStateError,
  emitBattleRoomStartBattle,
  emitUpdateBattleRoomInfo,
  onUpdateBattleRoomInfoSuccess,
  onUpdateBattleRoomInfoError,
  emitGetCurrentBattleRoom,
  emitReorderRoomMember,
  emitAddPhantomToBattleRoom,
  emitRemovePhantomFromBattleRoom,
  emitGetRoomBattleRewardInfo,
  onGetRoomBattleRewardInfoSuccess,
  onGetRoomBattleRewardInfoError,
  emitResetSelfBattleRewardInfo,
  onResetSelfBattleRewardInfoSuccess,
  onResetSelfBattleRewardInfoError,
} from "~/api/game/socket/battleRoom";
import { useWorldBoss } from '~/composables/game/useWorldBoss';
import { emitSetAutoWorldBossBattleConf, onSetAutoWorldBossBattleConfSuccess, onSetAutoWorldBossBattleConfError } from '~/api/game/socket/battleRoom';
import { emitGetBorrowedPhantomList, onGetBorrowedPhantomListFail, onGetBorrowedPhantomListSuccess } from "~/api/game/socket/characterPhantom";
import type { GameSocketUserInfo } from "~/shared/types/socket";
import type { BattleRoom, NormalBattleRoom, UpdateBattleRoomInput, UpdateNormalBattleRoomInput, UpdateWorldBossBattleRoomInput } from "~/shared/types/battleRoom";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { GO_TO_AREA_DURATION } from "~/shared/data/constant";
import { formatTime, formatTimeToStr } from "~/shared/utils";
import type { FTChatMessageMeta } from "~/shared/types/chatMsgType";
import type { CharacterPhantomBorrowDTO } from "~/shared/types/characterPhantom";
import type { FuncAction } from "~/shared/types";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import GameBattleOfferingSection from "~/components/Game/Battle/BattleOfferingSection.vue";
import BattleRoomInfoNormal from "~/components/Game/Battle/BattleRoomInfoNormal.vue";
import BattleRoomInfoWorldBoss from "~/components/Game/Battle/BattleRoomInfoWorldBoss.vue";
import EditBattleRoomNormalForm from "~/components/Game/Battle/EditBattleRoomNormalForm.vue";
import EditBattleRoomWorldBossForm from "~/components/Game/Battle/EditBattleRoomWorldBossForm.vue";
import EditBattleRoomForm from "~/components/Game/Battle/EditBattleRoomForm.vue";
import { eventBus } from "~/utils/eventBus";
import type { WorldBossConfigWithState } from "~/shared/types/worldBoss";
import { useIsBeginner } from "~/composables/game/useIsBeginner";

const isBeginner = useIsBeginner();

// TODO: split room render/edit forms by battleType to avoid conditional bloat as more room types appear.

const emits = defineEmits(["startBattle", "leaveRoom"]);

const { isMobile }  = useDevice();

const { user: selfUser } = useUserSession();
const room = useCurrentBattleRoom();
const isWorldBossRoom = computed(() => room.value?.battleType === "worldBoss");

const showDenseFogModeConflictEncounterDialog = ref(false);
const showEditDialog = ref(false);
const editingRoom = ref(false);
const isInPrepareState = computed(() => room.value?.status === "waiting");

// live clock used for countdowns/progress (update every 100ms for smooth progress)
const now = ref<number>(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now();
  }, 100);
});
onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer as any);
    nowTimer = null;
  }
});

function formatCountdown(target: number | undefined) {
  if (!target) return "";
  const diff = Math.max(0, target - now.value);
  if (diff <= 0) return "剩余 0 秒";
  // when less than 1s left, show 0秒 instead of '马上'
  if (diff < 1000) return `剩余 0 秒`;
  const s = Math.floor(diff / 1000);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `剩余 ${hours}小时 ${minutes}分 ${seconds}秒`;
  if (minutes > 0) return `剩余 ${minutes}分 ${seconds}秒`;
  return `剩余 ${seconds} 秒`;
}

function calcProgress(target: number | undefined, start?: number | undefined, fallbackTotalMs?: number) {
  if (!target) return 0;
  const total = start && start < target ? target - start : fallbackTotalMs ?? 0;
  if (!total || total <= 0) return 100;
  const elapsed = Math.max(0, Math.min(total, now.value - (start ?? (target - total))));
  // Shift progress forward by 1000ms so progress hits 100% at the start of the last second
  const adjusted = Math.min(total, elapsed + 1000);
  const p = Math.round((adjusted / total) * 100);
  return Math.max(0, Math.min(100, p));
}

const { user } = useUserSession();
const userInfo = computed(() => user.value as GameSocketUserInfo);

const roomPhantoms = ref<CharacterPhantomBorrowDTO[]>([]);
const showPhantomSelectDialog = ref(false);
const isDraggable = computed(() => isOwner.value);
const isOwner = computed(() => room.value?.ownerId === userInfo.value?.uuid);
const isReady = computed(() => !!room.value?.readyMap?.[userInfo.value?.uuid]);
const allReady = computed(() =>
  room.value ? (room.value.memberIds || []).every((uuid: string) => room.value?.readyMap?.[uuid]) : false
);

const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);

const showAutoWBDialog = ref(false);
const autoWBForm = ref<{ type: 'none' | 'switch'; config: { bossId?: string } }>({ type: 'none', config: {} });
const { availableBossList, loading: loadingBoss, refresh: refreshWorldBossList } = useWorldBoss();

let offSetOK: (() => void) | undefined;
let offSetFail: (() => void) | undefined;

const showBattleRewardInfoDialog = ref(false);
const battleRewardInfo = ref<Record<string, ItemCountInfo> | null>(null);

const phantomUuidList = computed(() => room.value?.phantomUuidList || []);

watch(
  () => phantomUuidList.value,
  () => {
    if (!phantomUuidList.value.length) {
      roomPhantoms.value = [];
      return;
    }
    emitGetBorrowedPhantomList(phantomUuidList.value);
  },
  { immediate: true }
);

// function handleSelectPhantom(phantomBorrowUuid: string) {
//   if (!room.value) return;
//   emitAddPhantomToBattleRoom(room.value.uuid, phantomBorrowUuid);
//   showPhantomSelectDialog.value = false;
// }

// function handleRemovePhantom(e: Event, borrowedPhantom: CharacterPhantomBorrowDTO) {
//   if (!e.isTrusted || !room.value) return;
//   emitRemovePhantomFromBattleRoom(room.value.uuid, borrowedPhantom.uuid);
// }

function handleEditRoom(payload: UpdateBattleRoomInput) {
  if (!room.value) return;
  editingRoom.value = true;
  emitUpdateBattleRoomInfo(room.value.uuid, payload);
}

function resetDenseFogMode() {
  const currentRoom = room.value;
  if (!currentRoom || !isInPrepareState.value || currentRoom.battleType === "worldBoss") return;
  editingRoom.value = true;
  emitUpdateBattleRoomInfo(currentRoom.uuid, {
    name: currentRoom.name || "",
    area: currentRoom.area,
    isPublic: currentRoom.isPublic || false,
    autoRestart: currentRoom.autoRestart || false,
    autoStartBattle: currentRoom.autoStartBattle || false,
    difficulty: currentRoom.difficulty || 0,
    ownerId: currentRoom.ownerId,
    denseFogMode: true,
    phantomUuidList: currentRoom.phantomUuidList || [],
    autoRestartDenseFogMode: currentRoom.autoRestartDenseFogMode || false,
    publicBattleLoot: currentRoom.publicBattleLoot,
    battleType: "normal",
  });
}

function handleRoomUpdated(newRoom: BattleRoom) {
  room.value = newRoom;
}

function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid || null;
  playerInfoDialogVisible.value = true;
}

function statusText(targetRoom: BattleRoom, status?: string) {
  switch (status) {
    case "waiting":
      return "等待中";
    case "battling":
      return "战斗中";
    case "started":
      return "进行中";
    case "ended":
      return "已结束";
    case "waiting_for_restart":
      return `等待自动重启(${formatTime(targetRoom.waitingForRestartTime)})`;
    case "waiting_for_autostart":
      return `等待自动开启战斗(${formatTime(targetRoom.waitingForAutoStartTime)})`;
    case "go_to_area":
      return `正在路上(${formatTime(targetRoom.arriveAreaTime)})`;
    default:
      return status || "";
  }
}

const loading = ref(true);
function leaveRoom() {
  ElMessageBox({
    title: "离开房间",
    message: "确定离开房间吗。如果此房间正在战斗状态，你将同时离开战斗。",
    showCancelButton: true,
    confirmButtonText: "离开",
    cancelButtonText: "取消",
  }).then(() => {
    emitLeaveBattleRoom();

    setTimeout(() => {
      if (room.value && room.value.memberIds.includes(userInfo.value?.uuid)) {
        ElMessage.warning("正在重新同步房间状态...");
        emitGetCurrentBattleRoom();
      }
      loading.value = false;
    }, 2000);

    emits("leaveRoom");
  });
}

function stopBattle(e: Event) {
  if (!e.isTrusted) return;
  if (room.value) {
    ElMessageBox({
      title: "结束战斗",
      message:
        "确定结束战斗吗，结束战斗后，房间内玩家将全部离开战斗并重新回到房间，除你以外的玩家将处于准备就绪状态。",
      showCancelButton: true,
      confirmButtonText: "离开",
      cancelButtonText: "取消",
    }).then(() => {
      if (room.value) {
        emitStopBattle(room.value.uuid);
      }
    });
  }
}

function kickUser(targetUserId: string) {
  if (!room.value) return;
  emitKickBattleRoomUser(room.value.uuid, targetUserId);
}

function toggleReady(e: Event) {
  if (!e.isTrusted) return;
  if (!room.value) return;
  emitUpdateReadyState(room.value.uuid, !isReady.value);
}

function startBattle(e: Event) {
  if (!e.isTrusted) return;
  if (!room.value) return;
  emitBattleRoomStartBattle(room.value.uuid);
  emits("startBattle");
}

const ftChatMsg = useFTCurrentChatMsg();
function linkToChat(e: Event) {
  if (!e.isTrusted || !room.value) return;

  const stub = Math.random().toString(36).slice(2, 8);

  const chatMsgMeta: FTChatMessageMeta = {
    room: [
      {
        type: "room",
        roomId: room.value.uuid,
        roomName: room.value.name,
        area: room.value.area,
        textStub: stub,
      },
    ],
  };
  ftChatMsg.value = chatMsgMeta;
  const content =
    room.value.battleType === "worldBoss"
      ? `我创建了一个“大麻烦”战斗房间：${room.value.name}，Boss：${room.value.worldBossId ?? "未知"}，{${stub}}。`
      : `我创建了一个战斗房间：${room.value.name}，副本：${room.value.area ? allBattleAreas?.[room.value.area]?.name : "未知"}${room.value.denseFogMode ? "[迷雾模式]" : ""}，{${stub}}。`;

  eventBus.emit("open-chat-panel", {});
  eventBus.emit("set-chat-content", { msg: content, meta: chatMsgMeta });
}

function requestBattleRewardInfo() {
  if (!room.value) return;
  showBattleRewardInfoDialog.value = true;
  emitGetRoomBattleRewardInfo(room.value.uuid);
}

function requestResetSelfBattleRewardInfo() {
  if (!room.value) return;
  emitResetSelfBattleRewardInfo(room.value.uuid);
}

function onMemberSortEnd() {
  if (!room.value?.uuid || !room.value?.memberIds?.length) return;
  emitReorderRoomMember(room.value.uuid, room.value.memberIds);
}

function getDesenFogModEncounterResultStr(result: NonNullable<BattleRoom["denseFogModeConflictEncounter"]>[number]["result"]) {
  switch (result) {
    case "WIN":
      return "胜利";
    case "LOSE":
      return "失败";
    case "BATTLING":
      return "战斗中";
    default:
      return result;
  }
}

// 事件解绑引用
let offLeaveSuccess: (() => void) | undefined;
let offLeaveError: (() => void) | undefined;
let offKicked: (() => void) | undefined;
let offKickSuccess: (() => void) | undefined;
let offKickError: (() => void) | undefined;
let offRoomUpdate: (() => void) | undefined;
let offReadyError: (() => void) | undefined;
let offEditSuccess: (() => void) | undefined;
let offEditError: (() => void) | undefined;

let offGetPhantomListSuccess: (() => void) | undefined;
let offGetPhantomListError: (() => void) | undefined;

let offGetBattleRewardInfoSuccess: FuncAction;
let offGetBattleRewardInfoError: FuncAction;

let offResetSelfBattleRewardInfoSuccess: FuncAction;
let offResetSelfBattleRewardInfoError: FuncAction;

onMounted(() => {
  offLeaveSuccess = onLeaveBattleRoomSuccess(() => {
    room.value = null;
    ElMessage.success("已离开房间");
  });
  offLeaveError = onLeaveBattleRoomError((msg) => {
    ElMessage.error(msg.message || "离开房间失败");
    room.value = null;
  });
  offKicked = onBattleRoomKicked(() => {
    room.value = null;
    ElMessage.info("你已被房主移出房间");
  });
  offKickSuccess = onKickBattleRoomSuccess((newRoom) => {
    room.value = newRoom;
    ElMessage.success("已踢出成员");
  });
  offKickError = onKickBattleRoomError((msg) => {
    ElMessage.error(msg.message || "踢出失败");
  });
  offRoomUpdate = onBattleRoomUpdate((newRoom) => {
    room.value = newRoom;
  });
  offReadyError = onUpdateReadyStateError((msg) => {
    ElMessage.error(msg.message || "准备状态更新失败");
  });
  offEditSuccess = onUpdateBattleRoomInfoSuccess((newRoom) => {
    room.value = newRoom;
    editingRoom.value = false;
    showEditDialog.value = false;
    ElMessage.success("房间信息已更新");
  });
  offEditError = onUpdateBattleRoomInfoError((msg) => {
    ElMessage.error(msg.message || "房间信息修改失败");
    editingRoom.value = false;
  });

  offGetPhantomListSuccess = onGetBorrowedPhantomListSuccess((data) => {
    roomPhantoms.value = data.borrows;
  });

  offGetPhantomListError = onGetBorrowedPhantomListFail((msg) => {
    ElMessage.error(msg.message || "获取房间镜像失败");
  });

  offGetBattleRewardInfoSuccess = onGetRoomBattleRewardInfoSuccess((data) => {
    battleRewardInfo.value = data.data;
  });
  offGetBattleRewardInfoError = onGetRoomBattleRewardInfoError((msg) => {
    ElMessage.error(msg.message || "获取房间战斗奖励信息失败");
  });

  offResetSelfBattleRewardInfoSuccess = onResetSelfBattleRewardInfoSuccess(() => {
    ElMessage.success("已重置");
    showBattleRewardInfoDialog.value = false;
  });

  offResetSelfBattleRewardInfoError = onResetSelfBattleRewardInfoError((msg) => {
    ElMessage.error(msg.message || "重置失败");
  });

  offSetOK = onSetAutoWorldBossBattleConfSuccess((newRoom) => {
    room.value = newRoom;
    showAutoWBDialog.value = false;
    ElMessage.success("配置已保存");
  });
  offSetFail = onSetAutoWorldBossBattleConfError((err) => {
    ElMessage.error(err.message || "保存失败");
  });
});

onUnmounted(() => {
  offLeaveSuccess && offLeaveSuccess();
  offLeaveError && offLeaveError();
  offKicked && offKicked();
  offKickSuccess && offKickSuccess();
  offKickError && offKickError();
  offRoomUpdate && offRoomUpdate();
  offReadyError && offReadyError();
  offEditSuccess && offEditSuccess();
  offEditError && offEditError();

  offGetPhantomListSuccess?.();
  offGetPhantomListError?.();

  offGetBattleRewardInfoSuccess?.();
  offGetBattleRewardInfoError?.();

  offResetSelfBattleRewardInfoSuccess?.();
  offResetSelfBattleRewardInfoError?.();
  offSetOK?.();
  offSetFail?.();
});

watch(() => showAutoWBDialog.value, (v) => {
  if (v) {
    refreshWorldBossList();
    // @ts-expect-error
    autoWBForm.value.type = room.value?.autoWorldBossBattleConf?.type ?? 'none';
    // @ts-expect-error
    autoWBForm.value.config = room.value?.autoWorldBossBattleConf?.config ? { ...room.value?.autoWorldBossBattleConf?.config } : {};
  }
});

function submitAutoWorldBossConf() {
  if (!room.value) return;
  const payload: any = { type: autoWBForm.value.type };
  if (autoWBForm.value.type === 'switch') {
    if (!autoWBForm.value.config?.bossId) {
      ElMessage.error('请选择Boss');
      return;
    }
    payload.config = { bossId: autoWBForm.value.config.bossId };
  }
  emitSetAutoWorldBossBattleConf(room.value.uuid, payload);
}
const currentSelectedAutoWorldBoss = computed<WorldBossConfigWithState | null>(() => {
  const bossId = autoWBForm.value.config.bossId;
  return availableBossList.value.find(b => b.id === bossId) || null;
});

const isSelfBattleLevelDesync = computed(() => {
  if (!room.value || room.value.battleType !== 'normal') return false;
  return room.value.battleLevelDesyncPlayerUuidList?.includes(userInfo.value?.uuid || '');
})
</script>

<style lang="scss" scoped>
.drag-ghost {
    opacity: 0.5;
    background: #f3f4f6;
    border: 1.5px dashed #a5b4fc;
}

.drag-chosen {
    box-shadow: 0 0 4px 2px #7f99ee;
    transform: scale(1.02);
    z-index: 10;
}

/* make progress bar transitions smooth */
.el-progress__bar .el-progress__inner {
  transition: width 0.62s ease-in !important;
}

.el-progress {
  overflow: visible;
}
</style>