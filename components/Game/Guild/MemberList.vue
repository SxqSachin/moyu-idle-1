<template>
  <div v-if="!readonly" class="flex justify-between items-center mb-2">

    <div class="flex flex-col items-start">
    <el-text class="self-start!">公会成员人数: {{ members.length }} / {{ maxGuildMemberCount  }}</el-text>
    </div>
    <el-button @click="refresh" :loading="loading">刷新</el-button>
  </div>
  <el-card>
    <el-scrollbar>
      <div v-if="!members.length" class="text-gray-400 text-center py-8 select-none">暂无成员</div>
      <div v-else>

        <div>
          <el-divider>{{ getGuildRoleName(GuildRole.LEADER) }}</el-divider>
          <div v-for="m in leaderMembers" :key="m.uuid"
            class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700! last:border-0"
            :class="{
              'flex-col items-start': isMobile,
              'flex-row': !isMobile
            }"
            >
            <div class="flex items-center gap-2 justify-between">
              <GameUserAvatarAndName @click="showPlayerInfo(m.uuid)" :uuid="m.uuid">
              </GameUserAvatarAndName>

              <span class="text-xs text-gray-400" v-if="m.title">[{{ m.title }}]</span>
            </div>

            <div :class="isMobile ? 'w-full flex flex-row mt-2' : ''">
              <el-button :class="isMobile ? 'flex-1' : ''" v-if="!readonly && canModifyTitle && myMemberInfo?.role == GuildRole.LEADER" size="small"
                @click="openSetTitleDialog(m)">设置头衔</el-button>
            </div>
          </div>
        </div>

        <div v-if="!!officerMembers.length">
          <el-divider>{{ getGuildRoleName(GuildRole.OFFICER) }}</el-divider>
          <div v-for="m in officerMembers" :key="m.uuid"
            class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-0"
            :class="{
              'flex-col items-start': isMobile,
              'flex-row': !isMobile
            }"
            >
            <div class="flex items-center gap-2 justify-between">
              <GameUserAvatarAndName @click="showPlayerInfo(m.uuid)" :uuid="m.uuid">
              </GameUserAvatarAndName>

              <span class="text-xs text-gray-400" v-if="m.title">[{{ m.title }}]</span>
            </div>

            <div :class="isMobile ? 'w-full flex flex-row mt-2' : ''">
              <el-button :class="isMobile ? 'flex-1' : ''" v-if="!readonly && canModifyTitle && myMemberInfo?.role == GuildRole.LEADER" size="small" @click="openSetTitleDialog(m)">设置头衔</el-button>
              <el-button :class="isMobile ? 'flex-1' : ''" v-if="!readonly && canKickMember" size="small" type="danger"
                @click="onKick(m)">踢出</el-button>
            </div>
          </div>
        </div>

        <div v-if="!!otherMembers.length">
          <el-divider>{{ getGuildRoleName(GuildRole.MEMBER) }}</el-divider>
          <div v-for="m in otherMembers" :key="m.uuid"
            class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-0"
            :class="{
              'flex-col items-start': isMobile,
              'flex-row': !isMobile
            }"
            >
            <div class="flex items-center gap-2 justify-between">
              <GameUserAvatarAndName @click="showPlayerInfo(m.uuid)" :uuid="m.uuid">
              </GameUserAvatarAndName>

              <span class="text-xs text-gray-400" v-if="m.title">[{{ m.title }}]</span>
            </div>

            <div :class="isMobile ? 'w-full flex flex-row mt-2' : ''">
              <el-button :class="isMobile ? 'flex-1' : ''" v-if="!readonly && canModifyTitle" size="small"
                @click="openSetTitleDialog(m)">设置头衔</el-button>
              <el-button :class="isMobile ? 'flex-1' : ''" v-if="!readonly && canKickMember" size="small" type="danger"
                @click="onKick(m)">踢出</el-button>
            </div>
          </div>
        </div>


      </div>
    </el-scrollbar>
  </el-card>
  <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
    :close-on-click-modal="true" destroy-on-close>
    <template #header>
      <span>玩家信息</span>
    </template>

    <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
  </el-dialog>

  <!-- 设置头衔弹窗 -->
  <el-dialog v-if="!readonly" v-model="setTitleDialog.visible" title="设置玩家头衔" width="350px">
    <el-form>
      <el-form-item label="头衔">
        <el-select v-model="setTitleDialog.selectedTitleUuid" placeholder="请选择头衔">
          <template v-for="t in sortedTitleList" :key="t.uuid" >
            <el-option v-if="isLeader || isOfficer && t.role == GuildRole.MEMBER" :label="t.title" :value="t.uuid">
              {{ t.title }} 
              <span class="text-xs text-gray-400">({{ getGuildRoleName(t.role) }})</span>
            </el-option>
          </template>
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="setTitleDialog.visible = false">取消</el-button>
      <el-button type="primary" @click="onSetTitle" :loading="setTitleDialog.loading">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { emitGetGuildMembers, onGetGuildMembers, emitDisbandGuild, emitKickMember, onKickMemberFail, onKickMemberSuccess, emitGetOtherGuildInfo, onGetOtherGuildSuccess, onGetGuildTitlesSuccess, onGetGuildTitlesFail, onSetGuildMemberTitleSuccess, onSetGuildMemberTitleFail, emitSetGuildMemberTitle, emitGetGuildTitles } from '~/api/game/socket/guild'
import { emitGetBuiltGuildBuildings, onGetBuiltGuildBuildingsSuccess } from '~/api/game/socket/guildBuilding';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { allGuildBuilding } from '~/shared/data/allGuildBuilding';
import { BASE_GUILD_MEMBER_COUNT } from '~/shared/data/constant';
import type { FuncAction } from '~/shared/types';
import { getGuildRoleName, GuildRole, type GameGuild, type GameGuildBuilding, type GuildMemberInfo } from '~/shared/types/guild';
const props = defineProps<{ 
  guildUuid: any
  readonly?: boolean
  myMemberInfo?: GuildMemberInfo
 }>()

