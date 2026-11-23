import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getKitty, } from "~/server/utils/game/kitty"
import { getKittyFriendship, getKittyFriendshipsByKitty } from "~/server/utils/game/kittyFriend"
import { prisma } from "~/server/utils/game/db"
import { addKittyEssay, createKittyEssay } from "~/server/utils/game/kittyEssay"

export async function ioGetKittyAllFriend (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string }>
) {
  try {
    const { kittyUuid } = data.data
    const userUuid = data.user.uuid

    if (!kittyUuid) {
      emitEventToUser(data.user, "kitty:getAllFriend:error", { message: "猫咪ID不能为空" })
      return
    }

    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
      emitEventToUser(data.user, "kitty:getAllFriend:error", { message: "小猫咪不存在" })
      return
    }

    if (kitty.owner != userUuid) {
      emitEventToUser(data.user, "kitty:getAllFriend:error", { message: "您没有权限查看该小猫咪的好友关系" })
      return
    }

    const res = await getKittyFriendshipsByKitty(kittyUuid)
    emitEventToUser(data.user, "kitty:getAllFriend:success", res )
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:getAllFriend:error", { message: e.message || "获取失败" })
  }
}

export async function ioDeleteKittyFriend (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ friendshipId: number }>
) {
  try {
    const { friendshipId } = data.data
    const userUuid = data.user.uuid

    if (!friendshipId) {
      emitEventToUser(data.user, "kitty:deleteFriend:error", { message: "好友关系不能为空" })
      return
    }

    const friendship = await getKittyFriendship(friendshipId)
    if (!friendship) {
      emitEventToUser(data.user, "kitty:deleteFriend:error", { message: "好友关系不存在" })
      return
    }

    if (friendship.ownerA !== userUuid && friendship.ownerB !== userUuid) {
      emitEventToUser(data.user, "kitty:deleteFriend:error", { message: "您没有权限删除该好友关系" })
      return
    }

    await prisma.kittyFriendship.update({
      where: { id: friendshipId },
      data: { del: true } // 逻辑删除
    });

    let kittyA = await getKitty(friendship.kittyAUuid);
    let kittyB = await getKitty(friendship.kittyBUuid);


    if (kittyA && kittyB) {
      // kittyA.mood -= 10
      // kittyB.mood -= 10
      await Promise.all([
        addKittyEssay(kittyA, `和 [${kittyB.name}{${kittyB.uuid}}] 说了再见👋`, { action: 'delete_friend' }),
        addKittyEssay(kittyB, `和 [${kittyA.name}{${kittyA.uuid}}] 说了再见👋`, { action: 'delete_friend' }),
        // prisma.kitty.update({
        //   where: { uuid: kittyA.uuid },
        //   data: {
        //     mood: {
        //       decrement: 10
        //     }
        //   }
        // }),
        // prisma.kitty.update({
        //   where: { uuid: kittyB.uuid },
        //   data: {
        //     mood: {
        //       decrement: 10
        //     }
        //   }
        // })
      ]);
    }

    let newFriendships = await getKittyFriendshipsByKitty(kittyA?.uuid || userUuid);

    emitEventToUser(data.user, "kitty:deleteFriend:success", { res: newFriendships });
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:deleteFriend:error", { message: e.message || "删除失败" })
  }
}