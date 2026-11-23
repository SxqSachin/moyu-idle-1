// 从词条池抽取（roll）若干条并落库
// 校验点：
// - 仅允许操作自己的角色
// - poolId 必须在白名单内（已注册的池）
// - count 若提供：必须是 0~10 的整数
// - 触发用户冷却，限制频率
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { rollCharacterAffixes } from "~/server/utils/game/affix";
import { updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";
import { allAffixPools } from "~/shared/data/affix/pools";
import { CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS } from "~/shared/data/characterAffixConstants";
import { ObjectKeysTyped } from "~/shared/utils";

type Payload = {
  characterUuid: string
  poolId?: string
  count?: number
  seed?: string
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

    // 检查玩家总等级是否超过200
    const characterStatus = await getCharacterStatusInfo(characterUuid);
    let level = 0;
    ObjectKeysTyped(characterStatus).forEach((key) => {
      let thisLevel = Number(characterStatus[key].level || 0);

      if (key !== 'trading') {
        level += thisLevel;
      }
    })
    if (level < 200) {
      throw new Error('角色总等级未达到200级，无法获取祝福');
    }

  // 冷却：3秒最多1次（Redis 实现，用户维度）
    const cdKey = `cd:char-affix:roll:${user.uuid}`;
    // @ts-ignore
    const ok = await redisClient.set(cdKey, '1', { NX: true, EX: CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS });
    if (ok !== 'OK') {
      throw new Error(`获取过于频繁，请稍后再试（${CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS}秒冷却）`);
    }

    const poolId = (payload?.poolId || 'default_character_pool').trim();
    const allowPool = new Set(allAffixPools.map(p => p.poolId));
    if (!allowPool.has(poolId)) {
      throw new Error('无效的词条池');
    }

    const count = payload?.count;
    if (count != null) {
      if (!Number.isInteger(count) || count < 0 || count > 10) {
        throw new Error('无效的数量');
      }
    }

    const { created } = await rollCharacterAffixes({
      userUuid: user.uuid,
      characterUuid,
      poolId,
      countOverride: count,
      seed: payload?.seed ? String(payload.seed).slice(0, 64) : undefined,
      source: 'ADD',
    });
    // 词条变化后，刷新并推送角色属性
    const latestStatus = await updateCharacterStatusInfo(characterUuid);
    dispatchCharacterStatusInfo(characterUuid, latestStatus);
    emitEventToUser(user, "characterAffix:roll:success", { created });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:roll:error", { message: err?.message || String(err) });
  }
}
