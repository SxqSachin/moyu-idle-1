// 重抽单条词条（仅重掷数值，不改变 affixId/稀有度）
// 校验点：
// - 角色归属（只能操作自己的角色）
// - id 必须为正整数
// - 可选 version 必须为非负整数（用于乐观锁）
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { rerollCharacterAffix } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";
import { CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS } from "~/shared/data/characterAffixConstants";

type Payload = {
  characterUuid: string
  id: number
  version?: number
}

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    const characterUuid = String(payload?.characterUuid || '').trim();
    const id = Number(payload?.id);
    const version = payload?.version;
    if (!characterUuid || characterUuid !== user.uuid) {
      throw new Error('无效的角色标识');
    }
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('无效的词条 ID');
    }
    if (version != null && (!Number.isInteger(version) || version < 0)) {
      throw new Error('无效的版本号');
    }

  // 冷却：用户维度，限制重抽频率
    const cdKey = `cd:char-affix:reroll:${user.uuid}`;
    // @ts-ignore
    const ok = await redisClient.set(cdKey, '1', { NX: true, EX: CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS });
    if (ok !== 'OK') {
      throw new Error(`重抽过于频繁，请稍后再试（${CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS}秒冷却）`);
    }

    const res = await rerollCharacterAffix({
      userUuid: user.uuid,
      characterUuid,
      id,
      expectedVersion: typeof version === 'number' ? version : undefined,
    });
    // 重抽会改变数值，刷新并推送角色属性
    const latestStatus = await updateCharacterStatusInfo(characterUuid);
    dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:reroll:success", { current: res.current });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:reroll:error", { message: err?.message || String(err) });
  }
}
