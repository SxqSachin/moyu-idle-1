import allKittyTraits from "~/shared/data/kittyTraits";
import { prisma } from "../prisma";
import { toKitty } from "./kitty";
import { getKittyTraits } from "./kittyTraits";
import { addKittyEssay } from "./kittyEssay";
import type { PrismaTx } from "~/shared/types/socket/db";
import { KITTY_MAX_MOOD } from "~/shared/data/constant";

/**
 * Kitty mood helpers used inside child-process services.
 *
 * 提供获取、设置与增减猫咪心情值的原子方法。内部使用 Prisma 更新数据库，
 * 并返回最新的 Kitty 对象 (toKitty 转换)。
 *
 * 所有修改都会被限制在 [0, maxMood] 的范围内。
 */

export const getKittyMood = async (kittyUuid: string, tx?: PrismaTx): Promise<{ mood: number; maxMood: number } | null> => {
  if (!tx) tx = prisma;
  const k = await tx.kitty.findUnique({ where: { uuid: kittyUuid }, select: { mood: true, max_mood: true } });
  if (!k) return null;
  return { mood: k.mood, maxMood: k.max_mood };
};

/**
 * 将猫咪的心情值设置为指定值（会被限制到 0..maxMood）。
 * 返回更新后的 Kitty（toKitty 转换）。
 */
export const setKittyMood = async (kittyUuid: string, mood: number, tx?: PrismaTx) => {
  if (!tx) tx = prisma;
  // 读取当前 maxMood
  const k = await tx.kitty.findUnique({ where: { uuid: kittyUuid }, select: { max_mood: true } });
  if (!k) throw new Error('kitty not found');
  const clamped = Math.max(0, Math.min(mood, k.max_mood));
  const updated = await tx.kitty.update({ where: { uuid: kittyUuid }, data: { mood: clamped } });
  return toKitty(updated);
};

/**
 * 给猫咪增加（或减少）心情值，delta 可以为正或负。会在数据库中原子化更新并返回更新后的 Kitty。
 */
export const modifyKittyMood = async (kittyUuid: string, delta: number, reason: string, opt?: {
  allowExceedMaxMood?: boolean, // 是否可以突破上限
  tx?: PrismaTx
}) => {
  const tx = opt?.tx ?? prisma;
  // 使用事务式更新以避免竞态：先读后写
  const kitty = await tx.kitty.findUnique({ where: { uuid: kittyUuid } });
  if (!kitty) throw new Error('kitty not found');

  const kittyTrait = await getKittyTraits(kittyUuid, tx);

  for (const trait of kittyTrait) {
    const traitDef = allKittyTraits[trait.traitId];

    if (traitDef.onModifyMood) {
      const result = traitDef.onModifyMood({
        old: kitty.mood,
        delta,
        kittyUuid,
        kittyName: kitty.name,
        owner: kitty.owner,
        traitLevel: trait.level,
      });
      if (result && typeof result.extraDelta === 'number') {
        delta += result.extraDelta;
      }
    }
  }

  // 需要回复心情，但是不允许超过上限，则进行限制
  if (delta > 0 && !opt?.allowExceedMaxMood && kitty.mood + delta > kitty.max_mood) {
    delta = kitty.max_mood - kitty.mood;

    if (delta <= 0) {
      delta = 0
    }
  }

  if (delta == 0) {
    return toKitty(kitty);
  }

  const newMood = Math.max(0, Math.min(kitty.mood + delta, KITTY_MAX_MOOD));
  const updated = await tx.kitty.update({ where: { uuid: kittyUuid }, data: { mood: newMood } });

  const actionStr = delta >= 0 ? `增加 ${delta} 点心情值` : `减少 ${-delta} 点心情值`;
  await addKittyEssay(toKitty(kitty), `因为${reason}, ${actionStr}`, {
    action: 'kittyMoodModify',
  });

  return toKitty(updated);
}

export const modifyKittyMaxMood = async (kittyUuid: string, delta: number, reason: string, tx?: PrismaTx) => {
  if (!tx) tx = prisma;
  // 使用事务式更新以避免竞态：先读后写
  const kitty = await tx.kitty.findUnique({ where: { uuid: kittyUuid } });
  if (!kitty) throw new Error('kitty not found');

  const newMaxMood = Math.max(0, Math.min(kitty.max_mood + delta, KITTY_MAX_MOOD));
  const updated = await tx.kitty.update({ where: { uuid: kittyUuid }, data: { max_mood: newMaxMood } });

  const actionStr = delta >= 0 ? `增加 ${delta} 点最大心情值` : `减少 ${-delta} 点最大心情值`;
  await addKittyEssay(toKitty(kitty), `因为${reason}, ${actionStr}`, {
    action: 'kittyMoodModify',
  });

  return toKitty(updated);
}