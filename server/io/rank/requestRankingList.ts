import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { RankingList, } from "~/shared/types/rankingList";
import { emitEventToUser } from "..";
import { getAllIronRankingList, getAllRankingList } from "../../utils/game/rankingList";

export async function handleRequestRankingList (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {

  const rankingList = await getAllRankingList()

  emitEventToUser(data.user.uuid, 'rankingList', rankingList)
}

export async function handleRequestIronRankingList (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {

  const rankingList = await getAllIronRankingList()

  emitEventToUser(data.user.uuid, 'ironRankingList', rankingList)
}