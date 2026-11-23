import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { createBattleRoom, getBattleRoomById, updateBattleRoomInfo } from "~/server/utils/game/battle";
import { CharacterPhantomBorrowState } from "~/shared/types/characterPhantom";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{roomId: string, phantomBorrowUuid: string}>,
) {
  try {
    const { roomId, phantomBorrowUuid } = data.data;
    const userUuid = data.user.uuid;

    // 获取房间，校验权限
    const battleRoom = await getBattleRoomById(roomId);
    if (!battleRoom) throw new Error("房间不存在");

    let phantomInfo = await getBorrowByUuid(phantomBorrowUuid)

    if (!phantomInfo) throw new Error("幻象不存在");
    if (phantomInfo.borrower != userUuid) throw new Error("无权使用该幻象");

    // 更新房间信息
    let currentPhantomList = battleRoom.phantomUuidList;
    if (!currentPhantomList) {
      currentPhantomList = [];
    }
    currentPhantomList.push(phantomInfo.uuid)
    currentPhantomList = [...new Set(currentPhantomList)]

    // 每次加入幻象，都先从过滤一次现有的幻象是否都还有效
    for(const phantomUuid of currentPhantomList) {
      let thisPhantom = await prisma.characterPhantomBorrow.findUnique({ where: { uuid: phantomUuid } });

      if (!thisPhantom || thisPhantom.state != CharacterPhantomBorrowState.ACTIVE) {
        currentPhantomList = currentPhantomList.filter(uuid => uuid !== phantomUuid);
      }
    }

    battleRoom.phantomUuidList = currentPhantomList;

    const updatedRoom = await updateBattleRoomInfo(roomId, battleRoom);

    // emitEventToUser(data.user, "battleRoom:update:success", updatedRoom);
    // 通知房间内所有成员（可选，需有广播逻辑）
    for (const memberId of updatedRoom.memberIds) {
      emitEventToUser(memberId, "battleRoom:update:success", updatedRoom);
    }
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:update:error", { message: e.message || "房间信息修改失败" });
  }
}