// 查询角色已拥有的随机词条列表（只读）
// 校验点：
// - 仅允许操作自己的角色（characterUuid 必须等于当前用户 uuid）
// - 对输入做严格校验，避免依赖外部输入
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { listCharacterAffixes } from "~/server/utils/game/affix";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ characterUuid: string }>
) {
  const { user, data: payload } = data;
  try {
    // 基本校验：必须操作自身角色
    const characterUuid = String(payload?.characterUuid || '').trim();
    if (!characterUuid || characterUuid !== user.uuid) {
      throw new Error('无效的角色标识');
    }

    const res = await listCharacterAffixes(user.uuid, characterUuid);
    emitEventToUser(user, "characterAffix:list:success", { list: res });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:list:error", { message: err?.message || String(err) });
  }
}
