import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getUserEquipment } from "~/server/utils/game/equipment"
import { CharacterEquipmentType } from "~/shared/types/characterInfo"

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{type: CharacterEquipmentType}>,
) {
    const self = data.user.uuid

    try {
        const res = await getUserEquipment(self, data.data.type)

        switch(data.data.type) {
            case "work":
                emitEventToUser(self, "character:getEquipment:work:success", res)
                break
            case "battle":
                emitEventToUser(self, "character:getEquipment:battle:success", res)
                break
            default:
                throw new Error("Unknown equipment type")
        }
        // emitEventToUser(self, "character:getEquipment:success", res)
    } catch (err: any) {
        emitEventToUser(self, "character:getEquipment:error", { 
            message: err.message 
        })
    }
}