const guild = ref<GameGuild | null>(null)

const { isMobile } = useDevice()

const members = ref<{
  uuid: string;
  name: string;
  role: GuildRole;
  title: string;
}[]>([])

const leaderMembers = computed(() => members.value.filter(m => m.role === GuildRole.LEADER))
const officerMembers = computed(() => members.value.filter(m => m.role === GuildRole.OFFICER))
const otherMembers = computed(() => members.value.filter(m => m.role === GuildRole.MEMBER))

const isLeader = computed(() => props.myMemberInfo?.guildUuid == props.guildUuid && props.myMemberInfo?.role === GuildRole.LEADER)
const isOfficer = computed(() => props.myMemberInfo?.guildUuid == props.guildUuid && props.myMemberInfo?.role === GuildRole.OFFICER)

const canModifyTitle = computed(() => isLeader.value || isOfficer.value)
const canKickMember = computed(() => isLeader.value || isOfficer.value)

let off: FuncAction
let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction
let off6: FuncAction
let off7: FuncAction
let off8: FuncAction

let loading = ref(false)
const refresh = () => {
  loading.value = true
  emitGetGuildMembers(props.guildUuid)
}

const buildingInfo = ref<GameGuildBuilding[]>([]);

onMounted(async () => {
  await waitUtilConnected();

  emitGetOtherGuildInfo(props.guildUuid)
  emitGetBuiltGuildBuildings(props.guildUuid)
  refresh()

  off = onGetGuildMembers(({ guildUuid, members: m }) => {
    loading.value = false
    if (guildUuid == props.guildUuid) {
      members.value = m
    }
  })

  off1 = onKickMemberSuccess((args) => {
    ElNotification({
      title: "踢出成员成功",
      type: "success",
      duration: 1800,
    })
    refresh()
  })

  off2 = onKickMemberFail((args) => {
    ElNotification({
      title: `踢出成员失败: ${args.message}`,
      type: "error",
      duration: 1800,
    })
    refresh()
  })

  off3 = onGetOtherGuildSuccess((obj) => {
    guild.value = obj.guild

    if (!props.readonly) {
      emitGetGuildTitles(guild.value!.uuid)
    }
  })

  off4 = onGetGuildTitlesSuccess((data) => {
    titleList.value = data.titles
  })
  off5 = onGetGuildTitlesFail(() => {
    titleList.value = []
    ElNotification({ title: "获取头衔列表失败", type: "error", duration: 1200 });
  })

  off6 = onSetGuildMemberTitleSuccess(() => {
    setTitleDialog.value.visible = false
    setTitleDialog.value.loading = false
    ElNotification({ title: "设置头衔成功", type: "success", duration: 1200 });
    refresh()
  })
  off7 = onSetGuildMemberTitleFail((data) => {
    setTitleDialog.value.loading = false
    ElNotification({ title: "设置头衔失败", message: data.message, type: "error", duration: 1200 });
  })

  off8 = onGetBuiltGuildBuildingsSuccess((data) => {
    // 先初始化为所有未建造
    buildingInfo.value = data.list;
  });
})

onUnmounted(() => {
  off?.()
  off1?.()
  off2?.()
  off3?.()
  off4?.()
  off5?.()
  off6?.()
  off7?.()
  off8?.()
})

function onKick(member: any) {
  if (props.readonly) {
    return
  }
  emitKickMember(props.guildUuid, member.uuid)
}

const currentSelectPlayerUuid = ref("");
const playerInfoDialogVisible = ref(false);
function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid;
  playerInfoDialogVisible.value = true;
}

const titleList = ref<{ uuid: string; title: string; role: GuildRole }[]>([]);

const sortedTitleList = computed(() => {
  return [...titleList.value].sort((a, b) => {
    // 定义角色优先级：会长 > 组长 > 成员
    const rolePriority = {
      [GuildRole.LEADER]: 0,
      [GuildRole.OFFICER]: 1,
      [GuildRole.MEMBER]: 2
    };
    
    // 首先按角色排序
    const roleComparison = rolePriority[a.role] - rolePriority[b.role];
    if (roleComparison !== 0) {
      return roleComparison;
    }
    
    // 如果角色相同，按头衔名称排序
    return a.title.localeCompare(b.title);
  });
});


const setTitleDialog = ref({
  visible: false,
  loading: false,
  memberUuid: "",
  selectedTitleUuid: ""
})

function openSetTitleDialog(member: any) {
  setTitleDialog.value.visible = true
  setTitleDialog.value.memberUuid = member.uuid
  setTitleDialog.value.selectedTitleUuid = member.titleUuid || ""
}

function onSetTitle() {
  if (!guild.value || !setTitleDialog.value.memberUuid || !setTitleDialog.value.selectedTitleUuid) return
  setTitleDialog.value.loading = true
  emitSetGuildMemberTitle({
    guildUuid: guild.value.uuid,
    userUuid: setTitleDialog.value.memberUuid,
    titleUuid: setTitleDialog.value.selectedTitleUuid
  })
}

const maxGuildMemberCount = computed(() => {
  let extra = 0;
  for (const b of buildingInfo.value) {
    if (b.level > 0 && b.type === allGuildBuilding.bigCozyDen.id) {
      const buildEffect = allGuildBuilding.bigCozyDen.effect(b.level);
      extra += buildEffect.maxGuildMemberIncrease;
    }
  }

  return BASE_GUILD_MEMBER_COUNT + extra;
})
</script>