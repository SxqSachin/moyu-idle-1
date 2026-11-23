<template>
    <el-form
      :model="form"
      :rules="rules"
      ref="formRef"
      label-position="left"
      class="flex flex-col items-start space-y-4"
      label-width="140"
    >
      <el-form-item label="头像（点击修改）" prop="avatar" class="items-center">
        <div class="relative group leading-0!" @click="showAvatarDialog = true">
          <GameUserAvatarAndName :uuid="user!.uuid" :only-avatar="true" :avatar-size="96"></GameUserAvatarAndName>
        </div>
      </el-form-item>
      <el-form-item label="昵称" prop="name">
        <el-input v-model="form.name" placeholder="请输入昵称" class="w-36!" />
      </el-form-item>

      <el-form-item label="聊天中隐藏公会头衔" prop="hideGuildTitleInChat">
        <el-checkbox v-model="form.option!.hideGuildTitleInChat" label="隐藏" :border="true" />
      </el-form-item>
      <el-form-item label="关闭登录时邮箱验证" prop="disableEmailVerificationOnLogin">

        <el-popover placement="top" width="300px">
          <template #reference>
            <el-checkbox v-model="form.option!.disableEmailVerificationOnLogin" label="关闭" :border="true" />
          </template>

          <div>
            关闭后，即使登录环境异常，也不再需要进行邮箱验证。<br/>
            请谨慎使用该选项，以免账号被他人盗用。
          </div>

        </el-popover>
      </el-form-item>
      <!-- <el-form-item label="在排行榜中隐藏自己" prop="hideInRankingList">
        <el-checkbox v-model="form.option!.hideInRankingList" label="隐藏" :border="true" />
      </el-form-item> -->
        <div class="mt-2">
            <el-button type="primary" @click="onSubmit" :loading="loading">保存</el-button>
            <el-button @click="$emit('cancel')">取消</el-button>
        </div>
    </el-form>

    <!-- 头像选择弹窗 -->
    <el-dialog v-model="showAvatarDialog" title="选择头像" width="440px" align-center>
      <GamePlayerProfileEditAvatarSelect :default-selected="form.avatar" @update:avatar="selectAvatar"></GamePlayerProfileEditAvatarSelect>
      <template #footer>
        <el-button @click="showAvatarDialog = false">取消</el-button>
        <el-button type="primary" @click="showAvatarDialog = false">确定</el-button>
      </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";
import { emitUpdateProfile, onUpdateProfileSuccess, onUpdateProfileError, clearProfileListeners, emitGetProfile } from "@/api/game/socket/profile";

import { allTitles } from "~/shared/data/allTitle";
import { clone, ObjectKeys, sanitizeInput } from "~/shared/utils";
import { useUserStyle } from "~/composables/game/useUserStyle";
import type { GameUserCustomStyle } from "~/shared/types/style";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";

const { user } = useUserSession()

const props = defineProps<{
  profile: PlayerProfileInfo
}>();

const emit = defineEmits<{
  (e: "updated"): void
  (e: "cancel"): void
}>();

const form = ref<Partial<PlayerProfileInfo>>({
  name: props.profile.name,
  avatar: props.profile.avatar,
  title: props.profile.title || "",
  option: props.profile.option || {
    hideGuildTitleInChat: false,
    hideInRankingList: false,
    disableEmailVerificationOnLogin: false,
  },
});
const loading = ref(false);
const formRef = ref<FormInstance>();
const showAvatarDialog = ref(false);

const rules: FormRules = {
  name: [
    { required: true, message: "昵称不能为空", trigger: "blur" },
    { min: 2, max: 16, message: "昵称长度为2-16个字符", trigger: "blur" },
  ],
  avatar: [
    { required: true, message: "请选择头像", trigger: "change" },
    {
      validator: (_rule: any, value: keyof typeof avatarMap, callback: any) => {
        // if (!avatarMap[value]) {
        //   callback(new Error("请选择有效的头像"));
        // } else {
        //   callback();
        // }
        callback();
      },
      trigger: "change"
    }
  ],
};

function selectAvatar(key: string) {
  form.value.avatar = key;
}

let off1: FuncAction
let off2: FuncAction

onMounted(async () => {
  await waitUtilConnected()

  off1 = onUpdateProfileSuccess((msg) => {
    ElMessage.success(msg);
    loading.value = false;
    emit("updated");

    emitGetProfile()
  });
  off2 = onUpdateProfileError((msg) => {
    ElMessage.error(msg);
    loading.value = false;
  });
})

onUnmounted(() => {
  off1?.()
  off2?.()
})

function onSubmit(e: Event) {
  if (!e.isTrusted) return;
  if (!form.value.name) {
    ElMessage.error("昵称不能为空");
    return;
  }
  formRef.value?.validate((valid) => {
    if (!valid) return;
    loading.value = true;

    let data = clone(form.value);
    data.name = sanitizeInput(data.name || "");

    emitUpdateProfile(data);
  });
}
</script>