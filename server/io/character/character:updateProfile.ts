import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { updateUserProfile } from "../../utils/game/character"
import { PlayerProfileInfo } from "~/shared/types/characterInfo"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Omit<PlayerProfileInfo, 'createDate'>>
) {
  const userUuid = data.user.uuid
  try {
    const success = await updateUserProfile(userUuid, data.data)

    if (success) {
      const latestStatus = await updateCharacterStatusInfo(userUuid)

      dispatchCharacterStatusInfo(userUuid, latestStatus);
    }

    emitEventToUser(data.user, "character:updateProfile:success", { message: "修改成功" })
  } catch (err: any) {
    emitEventToUser(data.user, "character:updateProfile:error", { message: err.message })
  }
}