import { emitEventToServer, registerSocketEventListener } from "./socket";

export function emitCheckBanned() {
  emitEventToServer("user:checkBanned");
}

export const onBanned = registerSocketEventListener<{ message: string }>("banned");

// export function emitBindEmail(email: string) {
//   emitEventToServer("user:bindEmail", { email });
// }

// export const onBindEmailSuccess = registerSocketEventListener<void>("user:bindEmail:success");
// export const onBindEmailFail = registerSocketEventListener<{ message: string }>("user:bindEmail:fail");

// 发送验证码到邮箱
export function emitSendVerifyEmail(email: string) {
  emitEventToServer("user:sendVerifyEmailCode", { email });
}
export const onSendVerifyEmailSuccess = registerSocketEventListener<{ message?: string }>("user:sendVerifyEmailCode:success");
export const onSendVerifyEmailFail = registerSocketEventListener<{ message: string }>("user:sendVerifyEmailCode:fail");

// 校验邮箱验证码
export function emitVerifyEmail(code: string) {
  emitEventToServer("user:verifyEmailVerifyCode", { code });
}
export const onVerifyEmailSuccess = registerSocketEventListener<{ message?: string }>("user:verifyEmailVerifyCode:success");
export const onVerifyEmailFail = registerSocketEventListener<{ message: string }>("user:verifyEmailVerifyCode:fail");