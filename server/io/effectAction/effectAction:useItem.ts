import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { UseItemInfo } from "~/shared/types/gameEffect"
import { useItem } from "../../utils/game/effectAction"
import { emitEventToUser } from ".."
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory"
import { withUniqueLock } from "~/server/utils/lock"
import { updateCharacterStatusInfo } from "~/server/utils/game/character"
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus"
import { getUserCustomStyle } from "~/server/utils/game/style"
import { clone } from "~/shared/utils"

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<UseItemInfo>
) {
    const user = data.user
    const info = data.data

    try {
        await withUniqueLock("effectAction:useItem:" + user.uuid, async () => {
          let res = await useItem(user.uuid, info.itemId, info.multiple);

          // 更新客户端库存信息
          let [latestStatus] = await Promise.all([
            //   dispatchInventoryInfoToClient(user.uuid),
              updateCharacterStatusInfo(user.uuid),
          ])

          // 检查使用的物品，是否会导致 actionDurationEffect 变化
          const actionDurationEffectResult = clone(res.actionDurationEffectResult);
          delete res.actionDurationEffectResult;

          emitEventToUser(user, "effectAction:useItem:success", {
            itemId: info.itemId,
            multiple: info.multiple,
            result: res,
          });

          if (actionDurationEffectResult) {
            await scheduleUserImmediate(user.uuid)
            emitEventToUser(
                user,
                "character:updateActionDuration:success",
                actionDurationEffectResult
            );
          }

          if (res.hasUniqueFlagChange) {
            const result = await getAllUserUniqueFlags(user.uuid);
            emitEventToUser(user.uuid, "uniqueFlag:all:success", { flags: result });
          }

          dispatchCharacterStatusInfo(user.uuid, latestStatus);

          // 使用物品后，产生样式变化，则广播
          if (res.hasStyleChange) {
              const style = await getUserCustomStyle(user.uuid);
              emitEventToUser(user.uuid, "style:get:success", { uuid: user.uuid, style });
          }
        });
    } catch (err: any) {
        emitEventToUser(user, "effectAction:useItem:error", { 
            message: err.message 
        })
    }
}