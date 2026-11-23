import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory"
import { CharacterEquipActionInfo } from "~/shared/types/characterInfo"
import { equipItem } from "~/server/utils/game/equipment"
import { updateAllActionDuration, updateAllActionResourceRequirement, updateCharacterStatusInfo } from "~/server/utils/game/character"
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus"
import { withUniqueLock } from "~/server/utils/lock"

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<CharacterEquipActionInfo>
) {
    const user = data.user
    const info = data.data

    try {
      if (data.data.type == 'battle') {
        let room = await getBattleRoomByUserId(user.uuid);
        if (!!room && room.status != 'waiting') {
          throw new Error("战斗中无法更换装备");
        }
      }

        await withUniqueLock(
          "effectAction:equipModifyRequest:" + user.uuid,
          async () => {
            let res = await equipItem(user.uuid, info.resourceId, info.type);

            // 更新客户端库存信息
            dispatchInventoryInfoToClient(user.uuid);

            emitEventToUser(user, "effectAction:equip:success", {
              equipment: res,
              info,
            });

            // 并行处理三个更新
            const [
              latestAllActionDurationDetail,
              latestAllActionResourceRequirement,
              latestStatus
            ] = await Promise.all([
              updateActionDuration(user.uuid),
              updateAllActionResourceRequirement(user.uuid),
              updateCharacterStatusInfo(user.uuid)
            ]);

            emitEventToUser(
              user,
              "character:updateActionDuration:success",
              latestAllActionDurationDetail
            );

            emitEventToUser(
              user,
              "character:updateActionResourceRequirement:success",
              latestAllActionResourceRequirement
            );

            dispatchCharacterStatusInfo(user.uuid, latestStatus);
          }
        );
    } catch (err: any) {
        emitEventToUser(user, "effectAction:equip:error", { 
            message: err.message 
        })
    }
}