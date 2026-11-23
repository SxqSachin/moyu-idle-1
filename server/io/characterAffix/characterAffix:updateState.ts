// 更新词条状态（ACTIVE/INACTIVE/LOCKED），使用乐观锁
// 校验点：
// - 仅允许操作自己的角色
// - id 为正整数
// - newState 必须在允许枚举内
// - version 若提供：非负整数（乐观锁）
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import type { CharacterAffixState } from "~/shared/types/affix";
import { updateCharacterAffixState } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";

type Payload = {
  characterUuid: string
  id: number
  newState: CharacterAffixState
  version?: number
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
    const newState = String(payload?.newState || '').trim() as CharacterAffixState;
    if (!['ACTIVE','INACTIVE','LOCKED'].includes(newState)) {
      throw new Error('无效的词条状态');
    }
    const version = payload?.version;
    if (version != null && (!Number.isInteger(version) || version < 0)) {
      throw new Error('无效的版本号');
    }

    const res = await updateCharacterAffixState({
      userUuid: user.uuid,
      characterUuid,
      id,
      newState,
      expectedVersion: version,
    });
    if (!res.ok) throw new Error('更新失败，请重试');
    // 启用/禁用/锁定状态变化后，刷新并推送角色属性
    const latestStatus = await updateCharacterStatusInfo(characterUuid);
    dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:updateState:success", { current: res.current });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:updateState:error", { message: err?.message || String(err) });
  }
}
