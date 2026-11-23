import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  getUserSponsorPointInfo,
  listSponsorPointRecords
} from "~/server/utils/game/sponsorPoint";

/**
 * 查询用户赞助积分
 */
export async function sponsorPoint_get(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const points = await getUserSponsorPointInfo(userUuid);
    emitEventToUser(userUuid, "sponsorPoint:get:success", { current: points.current, max: points.max });
  } catch (e: any) {
    emitEventToUser(userUuid, "sponsorPoint:get:fail", { message: e.message });
  }
}

/**
 * 查询积分变动记录
 */
export async function sponsorPoint_record_list(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ page?: number; pageSize?: number }>
) {
  const userUuid = data.user.uuid;
  const { page = 1, pageSize = 20 } = data.data || {};
  try {
    const records = await listSponsorPointRecords(userUuid, page, pageSize);
    emitEventToUser(userUuid, "sponsorPoint:record:list:success", { records });
  } catch (e: any) {
    emitEventToUser(userUuid, "sponsorPoint:record:list:fail", { message: e.message });
  }
}