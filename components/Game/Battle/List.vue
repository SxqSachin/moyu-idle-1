<template>
  <div class="p-0 md:p-6">
    <div class="flex flex-wrap justify-between items-center mb-4">
      <span class="text-lg font-bold">战斗房间列表</span>
      <div class="flex flex-wrap gap-2">
        <el-checkbox v-model="onlyShowWaiting" label="仅等待状态的房间" @change="onSearch" size="large" />
        <el-input v-model="searchName" placeholder="输入房间名称并回车" clearable style="width: 160px;" @input="onSearch"
          @clear="onSearch" />
        <el-select v-model="filterArea" placeholder="全部副本" clearable style="width: 160px" @change="onSearch">
          <el-option v-for="area in battleAreaList" :key="area.id" :label="area.name" :value="area.id" />
        </el-select>
        <el-button type="primary" @click="showCreateDialog = true">创建房间</el-button>
        <el-button @click="refreshRooms(true)" :loading="loading">刷新</el-button>
      </div>
    </div>
    <el-table :data="rooms" v-loading="loading" :border="true" class="w-full" empty-text="暂无房间">
      <el-table-column prop="name" label="房间名称" width="160" />
      <el-table-column prop="ownerId" label="房主" width="160">
        <template #default="{ row }">
          <div class="p-2">
            <GameUserAvatarAndName :uuid="row.ownerId"></GameUserAvatarAndName>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="area" label="副本" width="140">
        <template #default="{ row }">
          {{ areaNameMap[row.area] || row.area }}
        </template>
      </el-table-column>
      <!-- <el-table-column label="战斗次数" width="120">
        <template #default="{ row }">
          {{ row.repeatCount }}
        </template>
      </el-table-column> -->
      <el-table-column label="成员数" width="100">
        <template #default="{ row }">
          {{ row.memberIds.length }}/{{ row.maxMembers }}
        </template>
      </el-table-column>
      <!-- <el-table-column label="准备情况" width="120">
        <template #default="{ row }">
          {{
          (row.memberIds as string[]).filter(uuid => row.readyMap?.[uuid]).length
          }}/{{ row.memberIds.length }}
        </template>
      </el-table-column> -->
      <el-table-column prop="isPublic" label="公开" width="80">
        <template #default="{ row }">
          <el-tag :type="row.isPublic ? 'success' : 'warning'">{{ row.isPublic ? "公开" : "私有" }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'waiting' ? 'info' : row.status === 'started' ? 'success' : 'danger'">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <!-- <el-button size="small" type="primary" plain @click="(e) => joinViewRoom(e, row.uuid)"
            :disabled="row.status === 'battling' && currentBattleRoom?.uuid !== row.uuid && row.isPublic">
            观战
          </el-button> -->
          <el-button size="small" type="primary" @click="(e) => joinRoom(e, row.uuid)"
            :disabled="row.status !== 'waiting' || currentBattleRoom?.uuid === row.uuid || !row.isPublic">
            加入
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="!loading && hasMore" class="flex justify-center my-4">
      <el-button @click="loadMoreRooms" :loading="loading" type="primary" plain>
        加载更多
      </el-button>
    </div>

    <!-- 创建房间对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建战斗房间" width="400px">
      <GameBattleCreateBattleRoom :default-area="filterArea || 'forest_001'" @create-room="emits('createRoom')" @cancel="showCreateDialog = false"></GameBattleCreateBattleRoom>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  emitBattleRoomList,
  onBattleRoomList,
  onBattleRoomListError,
  emitBattleRoomCreate,
  onBattleRoomCreateSuccess,
  onBattleRoomCreateError,
  emitJoinBattleRoom,
  onJoinBattleRoomSuccess,
  // emitJoinViewBattleRoom,
} from "~/api/game/socket/battleRoom";
import type { BattleRoom, CreateBattleRoomInput } from "~/shared/types/battleRoom";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { useCurrentBattleRoom } from "~/composables/game/useCurrentBattleRoom";
import type { AllBattleAreaID } from "~/shared/types/battle";
import { GameUserAvatarAndName } from "#components";
import { BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, BATTLE_ROOM_PAGE_SIZE, } from "~/shared/data/constant";

const emits = defineEmits(["createRoom"])

const rooms = ref<BattleRoom[]>([]);
const loading = ref(false);
const page = ref(1);
const hasMore = ref(true);
const searchName = ref("");
const onlyShowWaiting = ref(false)

const filterArea = ref<AllBattleAreaID | undefined>(undefined);

let offList: () => void;
let offError: () => void;
let offCreateSuccess: () => void;
let offCreateError: () => void;
let offJoinSuccess: (() => void) | undefined;
let offJoinError: (() => void) | undefined;

const showCreateDialog = ref(false);

const battleAreaList = Object.values(allBattleAreas);
const areaNameMap = Object.fromEntries(
  Object.values(allBattleAreas).map(area => [area.id, area.name])
) as Record<string, string>;

const currentBattleRoom = useCurrentBattleRoom();

function refreshRooms(reset = true) {
  if (reset) {
    rooms.value = [];
    page.value = 1;
    hasMore.value = true;
  }
  loading.value = true;
  emitBattleRoomList({
    page: page.value,
    name: searchName.value.trim() || undefined,
    area: filterArea.value || undefined,
    onlyWaiting: onlyShowWaiting.value,
  });
}

function loadMoreRooms() {
  if (loading.value || !hasMore.value) return;
  page.value += 1;
  loading.value = true;
  emitBattleRoomList({
    page: page.value,
    name: searchName.value.trim() || undefined,
    area: filterArea.value || undefined,
    onlyWaiting: onlyShowWaiting.value,
  });
}

function statusText(status: string) {
  switch (status) {
    case "waiting": return "等待中";
    case "started": return "进行中";
    case "ended": return "已结束";
    case "battling": return "战斗中";
    case "waiting_for_restart": return "等待自动重启";
    case "waiting_for_autostart": return "等待自动开启战斗";
    case "go_to_area": return "正在路上";
    default: return status;
  }
}

function joinRoom(e: Event, roomId: string) {
  if (!e.isTrusted) return; // 确保是用户点击
  emitJoinBattleRoom(roomId);
}

function onSearch() {
  refreshRooms(true);
}

onMounted(() => {
  refreshRooms();

  offList = onBattleRoomList((list) => {
  if (page.value === 1) {
    rooms.value = list;
  } else {
    rooms.value = [...rooms.value, ...list];
  }
  loading.value = false;
  hasMore.value = list.length >= BATTLE_ROOM_PAGE_SIZE; // pageSize
  });
  offError = onBattleRoomListError((msg) => {
    ElMessage.error(msg);
    loading.value = false;
  });
  offCreateSuccess = onBattleRoomCreateSuccess((room) => {
    ElMessage.success("房间创建成功！");
    showCreateDialog.value = false;
    refreshRooms();
  });
  offCreateError = onBattleRoomCreateError((msg) => {
    ElMessage.error(msg.message || "房间创建失败");
    showCreateDialog.value = false;
  });
  offJoinSuccess = onJoinBattleRoomSuccess((room) => {
    emits("createRoom");
  });
});

onUnmounted(() => {
  offList && offList();
  offError && offError();
  offCreateSuccess && offCreateSuccess();
  offCreateError && offCreateError();
  offJoinSuccess && offJoinSuccess();
  offJoinError && offJoinError();
});
</script>