<template>
  <el-form :model="form" ref="formRef" :label-width="120" label-position="left" class="flex flex-col items-start space-y-4">
    <el-form-item label="头像框" prop="avatarBorder">
      <el-select v-model="form.currentAvatarBorder" placeholder="请选择" class="w-48!">
        <el-option label="无" value=""></el-option>
        <template v-for="availableAvatarBorder of userStyle.availableAvatarBorders">
          <el-option :value="allAvatarBorder[availableAvatarBorder].value" :label="allAvatarBorder[availableAvatarBorder].name" class="h-full!">
            <div class="flex flex-col items-start mb-2">
              <div>{{ allAvatarBorder[availableAvatarBorder].name }}</div>
              <div class="p-4 text-center w-full">
                <Avatar :avatar="profile.avatar" :border="availableAvatarBorder" :size="96"></Avatar>
              </div>
            </div>
          </el-option>
        </template>
      </el-select>
    </el-form-item>

    <el-form-item label="战斗卡片主题" prop="battleStyle">
      <el-select v-model="form.currentBattleCardStyle" placeholder="请选择" class="w-48!">
        <el-option label="无" value=""></el-option>
        <template v-for="availableBattleCardStyle of userStyle.availableBattleCardStyles">
          <el-option :value="allBattleStyle[availableBattleCardStyle].value"
            :label="allBattleStyle[availableBattleCardStyle].name" class="h-full!">
            <div class="flex flex-col items-start mb-2">
              <div>{{ allBattleStyle[availableBattleCardStyle].name }}</div>
              <div class="text-xs text-gray-300">{{ allBattleStyle[availableBattleCardStyle].description }}</div>
            </div>
          </el-option>
        </template>
      </el-select>
    </el-form-item>
    <el-form-item label="个人信息主题" prop="profileStyle">
      <el-select v-model="form.currentProfileStyle" placeholder="请选择" class="w-48!">
        <el-option label="无" value=""></el-option>
        <template v-for="availableProfileStyle of userStyle.availableProfileStyles">
          <el-option :value="allProfileStyle[availableProfileStyle].value"
            :label="allProfileStyle[availableProfileStyle].name" class="h-full!">
            <div class="flex flex-col items-start mb-2">
              <div>{{ allProfileStyle[availableProfileStyle].name }}</div>
              <div class="text-xs text-gray-300">{{ allProfileStyle[availableProfileStyle].description }}</div>
            </div>
          </el-option>
        </template>
      </el-select>
    </el-form-item>

    <el-form-item label="称号" prop="title">
      <el-select v-model="baseInfoForm.title" placeholder="请选择称号" class="w-48!">
        <el-option label="无" value=""></el-option>
        <template v-for="availableTitle of profile.availableTitle">
          <el-option :value="allTitles[availableTitle].value" :label="allTitles[availableTitle].name" class="h-full!">
            <TitleOption :title="availableTitle"></TitleOption>
          </el-option>
        </template>
      </el-select>
    </el-form-item>

    <el-form-item label="对话气泡" prop="diyChatBubbleStyle">
      <div class="flex gap-2">
        <el-button @click="openDialog">编辑</el-button>
        <el-popconfirm 
        v-if="canDiyBubbleStyle"
          title="确定要重置颜色设置吗？这将清除您自定义的背景色、文字色和文字阴影设置。"
          confirm-button-text="确定重置"
          cancel-button-text="取消"
          width="300px"
          @confirm="resetDiyChatBubbleStyle"
        >
          <template #reference>
            <el-button type="warning">重置颜色设置</el-button>
          </template>
        </el-popconfirm>
      </div>
    </el-form-item>

    <el-form-item>
      <div class="mt-2">
        <el-button type="primary" @click="onSubmit" :loading="loading">保存</el-button>
        <el-button @click="$emit('cancel')">取消</el-button>
      </div>
    </el-form-item>
  </el-form>

  <el-dialog v-model="showDialog" title="自定义对话气泡" :width="isMobile ? '100%' : '600px'">
    <DiyChatBubbleStyle :diyChatBubbleStyle="form.diyChatBubbleStyle" :bubbleId="form.currentChatBubbleStyle" @confirm="handleConfirm" />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { type FormInstance, ElPopconfirm } from "element-plus";

import { clone, } from "~/shared/utils";
import { useUserStyle } from "~/composables/game/useUserStyle";
import type { GameUserCustomStyle } from "~/shared/types/style";
import { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from "~/shared/data/allStyle";
import { emitGetUserCustomStyle, emitSetStyle, onSetStyleFail, onSetStyleSuccess } from "~/api/game/socket/style";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import Msg from "~/components/Game/Chat/Msg.vue";
import DiyChatBubbleStyle from "./DiyChatBubbleStyle.vue";
import { useUniqueFlag } from "~/composables/game/useUniqueFlag";
import TitleOption from "../TitleOption.vue";
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";
import { allTitles } from "~/shared/data/allTitle";
import { emitUpdateProfile } from "~/api/game/socket/profile";
import { useUserProfileInfo } from "~/composables/game/useUserProfileInfo";
import Avatar from "../Avatar.vue";

const props = defineProps<{
  profile: PlayerProfileInfo
}>();

const { isMobile } = useDevice();

const {user} = useUserSession()
const userProfiles = useUserProfileInfo()

const userStyle = useUserStyle();

const uniqueFlag = useUniqueFlag();

const form = ref<GameUserCustomStyle>({
  ...clone(userStyle.value)
});

const baseInfoForm = ref<Partial<PlayerProfileInfo>>({
  name: props.profile.name,
  avatar: props.profile.avatar,
  title: props.profile.title || "",
});

const loading = ref(false);
const formRef = ref<FormInstance>();
const showDialog = ref(false);


const canDiyBubbleStyle = computed(() => {
    return uniqueFlag.value.find(u => u.key == 'diy' && u.type == 'chatBubble');
})

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  off1 = onSetStyleSuccess(async data => {
    userStyle.value = data.style
    ElNotification({
      title: "样式设置成功",
      type: "success",
      duration: 1800,
    })

    const selfUuid = user.value!.uuid

    let res = await $fetch("/api/game/user/profile", {
        method: "GET",
        query: {
            uuid: selfUuid
        }
    })
    if (res.code === 200 && 'data' in res) {
        if (res.data.uuid == selfUuid) {
            userProfiles.value[selfUuid] = res.data;
            userProfiles.value = clone(userProfiles.value)
        }
    }
  })
  off2 = onSetStyleFail(data => {
    ElNotification({
      title: "样式设置失败",
      type: "error",
      message: data.message,
      duration: 1800,
    })
  })

  emitGetUserCustomStyle()
})

onUnmounted(() => {
  off1?.()
  off2?.()
})

function onSubmit(e: Event) {
  if (!e.isTrusted) return;
  emitSetStyle(form.value)

  emitUpdateProfile(baseInfoForm.value);
}

function openDialog() {
  showDialog.value = true;
}

function handleConfirm(value: GameUserCustomStyle['diyChatBubbleStyle'], bubbleId: keyof typeof allChatBubbleStyle | "") {
  form.value.diyChatBubbleStyle = value;
  form.value.currentChatBubbleStyle = bubbleId;
  showDialog.value = false;
}

function resetDiyChatBubbleStyle() {
  form.value.diyChatBubbleStyle = undefined;
  ElNotification({
    title: "颜色设置已重置",
    type: "success",
    duration: 1800,
  })
}
</script>