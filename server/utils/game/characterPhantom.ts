import { v7 as uuidv7 } from "uuid";
import { prisma } from "./db";
import {
  type CharacterPhantomListingCreateInput,
  type CharacterPhantomListingDTO,
  type CharacterPhantomBorrowCreateInput,
  type CharacterPhantomBorrowDTO,
  type ListingQueryOptions,
  CharacterPhantomListingState,
  CharacterPhantomBorrowState,
} from "~/shared/types/characterPhantom";
import { isUserInGuild } from "./guild";
import { CharacterPhantomBorrow, CharacterPhantomListing } from "~/generated/prisma";
import { safeJsonParse, sanitizeInput } from "~/shared/utils";
import { BaseBattleUnit } from "~/shared/types/unit";
import { convertItemCountInfoToDecrease, convertItemCountInfoToResourceRequirement, convertReseourceRequirementToItemModify } from "~/shared/utils/game/requirementCheck";
import { MEOW_SPIRIT_MIRROR_SAVE_COST } from "~/shared/data/constant";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import characterUpdateBattleUseItemLogic from "~/server/io/battleInventory/character:updateBattleUseItemLogic";
// ...existing code...

/**
 * 将 prisma 的 CharacterPhantomListing 行转换为 DTO
 */
function normalizeListingState(s: any): CharacterPhantomListingState {
  if (typeof s === "string" && (Object.values(CharacterPhantomListingState) as string[]).includes(s)) {
    return s as CharacterPhantomListingState;
  }
  return CharacterPhantomListingState.OPEN;
}

