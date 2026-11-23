import { emitEventToUser } from "~/server/io"
import { CharacterInventory, ItemCountInfo } from "~/shared/types/gameInventory"

export const dispatchShopBuySuccess = (userUuid: string, tradeInfo: ItemCountInfo, inventory: CharacterInventory) => {
    emitEventToUser<{
        tradeInfo: ItemCountInfo
        inventory: CharacterInventory
    }>(userUuid, "shopBuySuccess", {
        tradeInfo,
        inventory
    })
}
export const dispatchShopSellSuccess = (userUuid: string) => {
    emitEventToUser<{
    }>(userUuid, "shopSellSuccess", {})
}