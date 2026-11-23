import type { GameResourceTradeEvent } from "~/shared/types/gameResource"
import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { ItemCountInfo } from "~/shared/types/gameInventory"
import type { CharacterInventory } from "~/generated/prisma"
import type { GameSocketData } from "~/shared/types/socket"

// 购买资源
export function emitShopBuyResource(tradeInfo: GameResourceTradeEvent) {
    emitEventToServer("requestShopBuyResource", tradeInfo)
}

// 出售资源
export function emitShopSellResource(tradeInfo: GameResourceTradeEvent) {
    emitEventToServer("requestShopSellResource", tradeInfo)
}

// 监听购买成功
export const onShopBuySuccess = registerSocketEventListener<{
    tradeInfo: ItemCountInfo;
    inventory: CharacterInventory;
}>("shopBuySuccess")

export const onShopBuyFail = registerSocketEventListener<{ message: string }>("requestShopBuyResource:fail")

// 监听出售成功
export const onShopSellSuccess = registerSocketEventListener<{
    tradeInfo: ItemCountInfo;
    inventory: CharacterInventory;
}>("shopSellSuccess")