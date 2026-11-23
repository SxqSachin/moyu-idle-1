// 批量删除词条
// 校验点：
// - 仅允许操作自己的角色
// - ids 需为正整数数组（建议上限以防滥用）

import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { removeCharacterAffixesBulk } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";

const MAX_IDS = 100;

type Payload = {
  characterUuid: string;
  ids: number[];
};

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

    const ids = Array.isArray(payload?.ids) ? payload!.ids : [];
    if (!ids.length) {
      emitEventToUser(user, "characterAffix:removeMany:success", { ok: true, removedIds: [] });
      return;
    }

    const normalized = Array.from(new Set(ids.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)));
    if (!normalized.length) {
      throw new Error('无效的待删除 ID');
    }
    if (normalized.length > MAX_IDS) {
      throw new Error(`一次最多删除 ${MAX_IDS} 条`);
    }

    const { removedIds } = await removeCharacterAffixesBulk({
      userUuid: user.uuid,
      characterUuid,
      ids: normalized,
    });

    // 词条变化后，刷新并推送角色属性
    if (removedIds.length > 0) {
      const latestStatus = await updateCharacterStatusInfo(characterUuid);
      dispatchCharacterStatusInfo(characterUuid, latestStatus);
    }

    emitEventToUser(user, "characterAffix:removeMany:success", { ok: true, removedIds });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:removeMany:error", { message: err?.message || String(err) });
  }
}
