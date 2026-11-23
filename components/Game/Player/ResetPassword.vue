<template>
    <el-card
        class="flex flex-col items-center justify-center h-full w-full"
        body-class="w-2/3"
        >
        <h2 class="text-2xl font-bold mb-6">重置密码</h2>
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top" class="w-full" autocomplete="off">
            <el-form-item label="旧密码" prop="oldPassword">
                <el-input v-model="form.oldPassword" type="password" placeholder="请输入旧密码" show-password autocomplete="new-password" />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
                <el-input v-model="form.newPassword" type="password" placeholder="请输入新密码" show-password autocomplete="new-password" />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPassword">
                <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入新密码" show-password autocomplete="new-password" />
            </el-form-item>
            <el-form-item>
                <el-button type="primary" class="w-full" :loading="loading" @click="onSubmit">
                    重置密码
                </el-button>
            </el-form-item>
        </el-form>
        <el-alert v-if="message" :type="messageType" :title="message" class="mt-4 w-full" show-icon closable
            @close="message = ''" />
    </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import {
    bindCharacteSocketAction,
    emitResetPassword,
} from "@/api/game/socket/character";
import type { GameSocketUserInfo } from "~/shared/types/socket";
import { useGlobalVisitorPassword } from "~/composables/game/useGlobalVisitorPassword";

const {user, fetch: refreshSession, clear} = useUserSession();
const visitorPassword = useGlobalVisitorPassword()
const currentLoginUserInfo = computed(() => {
    return unref(user) as GameSocketUserInfo
})

const formRef = ref();
const loading = ref(false);
const message = ref("");
const messageType = ref<"success" | "error">("success");

const form = ref({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
});

onMounted(() => {
    if (visitorPassword.value) {
        form.value.oldPassword = visitorPassword.value
    }
})

function validatePassword(_: any, value: string, callback: any) {
    // 长度限制
    if (!value || value.length < 6 || value.length > 20) {
        callback(new Error("密码长度需为6-20位"));
        return;
    }
    // 禁止空格和常见注入字符
    if (/\s|['";\\]/.test(value)) {
        callback(new Error("密码不能包含空格、引号、分号或反斜杠"));
        return;
    }
    callback();
}

const rules = {
    oldPassword: [
        { required: true, message: "请输入旧密码", trigger: "blur" },
        { validator: validatePassword, trigger: "blur" },
    ],
    newPassword: [
        { required: true, message: "请输入新密码", trigger: "blur" },
        { validator: validatePassword, trigger: "blur" },
    ],
    confirmPassword: [
        { required: true, message: "请确认新密码", trigger: "blur" },
        {
            validator: (_: any, value: string, callback: any) => {
                if (value !== form.value.newPassword) {
                    callback(new Error("两次输入的新密码不一致"));
                } else {
                    callback();
                }
            },
            trigger: "blur",
        },
    ],
};

function onSubmit() {
    formRef.value.validate((valid: boolean) => {
        if (!valid) return;
        if (!unref(currentLoginUserInfo).uuid) {
            ElMessage.error("用户信息缺失，请重新登录");
            return;
        }
        loading.value = true;
        emitResetPassword(
            form.value.oldPassword,
            form.value.newPassword
        );
    });
}

const unbind = bindCharacteSocketAction({
    onResetPasswordSuccess: async (a) => {
        // @ts-expect-error
        const { message: msg } = a
        loading.value = false;
        message.value = msg;
        messageType.value = "success";
        form.value.oldPassword = "";
        form.value.newPassword = "";
        form.value.confirmPassword = "";

        await clear()

        alert("密码重置成功，即将重新登录")

        location.reload()
    },
    onResetPasswordError: async (b) => {
        // @ts-expect-error
        const { message: msg } = b
        loading.value = false;
        message.value = msg;
        messageType.value = "error";
    }
})

onUnmounted(() => {
    unbind()
});
</script>

<style scoped>
/* 可根据需要添加自定义样式 */
</style>