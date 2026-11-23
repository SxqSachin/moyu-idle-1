import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getAllRooms } from "~/server/utils/game/room";
import type { Room } from "~/shared/types/room";
import { getAllBattleRooms } from "~/server/utils/game/battle";
import { BattleRoom } from "~/shared/types/battleRoom";
import { BATTLE_ROOM_PAGE_SIZE } from "~/shared/data/constant";
import { isIronCat } from "~/server/utils/game/account";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{page: number, name?: string, area?: string, onlyWaiting?: boolean}>,
) {
  try {
    let user = data.user.uuid;

    const ironcat = await isIronCat(user)

    let rooms: BattleRoom[] = await getAllBattleRooms();

    rooms = rooms.filter(room => room.isPublic);

    if (ironcat) {
      rooms = rooms.filter(room => room.ironcat)
    } else {
      rooms = rooms.filter(room => !room.ironcat)
    }

    // 如果有搜索条件，过滤房间
    if (data.data?.name) {
      const searchName = data.data.name.toLowerCase();
      rooms = rooms.filter((room) => room.name.toLowerCase().includes(searchName));
    }

    // 如果有副本筛选条件，过滤房间
    if (data.data?.area) {
      rooms = rooms.filter((room) => room.battleType !== "worldBoss" && room.area === data.data.area);
    }

    // 如果只查询等待中的房间
    if (data.data?.onlyWaiting) {
      rooms = rooms.filter((room) => room.status === "waiting");
    }

    // 分页
    const pageSize = BATTLE_ROOM_PAGE_SIZE; // 每页显示的房间数量
    const page = data.data?.page || 1;  
    const startIndex = (page - 1) * pageSize;
    const paginatedRooms = rooms.slice(startIndex, startIndex + pageSize);

    emitEventToUser(data.user, "battleRoom:list:success", paginatedRooms);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:list:error", { message: e.message || "获取房间列表失败" });
  }
}