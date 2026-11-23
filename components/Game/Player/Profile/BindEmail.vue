<template>
  <el-card class="w-full max-w-md mx-auto mt-8 shadow-lg">
    <el-text class="block! text-center w-full! mb-4!">
      绑定邮箱可以更好地保护您的账号安全。
    </el-text>
    <el-form
      :model="form"
      :rules="rules"
      ref="formRef"
      label-position="left"
      class="flex flex-col items-center space-y-4 px-12"
    >
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱" class="w-64!"
        @input="onEmailInput"
         />
      </el-form-item>
      <el-form-item>
        <div class="mt-2">
          <el-button type="primary" @click="onSubmit" :loading="loading" :disabled="cooldownSeconds>0">
            <span v-if="cooldownSeconds>0">发送验证码 (等待 {{ cooldownSeconds }}s)</span>
            <span v-else>发送验证码</span>
          </el-button>
        </div>
      </el-form-item>
      <!-- Inline code input as a fallback (also shown when dialog is opened) -->
      <el-form-item label="验证码" prop="code">
        <div class="flex items-center space-x-2">
          <el-input v-model="codeInput" placeholder="请输入验证码" class="w-40!" />
          <el-button type="primary" :loading="verifyLoading" @click="onVerifySubmit">验证并绑定</el-button>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { type FormInstance, type FormRules } from "element-plus";
import { emitSendVerifyEmail, onSendVerifyEmailFail, onSendVerifyEmailSuccess, emitVerifyEmail, onVerifyEmailFail, onVerifyEmailSuccess } from "~/api/game/socket/user";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { sanitizeInput } from "~/shared/utils";

const user = useUserSession()

const form = ref({
  email: "",
});
const loading = ref(false);
const codeInput = ref('');
const verifyLoading = ref(false);
const cooldownSeconds = ref(0);
let cooldownTimer: number | undefined;
const formRef = ref<FormInstance>();

const rules: FormRules = {
  email: [
    { required: true, message: "邮箱不能为空", trigger: "blur" },
    { type: "email", message: "请输入正确的邮箱格式", trigger: "blur" },
  ],
};

let off: FuncAction
let off1: FuncAction

onMounted(async () => {
  await waitUtilConnected()

  form.value.email = user.user.value?.email || ''

  off = onSendVerifyEmailSuccess(() => {
    ElNotification.success({ title: '已发送', message: '验证码已发送，请查看邮箱' });
    // start 60s cooldown
    cooldownSeconds.value = 60;
    if (cooldownTimer) window.clearInterval(cooldownTimer);
    cooldownTimer = window.setInterval(() => {
      cooldownSeconds.value -= 1;
      if (cooldownSeconds.value <= 0) {
        cooldownSeconds.value = 0;
        if (cooldownTimer) {
          window.clearInterval(cooldownTimer);
          cooldownTimer = undefined;
        }
      }
    }, 1000);
  });
  off1 = onSendVerifyEmailFail((data) => {
    ElNotification.error(data.message);
  });

  // verify listeners
  const off2 = onVerifyEmailSuccess(async () => {
    alert("邮箱绑定成功，即将重新登录")
    await user.clear()
    await user.fetch()
    location.reload()
  });
  const off3 = onVerifyEmailFail((data) => {
    ElNotification.error(data.message);
  });
  // unregister verify listeners on unmount as well
  onUnmounted(() => {
    off2?.();
    off3?.();
  })
})
onUnmounted(() => {
  off?.();
  off1?.();
  if (cooldownTimer) window.clearInterval(cooldownTimer);
})

function onEmailInput(val: string) {
  form.value.email = sanitizeInput(val);
}

async function onSubmit() {
  form.value.email = sanitizeInput(form.value.email); // 过滤恶意字符
  formRef.value?.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    // disable early if cooldown active
    if (cooldownSeconds.value > 0) {
      loading.value = false;
      ElNotification.error(`请等待 ${cooldownSeconds.value} 秒后重试`);
      return;
    }
    emitSendVerifyEmail(form.value.email);
    loading.value = false;
  });
}

async function onVerifySubmit() {
  codeInput.value = sanitizeInput(codeInput.value);
  if (!codeInput.value) return ElNotification.error('请输入验证码');
  verifyLoading.value = true;
  emitVerifyEmail(codeInput.value);
  verifyLoading.value = false;
}
</script>

