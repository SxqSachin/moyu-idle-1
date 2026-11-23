<template>
  <el-card class="w-full max-w-md mx-auto mt-8 shadow-lg">
    <el-text class="block! text-center w-full! mb-4!">
      当前绑定邮箱：<strong>{{ displayEmail }}</strong>
      <br />
      如果需要验证该邮箱，请点击发送验证码并在收到后输入验证码完成验证。
    </el-text>

    <div class="flex flex-col items-center space-y-4 px-12">
      <div class="w-64!">
        <el-input v-model="email" placeholder="邮箱" :disabled="true" />
      </div>

      <div class="flex space-x-2 mt-2">
        <el-button type="primary" :loading="sending" @click="onSend" :disabled="cooldownSeconds>0">
          <span v-if="cooldownSeconds>0">发送验证码 ({{ cooldownSeconds }}s)</span>
          <span v-else>发送验证码</span>
        </el-button>
        <el-button @click="$emit('cancel')">取消</el-button>
      </div>

      <div class="w-64! mt-4">
        <el-input v-model="code" placeholder="输入验证码" />
      </div>
      <div>
        <el-button type="primary" :loading="verifying" @click="onVerify">验证并确认</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { emitSendVerifyEmail, onSendVerifyEmailFail, onSendVerifyEmailSuccess, emitVerifyEmail, onVerifyEmailFail, onVerifyEmailSuccess } from '~/api/game/socket/user';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { sanitizeInput } from '~/shared/utils';

const user = useUserSession();

const email = computed(() => {
    return user.user.value?.email ?? ''
})
const code = ref('');
const sending = ref(false);
const verifying = ref(false);
const cooldownSeconds = ref(0);
let cooldownTimer: number | undefined;

const displayEmail = computed(() => email.value || '（未绑定）');

let offSendSuccess: (() => void) | undefined;
let offSendFail: (() => void) | undefined;
let offVerifySuccess: (() => void) | undefined;
let offVerifyFail: (() => void) | undefined;

onMounted(async () => {
  await waitUtilConnected();
  // fill email from session if available

  offSendSuccess = onSendVerifyEmailSuccess(() => {
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
  offSendFail = onSendVerifyEmailFail((d) => {
    ElNotification.error(d.message);
  });

  offVerifySuccess = onVerifyEmailSuccess(async () => {
    ElNotification.success({ title: '验证成功', message: '邮箱验证成功，请重新登录' });
    // refresh user session/profile
    await user.clear()
    await user.fetch()
    // small delay to let server-side changes reflect
    setTimeout(() => location.reload(), 300);
  });
  offVerifyFail = onVerifyEmailFail((d) => {
    ElNotification.error(d.message);
  });
});

onUnmounted(() => {
  offSendSuccess?.();
  offSendFail?.();
  offVerifySuccess?.();
  offVerifyFail?.();
  if (cooldownTimer) window.clearInterval(cooldownTimer);
});

async function onSend() {
  if (!email.value) return ElNotification.error('没有可用的绑定邮箱');
  sending.value = true;
  if (cooldownSeconds.value > 0) {
    sending.value = false;
    ElNotification.error(`请等待 ${cooldownSeconds.value} 秒后重试`);
    return;
  }
  emitSendVerifyEmail();
  sending.value = false;
}

async function onVerify() {
  code.value = sanitizeInput(code.value);
  if (!code.value) return ElNotification.error('请输入验证码');
  verifying.value = true;
  emitVerifyEmail(code.value);
  verifying.value = false;
}
</script>
