// 进阶重随（仅向上重掷区间数值）
// 校验点：
// - 角色归属（只能操作自己的角色）
// - id 必须为正整数
// - 可选 version 必须为非负整数（用于乐观锁）
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { rerollCharacterAffixProgressive } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";
import { CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS } from "~/shared/data/characterAffixConstants";

// 与普通重抽分开冷却键，避免互相影响
const COOLDOWN_KEY_PREFIX = 'cd:char-affix:reroll-up:'

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

    const cdKey = `${COOLDOWN_KEY_PREFIX}${user.uuid}`;
    // @ts-ignore
    const ok = await redisClient.set(cdKey, '1', { NX: true, EX: CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS });
    if (ok !== 'OK') {
      throw new Error(`进阶重随过于频繁，请稍后再试（${CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS}秒冷却）`);
    }

    const res = await rerollCharacterAffixProgressive({
      userUuid: user.uuid,
      characterUuid,
      id,
      expectedVersion: typeof version === 'number' ? version : undefined,
    });

    // 数值变动，刷新并推送角色属性
    const latestStatus = await updateCharacterStatusInfo(characterUuid);
    dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:rerollUp:success", { current: res.current });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:rerollUp:error", { message: err?.message || String(err) });
  }
}
