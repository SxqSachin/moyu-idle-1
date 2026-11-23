import { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";

const BATTLE_PANEL_SET_KEY = 'battle-panel-users';

type Payload = { enable: boolean };

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const userUuid = data.user.uuid;
  const enable = !!data.data?.enable;
  try {
    if (enable) {
      await redisClient.sAdd(BATTLE_PANEL_SET_KEY, userUuid);
    } else {
      await redisClient.sRem(BATTLE_PANEL_SET_KEY, userUuid);
    }
  } catch (e) {
    console.error('[msgPref:battle:set] redis error', e);
  }
}
