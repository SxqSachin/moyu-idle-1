import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { updateUserPassword } from "../../utils/game/character"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ oldPassword: string; newPassword: string }>
) {
  try {
    const userUuid = data.user.uuid

    const { oldPassword, newPassword } = data.data
    const success = await updateUserPassword(userUuid, oldPassword, newPassword)
    if (success) {
      emitEventToUser(data.user, "character:resetPassword:success", { message: "密码修改成功" })
      // security: force logout all active sessions after password change
      emitEventToUser(userUuid, "security:forceLogout", { reason: "password_reset" })
    } else {
      emitEventToUser(data.user, "character:resetPassword:error", { message: "旧密码错误，修改失败" })
    }
  } catch (err: any) {
    emitEventToUser(data.user, "character:resetPassword:error", { message: err.message })
  }
}