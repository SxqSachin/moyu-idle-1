import type { KittyEssayInfo } from "~/shared/types/kittyEssayInfo"
import { emitEventToServer, registerSocketEventListener } from "./socket"
import type { KittyFriendshipInfo } from "~/shared/types/kittyFriend"

export const emitGetKittyFriend = (kittyUuid: string) => {
    emitEventToServer("kitty:getAllFriend", {kittyUuid})
}

export const onGetKittyAllFriendSuccess = registerSocketEventListener<KittyFriendshipInfo[]>("kitty:getAllFriend:success")
export const onGetKittyAllFriendError = registerSocketEventListener<{message: string}>("kitty:getAllFriend:error")


export const emitDeleteKittyFriend = (friendshipId: number) => {
    emitEventToServer("kitty:deleteFriend", {friendshipId})
}
export const onDeleteKittyFriendSuccess = registerSocketEventListener<KittyFriendshipInfo[]>("kitty:deleteFriend:success")
export const onDeleteKittyFriendError = registerSocketEventListener<{message: string}>("kitty:deleteFriend:error")