/** 将任意值规范化为 CharacterPhantomBorrowState */
function normalizeBorrowState(s: any): CharacterPhantomBorrowState {
  if (typeof s === "string" && (Object.values(CharacterPhantomBorrowState) as string[]).includes(s)) {
    return s as CharacterPhantomBorrowState;
  }
  return CharacterPhantomBorrowState.ACTIVE;
}
function mapListingRowToDTO(row: CharacterPhantomListing): CharacterPhantomListingDTO {
  return {
    id: row.id,
    uuid: row.uuid,
    owner: row.owner,
    guildUuid: row.guildUuid ?? null,
    characterUuid: row.characterUuid,
    snapshot: safeJsonParse<BaseBattleUnit>(row.snapshot),
    note: row.note ?? "",
    isPublic: Boolean(row.isPublic),
    state: normalizeListingState(row.state),
    usageCount: row.usageCount ?? 0,
    extra: row.extra ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/**
 * 将 prisma 的 CharacterPhantomBorrow 行转换为 DTO
 */
function mapBorrowRowToDTO(row: CharacterPhantomBorrow): CharacterPhantomBorrowDTO {
  return {
    id: row.id,
    uuid: row.uuid,
    listingUuid: row.listingUuid,
    borrower: row.borrower,
    phantomOwner: row.phantomOwner,
    characterUuid: row.characterUuid,
    snapshot: safeJsonParse<BaseBattleUnit>(row.snapshot),
    startAt: row.startAt,
    scheduledEnd: row.scheduledEnd ?? null,
    returnedAt: row.returnedAt ?? null,
    state: normalizeBorrowState(row.state),
    extra: row.extra ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ...existing code...

/**
 * 创建上架条目（listing）
 */
export async function createCharacterPhantomListing({characterUuid, owner, guildUuid, note}: CharacterPhantomListingCreateInput): Promise<CharacterPhantomListingDTO> {
  if (!guildUuid) {
    throw new Error("需要公会信息");
  }

  let guildMember = await isUserInGuild(owner, guildUuid);
  if (!guildMember) {
    throw new Error("用户不是公会成员");
  }

  let characterBaseBattleUnit = await convertCharacterToUnit(characterUuid);

  if (!characterBaseBattleUnit) {
    throw new Error('幻象信息处理失败，请稍后重试');
  }

  characterBaseBattleUnit.inventory = {};
  characterBaseBattleUnit.fp = undefined;
  characterBaseBattleUnit.ip = undefined;
  characterBaseBattleUnit.stateWhenStartEachBattle = undefined;
  characterBaseBattleUnit.stateWhenStartFirstBattle = undefined;

  characterBaseBattleUnit.state = {
    denseFogPhantom: {
      id: 'denseFogPhantom',
      addBy: '',
      triggered: false,
      duration: 9999,
      remainingDuration: 9999,
    }
  }

  return prisma.$transaction(async (tx) => {
    note = sanitizeInput(note ?? "");

    const resourceRequirement = convertItemCountInfoToResourceRequirement(MEOW_SPIRIT_MIRROR_SAVE_COST)
    let hasEnoughResource = await checkResourceRequirementInDB(characterUuid, resourceRequirement, tx);

    if (!hasEnoughResource) {
      throw new Error("资源不足");
    }

    await decreaseItemCount(characterUuid, MEOW_SPIRIT_MIRROR_SAVE_COST, {
      showModifyInfo: true,
      actionName: '使用"喵灵之镜"记录镜像',
      type: ModifyItemCountType.Guild,
      sendModifyEvent: true
    }, tx)
    await invalidateInventoryCache(characterUuid);

    const uuid = uuidv7();
    const rec = await tx.characterPhantomListing.create({
      data: {
        uuid,
        owner: owner,
        guildUuid: guildUuid,
        characterUuid: characterUuid,

        snapshot: JSON.stringify(characterBaseBattleUnit),
        note: note ?? "",

        isPublic: true,

        state: CharacterPhantomListingState.OPEN,
        usageCount: 0,
        extra: "",
      },
    });
    return mapListingRowToDTO(rec);
  });
}

/**
 * 根据 uuid 读取 listing
 */
export async function getListingPhantomByUuid(uuid: string): Promise<CharacterPhantomListingDTO | null> {
  const rec = await prisma.characterPhantomListing.findUnique({
    where: { uuid },
  });
  if (!rec) return null;
  return mapListingRowToDTO(rec);
}

export async function getPhantomList(uuidList: string[]): Promise<CharacterPhantomListingDTO[]> {
  const recs = await prisma.characterPhantomListing.findMany({
    where: {
      uuid: {
        in: uuidList
      }
    }
  });
  return recs.map(mapListingRowToDTO);
}

/**
 * 列表查询
 */
export async function listCharacterPhantomListings(q: ListingQueryOptions = {}) {
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const offset = Math.max(0, q.offset ?? 0);

  const list = await prisma.characterPhantomListing.findMany({
    where: {
      state: CharacterPhantomListingState.OPEN,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });

  return list.map(mapListingRowToDTO) as CharacterPhantomListingDTO[];
}

/**
 * 创建借用记录（租借）
 * 事务内操作：检查 listing 状态 -> 创建借用记录 -> 更新 listing.usageCount
 */
export async function createCharacterPhantomBorrow(borrower: string, input: CharacterPhantomBorrowCreateInput): Promise<CharacterPhantomBorrowDTO> {
  const phantom = await getListingPhantomByUuid(input.phantomUuid);
  if (!phantom ) throw new Error("幻影不存在");
  if (phantom.state !== CharacterPhantomListingState.OPEN) throw new Error("此幻影不可借用");

  if (phantom.guildUuid != input.guildUuid) {
    throw new Error("公会信息不匹配");
  }

  return await prisma.$transaction(async (tx) => {
    let hasExistBorrowedPhantom = await tx.characterPhantomBorrow.findFirst({
      where: {
        borrower,
        state: CharacterPhantomBorrowState.ACTIVE,
      },
    });

    if (hasExistBorrowedPhantom) {
      throw new Error("你已经借用了一个幻影，请先归还后再借用");
    }

    const borrowUuid = uuidv7();
    const snapshot = phantom.snapshot;

    const borrow = await tx.characterPhantomBorrow.create({
      data: {
        uuid: borrowUuid,
        listingUuid: phantom.uuid,
        borrower: borrower,
        phantomOwner: phantom.owner,
        characterUuid: phantom.characterUuid,
        snapshot: JSON.stringify(snapshot),
        startAt: new Date(),
        state: CharacterPhantomBorrowState.ACTIVE,
        extra: "",
      },
    });

    await tx.characterPhantomListing.update({
      where: { uuid: phantom.uuid },
      data: {
        usageCount: {
          increment: 1
        }
      },
    });

    return mapBorrowRowToDTO(borrow);
  });
}

/**
 * 归还借用（标记 returned）
 */
export async function returnCharacterPhantomBorrow(borrowUuid: string, returnedBy: string) {
  const now = new Date();
  const borrow = await prisma.characterPhantomBorrow.findUnique({ where: { uuid: borrowUuid } });
  if (!borrow) throw new Error("借用记录不存在");
  if (borrow.state !== "ACTIVE") throw new Error("借用未激活");

  if (borrow.borrower != returnedBy) {
    throw new Error("无权归还此借用");
  }

  // 简单更新状态；若需要额外逻辑（押金返还、惩罚、归还验证），在此扩展
  const updated = await prisma.characterPhantomBorrow.update({
    where: { uuid: borrowUuid },
    data: {
      state: "RETURNED",
      returnedAt: now,
      updatedAt: now,
    },
  });

  return mapBorrowRowToDTO(updated);
}

/**
 * 下架 / 取消 listing（仅 owner 可操作）
 */
export async function cancelCharacterPhantomListing(listingUuid: string, byUserUuid: string) {
  const listing = await prisma.characterPhantomListing.findUnique({ where: { uuid: listingUuid } });
  if (!listing) throw new Error("借用记录不存在");
  if (listing.owner !== byUserUuid) throw new Error("无权操作");

  const updated = await prisma.characterPhantomListing.update({
    where: { uuid: listingUuid },
    data: {
      state: "REMOVED",
      updatedAt: new Date(),
    },
  });

  // 同时处理相关的借用记录
  await prisma.characterPhantomBorrow.updateMany({
    where: { listingUuid: listingUuid },
    data: { state: "CANCELLED" },
  });

  return mapListingRowToDTO(updated);
}

/**
 * 轻量查询 borrow 记录
 */
export async function getBorrowByUuid(uuid: string) {
  const b = await prisma.characterPhantomBorrow.findUnique({ where: { uuid } });
  if (!b) return null;
  return mapBorrowRowToDTO(b);
}

export async function getBorrowByUuidList(borrowPhantomUuidList: string[]) {
  const b = await prisma.characterPhantomBorrow.findMany({
    where: { uuid: { in: borrowPhantomUuidList }, state: CharacterPhantomBorrowState.ACTIVE },
  });
  if (!b) return [];
  return b.map(mapBorrowRowToDTO);
}

export async function getBorrowByBorrower(borrower: string) {
  const b = await prisma.characterPhantomBorrow.findMany({
    where: { borrower, state: CharacterPhantomBorrowState.ACTIVE },
  });
  if (!b) return [];
  return b.map(mapBorrowRowToDTO);
}

// ...existing code...