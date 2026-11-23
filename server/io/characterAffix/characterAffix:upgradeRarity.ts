// 稀有度升级（当前稀有度 -> 下一稀有度）
// 校验点：
// - 角色归属（只能操作自己的角色）
// - id 必须为正整数
// - 可选 version 必须为非负整数（用于乐观锁）
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { upgradeCharacterAffixRarity } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";

// 和重随一致共享冷却，或可独立设置
import { CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS } from "~/shared/data/characterAffixConstants";

const COOLDOWN_KEY_PREFIX = 'cd:char-affix:upgrade-rarity:'

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
      throw new Error(`操作过于频繁，请稍后再试（${CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS}秒冷却）`);
    }

    const res = await upgradeCharacterAffixRarity({
      userUuid: user.uuid,
      characterUuid,
      id,
      expectedVersion: typeof version === 'number' ? version : undefined,
    });

    const latestStatus = await updateCharacterStatusInfo(characterUuid);
    dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:upgradeRarity:success", { current: res.current });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:upgradeRarity:error", { message: err?.message || String(err) });
  }
}
