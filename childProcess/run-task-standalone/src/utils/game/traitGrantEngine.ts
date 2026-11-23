import type { Kitty } from "~/shared/types/kitty";
import { withUniqueLock } from "../index";
import { grantTraitOrAddExp } from "./kittyTraits";
import { allKittyTraitGrantTemplates } from "~/shared/data/allKittyEssayContent";
import { addKittyEssay } from "./kittyEssay";
import { getKitty } from "./kitty";

/**
 * 单次要发放的特性设定
 * traitId: 特性 id
 * chance: 触发概率（0-1），默认 1
 * target: 发放对象：actor / target / both
 * addExp: 若提供则为给已有特性增加经验
 * initialLevel: 创建时的初始等级（默认 1）
 */
type Grant = {
  traitId: string;
  chance?: number;
  target?: 'actor' | 'target' | 'both';
  addExp?: number;
  initialLevel?: number;
};

/**
 * 一个模板对象，包含要写入的随记 content（可选）和多个 traitGrant 项
 */
type TraitGrantTemplate = {
  content?: string;
  traitGrants: Grant[];
};

/**
 * 发放结果的记录，用于在随记中汇总展示
 */
type GrantResult = {
  traitId: string;
  kind: 'created' | 'addExp' | 'alreadyExists' | 'failed';
  initialLevel?: number;
  addExp?: number;
};

/**
 * 将单个 grant 应用到指定 kittyUuid（被锁保护）
 * 返回本次应用的 GrantResult，若传入 uuid 无效则返回 null
 */
async function grantToKittyUuid(kittyUuid: string | undefined | null, grant: Grant): Promise<GrantResult | null> {
  if (!kittyUuid) return null;
  const traitId = grant.traitId;
  const expToAdd = typeof grant.addExp === 'number' && grant.addExp > 0 ? grant.addExp : 1;
  const initialLevel = grant.initialLevel ?? 1;
  return await withUniqueLock(`kitty:traits:grant:${kittyUuid}`, async () => {
    try {
      const res = await grantTraitOrAddExp(kittyUuid, traitId, {
        initialLevel,
        expOnExist: expToAdd,
      });
      if (res.kind === 'created') {
        return { traitId, kind: 'created', initialLevel } as GrantResult;
      }
      return { traitId, kind: 'addExp', addExp: expToAdd } as GrantResult;
    } catch (err) {
      console.error('grantToKittyUuid error', err);
      return { traitId, kind: 'failed' } as GrantResult;
    }
  });
}

/**
 * 从可能的对象或字符串中解析出 uuid
 * 支持直接传入 uuid 字符串，或包含 uuid 字段的对象（如 Kitty）
 */
/**
 * 从 Kitty 对象或 uuid 字符串中解析出 uuid
 * 由于 we now require actor/target 为 Kitty（或 undefined），实现可更简单直接
 */
function resolveUuid(entity?: Kitty | string | null): string | undefined {
  if (!entity) return undefined;
  if (typeof entity === 'string') return entity;
  // Kitty 类型应包含 uuid 字段
  return (entity as Kitty).uuid ?? undefined;
}

/**
 * 根据传入的模板对象（或模板实例）尝试发放特性。
 * template: 一个 TraitGrantTemplate 对象或等同结构的对象
 * actor/target: 可以是 Kitty 对象或 uuid 字符串
 */
export async function maybeGrantFromTemplateObject(template?: TraitGrantTemplate | null, actor?: Kitty | null, target?: Kitty | null): Promise<void> {
  if (!template || typeof template !== 'object') return;
  const t = template as TraitGrantTemplate;
  const grants: Grant[] = t.traitGrants ?? [];

  // collect results per kitty UUID so we can write essays later
  const resultsByKitty = new Map<string, GrantResult[]>();

  for (const g of grants) {
    const chance = typeof g.chance === 'number' ? g.chance : 1;
    if (Math.random() > chance) continue;
    const trg = g.target ?? 'actor';
    if (trg === 'actor') {
      const uuid = actor?.uuid;
      const res = await grantToKittyUuid(uuid, g);
      if (res && uuid) {
        const arr = resultsByKitty.get(uuid) ?? [];
        arr.push(res);
        resultsByKitty.set(uuid, arr);
      }
    } else if (trg === 'target') {
      const uuid = target?.uuid;
      const res = await grantToKittyUuid(uuid, g);
      if (res && uuid) {
        const arr = resultsByKitty.get(uuid) ?? [];
        arr.push(res);
        resultsByKitty.set(uuid, arr);
      }
    } else if (trg === 'both') {
      const uuidA = actor?.uuid;
      const uuidB = target?.uuid;
      const resA = await grantToKittyUuid(uuidA, g);
      if (resA && uuidA) {
        const arr = resultsByKitty.get(uuidA) ?? [];
        arr.push(resA);
        resultsByKitty.set(uuidA, arr);
      }
      const resB = await grantToKittyUuid(uuidB, g);
      if (resB && uuidB) {
        const arr = resultsByKitty.get(uuidB) ?? [];
        arr.push(resB);
        resultsByKitty.set(uuidB, arr);
      }
    }
  }

  // For each kitty that got grants, write an essay entry recording what was granted
  for (const [kittyUuid, grantsApplied] of resultsByKitty.entries()) {
    try {
      // 尝试解析出完整的 Kitty 对象用于写随记：优先使用传入的 actor/target 对象，否则从 DB 中拉取
      let kittyObj: Kitty | null | undefined = undefined;
      if (resolveUuid(actor) === kittyUuid && typeof actor === 'object') kittyObj = actor as Kitty;
      if (!kittyObj && resolveUuid(target) === kittyUuid && typeof target === 'object') kittyObj = target as Kitty;
      if (!kittyObj) {
        kittyObj = await getKitty(kittyUuid);
      }
      if (!kittyObj) continue;

      const essayContent = t.content ?? '获得新的特性';
      const extra = { traitGrants: grantsApplied };
      await addKittyEssay(kittyObj, essayContent, {
        action: 'trait_grant',
        extra: JSON.stringify(extra),
      });
    } catch (e) {
      console.error('maybeGrantFromTemplateObject: failed to write essay for', kittyUuid, e);
    }
  }
}

/**
 * 根据主类型（例如 'fishing' / 'encounter' 等）随机选取一个模板并尝试发放
 */
export async function maybeGrantForMainType(mainType: string, actor: Kitty, target?: Kitty | null): Promise<void> {
  const list = (allKittyTraitGrantTemplates as Record<string, TraitGrantTemplate[]>)[mainType];
  if (!list || !list.length) return;
  const picked = list[Math.floor(Math.random() * list.length)];
  if (!picked) return;
  await maybeGrantFromTemplateObject(picked, actor, target);
}

export default {
  maybeGrantFromTemplateObject,
  maybeGrantForMainType,
};
