import { prisma } from "../prisma"
import allKittyTraits from "~/shared/data/kittyTraits";
import type { KittyTraitRow } from "~/shared/types/kitty";
import type { PrismaTx } from "~/shared/types/socket/db";

export const getKittyTraits = async (kittyUuid: string, tx?: PrismaTx): Promise<KittyTraitRow[]> => {
  if (!tx) {
    tx = prisma;
  }
  const rows = await tx.kittyTrait.findMany({ where: { kittyUuid } });
  return rows.map(r => ({
    id: r.id,
    uuid: r.uuid,
    kittyUuid: r.kittyUuid,
    traitId: r.traitId,
    level: r.level,
    currentExp: r.currentExp,
  }));
}

export const addTraitToKitty = async (kittyUuid: string, traitId: string, initialLevel = 1, tx?: PrismaTx) => {
  if (!tx) {
    tx = prisma;
  }
  const exist = await tx.kittyTrait.findFirst({ where: { kittyUuid, traitId } });
  if (exist) throw new Error("Trait already exists on this kitty");

  const row = await tx.kittyTrait.create({ data: { kittyUuid, traitId, level: initialLevel, currentExp: 0 } });
  return {
    id: row.id,
    uuid: row.uuid,
    kittyUuid: row.kittyUuid,
    traitId: row.traitId,
    level: row.level,
    currentExp: row.currentExp,
  } as KittyTraitRow;
}

export const removeTraitFromKitty = async (kittyUuid: string, traitId: string, tx?: PrismaTx) => {
  if (!tx) {
    tx = prisma;
  }
  const exist = await tx.kittyTrait.findFirst({ where: { kittyUuid, traitId } });
  if (!exist) throw new Error("Trait not found on this kitty");
  await tx.kittyTrait.delete({ where: { id: exist.id } });
  return true;
}

/**
 * Add exp to kitty's trait and check level up. Returns updated row and an array of leveled up info.
 */
export const addTraitExp = async (
  kittyUuid: string,
  traitId: string,
  addExp: number,
  tx?: PrismaTx
) => {
  if (addExp <= 0) throw new Error("addExp must be positive");

  if (!tx) {
    tx = prisma;
  }

  let row = await tx.kittyTrait.findFirst({ where: { kittyUuid, traitId } });
  if (!row) {
    // create a new trait instance with the added exp
    const created = await tx.kittyTrait.create({
      data: { kittyUuid, traitId, level: 0, currentExp: addExp },
    });
    row = created;
  } else {
    // increment
    row = await tx.kittyTrait.update({
      where: { id: row.id },
      data: { currentExp: { increment: addExp } },
    });
  }

  const def = allKittyTraits[row.traitId];
  const leveled: { fromLevel: number; toLevel: number }[] = [];

  if (def && def.upgradeExp) {
    let { level, currentExp } = row;
    // loop to support multi-level up
    while (true) {
      const need = def.upgradeExp(level);
      if (need <= 0) break;
      if (currentExp >= need) {
        currentExp -= need;
        level += 1;
        leveled.push({ fromLevel: level - 1, toLevel: level });
      } else break;
    }

    if (leveled.length) {
      // write back
      row = await tx.kittyTrait.update({
        where: { id: row.id },
        data: { level, currentExp },
      });
    } else {
      // update currentExp only already done above - re-read the row to get fresh timestamps/fields
      const fresh = await tx.kittyTrait.findUnique({ where: { id: row.id } });
      if (!fresh)
        throw new Error("Internal error: kitty trait row disappeared");
      row = fresh;
    }
  }

  return {
    row: {
      id: row.id,
      uuid: row.uuid,
      kittyUuid: row.kittyUuid,
      traitId: row.traitId,
      level: row.level,
      currentExp: row.currentExp,
    } as KittyTraitRow,
    leveled,
  };
};

/**
 * Idempotent grant helper: if kitty缺少该特性则创建；若已存在则仅增加经验（默认1）。
 */
export const grantTraitOrAddExp = async (
  kittyUuid: string,
  traitId: string,
  opt?: { initialLevel?: number; expOnExist?: number; tx?: PrismaTx }
) => {
  const tx = opt?.tx ?? prisma;
  const initialLevel = opt?.initialLevel ?? 1;
  const expOnExist = opt?.expOnExist ?? 1;

  const existing = await tx.kittyTrait.findFirst({ where: { kittyUuid, traitId } });
  if (!existing) {
    const created = await addTraitToKitty(kittyUuid, traitId, initialLevel, tx);
    return { kind: 'created' as const, row: created, addedExp: 0 };
  }

  const { row } = await addTraitExp(kittyUuid, traitId, expOnExist, tx);
  return { kind: 'addExp' as const, row, addedExp: expOnExist };
};

export default {
  getKittyTraits,
  addTraitToKitty,
  removeTraitFromKitty,
  addTraitExp,
  grantTraitOrAddExp,
}
