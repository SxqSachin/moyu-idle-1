// 删除一条词条（按 id）
// 校验点：
// - 仅允许操作自己的角色
// - id 为正整数
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { removeCharacterAffix } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";

type Payload = {
  characterUuid: string
  id: number
}

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    const characterUuid = String(payload?.characterUuid || '').trim();
    if (!characterUuid || characterUuid !== user.uuid) {
      throw new Error('无效的角色标识');
    }
    const id = Number(payload?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('无效的词条ID');
    }
  await removeCharacterAffix({ userUuid: user.uuid, characterUuid, id });
  // 词条变化后，刷新并推送角色属性
  const latestStatus = await updateCharacterStatusInfo(characterUuid);
  dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:remove:success", { ok: true });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:remove:error", { message: err?.message || String(err) });
  }
}
