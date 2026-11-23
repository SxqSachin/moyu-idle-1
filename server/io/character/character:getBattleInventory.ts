
import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getBattleInventoryAsUnitInfo } from "~/server/utils/game/battleInventory";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{}>
) {
    const userUuid = data.user.uuid;
    const inventory = await getBattleInventoryAsUnitInfo(userUuid);
    emitEventToUser(data.user, "character:getBattleInventory:success", inventory);
}