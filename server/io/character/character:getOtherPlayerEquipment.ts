import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getUserEquipment } from "~/server/utils/game/equipment"

export async function getOtherPlayerEquipment (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{characterUuid: string}>
) {
    const self = data.user.uuid
    const targetUserUuid = data.data.characterUuid || data.user.uuid

    try {
        const res = await getUserEquipment(targetUserUuid, 'battle')

        emitEventToUser(self, "character:getOtherPlayerEquipment:success", res)
    } catch (err: any) {
        emitEventToUser(self, "character:getOtherPlayerEquipment:unequip:error", { 
            message: err.message 
        })
    }
}

export async function getOtherPlayerWorkEquipment (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{characterUuid: string}>
) {
    const self = data.user.uuid
    const targetUserUuid = data.data.characterUuid || data.user.uuid

    try {
        const res = await getUserEquipment(targetUserUuid, 'work')

        emitEventToUser(self, "character:getOtherPlayerWorkEquipment:success", res)
    } catch (err: any) {
        emitEventToUser(self, "character:getOtherPlayerWorkEquipment:unequip:error", { 
            message: err.message 
        })
    }
}