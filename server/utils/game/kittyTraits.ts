import { prisma } from "~/server/utils/game/db";
import { REMOVE_KITTY_TRAIT_RESOURCE_REQUIREMENT } from "~/shared/data/constant";
import allKittyTraits from "~/shared/data/kittyTraits";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { KittyTraitRow } from "~/shared/types/kitty";
import { PrismaTx } from "~/shared/types/socket/db";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";

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

  const kitty = await tx.kitty.findUnique({ where: { uuid: kittyUuid }, select: { name: true, owner: true } });

  if (!kitty?.owner) {
    throw new Error("找不到猫咪主人，无法移除特性");
  }

  const requireResource = REMOVE_KITTY_TRAIT_RESOURCE_REQUIREMENT;
  const ResourceRequirement = convertItemCountInfoToResourceRequirement(requireResource);
  const hasEnough = await checkResourceRequirementInDB(kitty.owner, ResourceRequirement, tx);

  if (!hasEnough) {
    throw new Error("资源不足，无法移除特性");
  }

  await decreaseItemCount(kitty?.owner, requireResource, {
    actionName: `移除猫咪助手“${kitty?.name}”特性 ${allKittyTraits[traitId]?.name || traitId}`,
    type: ModifyItemCountType.Kitty,
    sendModifyEvent: true,
    showModifyInfo: true,
  }, tx);
  await invalidateInventoryCache(kitty.owner);

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

export default {
  getKittyTraits,
  addTraitToKitty,
  removeTraitFromKitty,
  addTraitExp,
}
