import { prisma } from "./db";
import { redisClient } from "~/server/utils";
import type { RedisClientType } from "redis";
import { withUniqueLock } from "~/server/utils/lock";
import {
  ItemCountInfo,
  ModifyItemCountType,
} from "~/shared/types/gameInventory";
import {
  decreaseItemCount,
  increaseItemCount,
  getItemInfo,
  getItemCount,
  checkResourceRequirementInDB,
} from "./characterInventory";
import { HarvestBoxSource, PlayerShopItem, type Prisma } from "~/generated/prisma";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import {
  AddItemToShopPayload,
  BuyFromShopPayload,
  CreatePlayerShopPayload,
  GetMyShopsQuery,
  GetShopDetailQuery,
  GetPublicShopsQuery,
  GetPublicShopsResult,
  PlayerShopDTO,
  PlayerShopItemDTO,
  RenewPlayerShopPayload,
  RemoveItemFromShopPayload,
  UpdatePlayerShopPayload,
  UpdatePlayerShopItemPayload,
  PlayerShopVisibility,
  PlayerShopState,
  PlayerShopItemState,
  PlayerShopPurchaseDTO,
  GetShopPurchaseListQuery,
  GetShopPurchaseListResult,
} from "~/shared/types/playerShop";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";
import { allGameResource } from "~/shared/data/allGameResources";
import { BASE_MAX_PLAYER_SHOP_ITEM_SLOT, CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT, PLAYER_SHOP_FEE, PLAYER_SHOP_PIN_COST, SPECIAL_ITEM_20251202 } from "~/shared/data/constant";

// Redis zset for global pinned shops. member = shopUuid, score = expiry timestamp (ms)
const PLAYER_SHOP_PIN_ZSET = "playerShop:pinned";
const PIN_DURATION_MS = 24 * 3600 * 1000; // 24 hours
export const MAX_GLOBAL_PINS = 6;

// typed redis client (避免使用 any，尽量在编译期暴露错误)
const r = redisClient

/*
  本文件使用到的 Redis 方法（及用途说明，中文注释）：

  - r.zRemRangeByScore(key, min, max)
    用途：从有序集合中按照 score（这里存的是 expiresAt 毫秒时间戳）范围删除元素。
    场景：清理过期的置顶项（score <= now）时使用，能一次性删除多个过期成员。

  - r.zRangeByScore(key, min, max)
    用途：按 score 范围读取成员（返回成员数组）。
    场景：作为旧版客户端兼容的回退读取方式，用于找出需要删除的过期成员。

  - r.zRange(key, start, stop, { REV: true })
    用途：按索引区间读取有序集合成员；配合 REV 可以实现按 score 倒序（最近置顶优先）。
    场景：获取当前已置顶的 shopUuid 列表（只需要 member，不需要 score）。

  - r.zRangeWithScores(key, start, stop, { REV: true })
    用途：同时返回成员和值（score），score 可用于表示到期时间（expiresAt）。
    场景：返回带 expiresAt 的置顶条目供前端展示剩余时间。

  - r.zScore(key, member)
    用途：查询指定 member 的 score（若不存在返回 null/undefined）。
    场景：判断某个 shop 是否处于置顶状态（score > now 表示仍未过期）。

  - r.exists(key)
    用途：判断一个 key 是否存在（通常返回 0/1）。
    场景：检查玩家的置顶冷却 key 是否存在，决定是否处于冷却期。

  - r.zCard(key)
    用途：获取有序集合中成员总数（cardinality）。
    场景：计算当前全局置顶数量，用于判断是否达到最大置顶上限。

  - r.zAdd(key, { score, value })
    用途：向有序集合添加或更新 member（带 score）。
    场景：将 shopUuid 与到期时间写入置顶集合，表示该店铺被置顶直到 expiresAt。

  - r.zRem(key, member)
    用途：从有序集合中移除指定 member。
    场景：取消置顶时移除对应的 shopUuid。

  - r.set(key, value, { EX: seconds })
    用途：设置普通字符串 key，并可通过 EX 指定过期时间（秒）。
    场景：为玩家设置置顶冷却键（记录上次置顶时间并设置 TTL），用于防止短期重复置顶。

  另外本文件局部使用了 `redisClient` 的以下方法（用于限购计数器）：
  - redisClient.get(key)        => 读取字符串值（返回 string | null）。
  - redisClient.incrBy(key, n)  => 对整数值进行原子自增并返回新值。
  - redisClient.expire(key, s)  => 为 key 设置过期时间（秒）。
  - redisClient.ttl(key)        => 获取 key 的剩余生存时间（秒，可能为 -1/-2 表示无过期或不存在）。

  上述方法在并发/一致性场景下各有侧重点：
  - zset 系列（zAdd/zRem/zRangeWithScores/zCard）用于维护全局有序置顶集合（score = expiresAt）。
  - set + EX 用于为每个玩家维护冷却状态（简单、低开销）。
  - incrBy/expire 用于实现周期性限购计数（以 key+ttl 的方式保存当期计数器）。

  注意：当前实现依赖应用层锁 + Redis 操作组合来保证一致性；在高并发场景下，建议将“检查数量 + 写入 zset”逻辑迁移到 Redis Lua 脚本实现原子操作，进一步避免超额置顶的竞态。
*/

async function cleanupExpiredPins() {
  const now = Date.now();
  // remove by score <= now
  // 使用 zRemRangeByScore 按 score 范围删除过期成员（高效，一次性删除）
  if (r.zRemRangeByScore) {
    // modern redis client
    await r.zRemRangeByScore(PLAYER_SHOP_PIN_ZSET, "-inf", now);
    return;
  }
  // fallback: get expired members then remove
  // 旧客户端回退：先用 zRangeByScore 找到过期 member，再调用 zRem 删除（分步操作）
  const expired: string[] = await r.zRangeByScore(PLAYER_SHOP_PIN_ZSET, "-inf", now);
  if (expired && expired.length) await r.zRem(PLAYER_SHOP_PIN_ZSET, expired);
  return;
}

export async function getPinnedShopUuids(): Promise<string[]> {
  await cleanupExpiredPins();
  // return members ordered by most-recently pinned first
  // 按索引范围读取 zset 成员；配合 { REV: true } 可以按 score 倒序（最近置顶优先）
  if (r.zRange) {
    const arr: string[] = await r.zRange(PLAYER_SHOP_PIN_ZSET, 0, -1, {
      REV: true,
    });
    return arr || [];
  }
  // fallback empty (or let client throw earlier)
  return [];
}

// Return pinned entries with their expiry scores (ms). Ordered by most-recently pinned first.
export async function getPinnedShopEntries(): Promise<{ shopUuid: string; expiresAt: number }[]> {
  await cleanupExpiredPins();
  // 使用 zRangeWithScores 同时获取 member 与 score（score 代表 expiresAt），便于前端展示剩余置顶时间
  const arr: Array<{ value: string; score: number }> = await r.zRangeWithScores(PLAYER_SHOP_PIN_ZSET, 0, -1, { REV: true });
  return arr.map(a => ({ shopUuid: a.value, expiresAt: Number(a.score) }));
}

export async function isShopPinned(shopUuid: string): Promise<boolean> {
  await cleanupExpiredPins();
  // zScore 用于查询指定 member 的 score（这里即 expiresAt），不存在则返回 null/undefined
  const score = r.zScore ? await r.zScore(PLAYER_SHOP_PIN_ZSET, shopUuid) : undefined;
  if (score === null || score === undefined) return false;
  return Number(score) > Date.now();
}
// Pin operation is paid. Use ownerUuid for charging and lock to avoid races.
export async function pinShop(
  ownerUuid: string,
  shopUuid: string
): Promise<number> {
  // serialize per-owner attempts to enforce cooldown reliably
  // 参数校验 — 在入口尽早失败以便上层可以捕获并定位问题
  if (!ownerUuid || typeof ownerUuid !== "string") throw new Error("无效的 ownerUuid 参数");
  if (!shopUuid || typeof shopUuid !== "string") throw new Error("无效的 shopUuid 参数");

  return await withUniqueLock(`playerShop:pin:${shopUuid}`, async () => {
    await cleanupExpiredPins();

    const cooldownKey = `playerShop:pinCooldown:${ownerUuid}`;
    // exists: 判断 key 是否存在，返回 0/1（部分客户端可能返回数值或布尔）。
    // 用途：检测玩家是否处于置顶冷却期（只要 key 存在就视为冷却中）。
    const existsRes = await r.exists(cooldownKey);
    const hasCooldown = Number(existsRes) > 0;
    if (hasCooldown) throw new Error("置顶店铺后48小时内无法再次置顶");

    // zCard: 获取 zset 的基数（成员数）。用途：检查当前全局置顶数量是否达到上限。
    const count = Number(await r.zCard(PLAYER_SHOP_PIN_ZSET));
    if (Number(count) >= MAX_GLOBAL_PINS)
      throw new Error("商业街目前无法容纳更多置顶商铺，请稍后再试");

    const hasEnoughResource = await checkResourceRequirementInDB(ownerUuid, convertItemCountInfoToResourceRequirement(PLAYER_SHOP_PIN_COST));

    if (!hasEnoughResource) {
      throw new Error("所需资源不足，无法置顶店铺");
    }

    // charge the user
    await decreaseItemCount(ownerUuid, PLAYER_SHOP_PIN_COST, {
      type: ModifyItemCountType.Other,
      actionName: "商铺置顶",
      sendModifyEvent: true,
      showModifyInfo: true,
    });
    await invalidateInventoryCache(ownerUuid);

    const expiresAt = Date.now() + PIN_DURATION_MS;
    try {
      // zAdd: 向 zset 添加/更新 member，并设置 score（这里使用 expiresAt 毫秒时间戳）
      // 用途：将 shopUuid 推入置顶集合，并记录到期时间，便于后续按时间排序与过期回收。
      await r.zAdd(PLAYER_SHOP_PIN_ZSET, {
        score: expiresAt,
        value: shopUuid,
      });
    } catch (e) {
      // refund on failure to persist pin
      try {
        await increaseItemCount(ownerUuid, PLAYER_SHOP_PIN_COST, {
          type: ModifyItemCountType.Other,
          actionName: "商铺置顶退款",
          sendModifyEvent: true,
          showModifyInfo: true,
        });
      } catch (refundErr) {
        // if refund fails, rethrow original error but annotate
        throw new Error(
          `置顶失败且退款失败: ${(e as Error).message}; 退款错误: ${
            (refundErr as Error).message
          }`
        );
      }
      throw e;
    }

    // set + EX: 设置玩家冷却 key，并通过 EX 指定秒级 TTL（用以阻止短时间内重复置顶）
    // 当前实现为 48 小时（可按需调整为 1 小时等）
    await r.set(cooldownKey, String(Date.now()), { EX: 60 * 60 * 48 });

    return expiresAt;
  });
}

export async function unpinShop(shopUuid: string) {
  // zRem: 从 zset 中移除指定 member（取消置顶操作）
  await r.zRem(PLAYER_SHOP_PIN_ZSET, shopUuid);
}
import { PrismaTx } from "~/shared/types/socket/db";
import { formatTime, sanitizeInput } from "~/shared/utils";
import { checkSensitiveWords } from "~/server/utils/checkSensitiveWords";
import { isIronCat } from "~/server/utils/game/account";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";

const DEFAULT_RENT_DAYS = 999;
const MIN_LIMIT_INTERVAL_DAYS = 1;
const MAX_LIMIT_INTERVAL_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

type PlayerShopItemMetadata = {
  comment?: string;
  perPlayerDailyLimit?: number;
  perPlayerLimitIntervalDays?: number;
};

function parseItemMetadata(raw: string | null): PlayerShopItemMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const meta: PlayerShopItemMetadata = {};
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.comment === "string" && parsed.comment.trim()) {
        meta.comment = parsed.comment.trim();
      }
      const limit = Number(parsed.perPlayerDailyLimit);
      if (Number.isFinite(limit) && limit > 0) {
        meta.perPlayerDailyLimit = Math.floor(limit);
        const interval = Number(parsed.perPlayerLimitIntervalDays);
        if (Number.isFinite(interval) && interval >= MIN_LIMIT_INTERVAL_DAYS && interval <= MAX_LIMIT_INTERVAL_DAYS) {
          meta.perPlayerLimitIntervalDays = Math.floor(interval);
        }
      }
    }
    return meta;
  } catch {
    return {};
  }
}

function serializeItemMetadata(meta: PlayerShopItemMetadata): string | null {
  const payload: PlayerShopItemMetadata = {};
  if (meta.comment && meta.comment.trim()) {
    payload.comment = meta.comment.trim();
  }
  if (meta.perPlayerDailyLimit && meta.perPlayerDailyLimit > 0) {
    payload.perPlayerDailyLimit = Math.floor(meta.perPlayerDailyLimit);
    const interval = meta.perPlayerLimitIntervalDays || MIN_LIMIT_INTERVAL_DAYS;
    payload.perPlayerLimitIntervalDays = Math.min(MAX_LIMIT_INTERVAL_DAYS, Math.max(MIN_LIMIT_INTERVAL_DAYS, Math.floor(interval)));
  }
  if (Object.keys(payload).length === 0) {
    return null;
  }
  return JSON.stringify(payload);
}

function normalizeLimitIntervalDays(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  const int = Math.floor(num);
  if (int < MIN_LIMIT_INTERVAL_DAYS || int > MAX_LIMIT_INTERVAL_DAYS) return undefined;
  return int;
}

function computeLimitWindow(now: Date, intervalDays: number): { keySuffix: string; ttlSec: number } {
  const interval = Math.min(MAX_LIMIT_INTERVAL_DAYS, Math.max(MIN_LIMIT_INTERVAL_DAYS, Math.floor(intervalDays)));
  const localDayStart = new Date(now);
  localDayStart.setHours(0, 0, 0, 0);
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  const offset = ((dayIndex % interval) + interval) % interval;
  const periodStart = new Date(localDayStart);
  periodStart.setDate(periodStart.getDate() - offset);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + interval);
  const ttlSec = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / 1000));
  const keySuffix = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, "0")}${String(periodStart.getDate()).padStart(2, "0")}_${interval}`;
  return { keySuffix, ttlSec };
}

// -----------------------
// Centralized shop checks
// -----------------------
function isShopOpen(shop: { state: PlayerShopState; expiresAt: Date }) {
  return shop.state === PlayerShopState.OPEN; // && shop.expiresAt > new Date();
}

function assertShopIsOpen(shop: { state: PlayerShopState; expiresAt: Date }) {
  if (!isShopOpen(shop)) {
    throw new Error("店铺未开放或已过期");
  }
}

function assertShopOwner(
  shop: { owner: string },
  uuid: string,
  message: string = "无权操作该店铺"
) {
  if (!shop || shop.owner !== uuid) {
    throw new Error(message);
  }
}

function assertCanViewShop(
  shop: { owner: string; visibility: PlayerShopVisibility },
  viewerUuid?: string | null
) {
  // Only private visibility restricts viewing to owner (extend here if guild logic added)
  if (
    shop.visibility === PlayerShopVisibility.PRIVATE &&
    viewerUuid &&
    shop.owner !== viewerUuid
  ) {
    throw new Error("无权访问该店铺");
  }
}

// Recompute and persist the list of resource IDs this shop sells (distinct)
async function updateShopSellResources(
  shopUuid: string,
  tx?: PrismaTx
) {
  if (!tx) {
      tx = prisma;
  }
  const rows = await tx.playerShopItem.findMany({
    where: {
      shopUuid,
      // Only include items currently on sale
      state: PlayerShopItemState.ACTIVE,
    },
    select: { resourceId: true },
    distinct: ["resourceId"],
  });

  const ids = rows.map((r) => r.resourceId);

  await tx.playerShop.update({
    where: { uuid: shopUuid },
    data: { sellResource: JSON.stringify(ids) },
  });
}

function toShopDTO(s: any): PlayerShopDTO {
  return {
    uuid: s.uuid,
    owner: s.owner,
    name: s.name,
    description: s.description,
    visibility: s.visibility,
    state: s.state,
    expiresAt: s.expiresAt.toISOString(),
    guildUuid: s.guildUuid ?? null,
    area: s.area ?? null,
    sellResource: s.sellResource ? JSON.parse(s.sellResource) : undefined,
  };
}

function toItemDTO(i: PlayerShopItem): PlayerShopItemDTO {
  const meta = parseItemMetadata(i.metadata ?? null);
  return {
    uuid: i.uuid,
    shopUuid: i.shopUuid,
    sellerUuid: i.sellerUuid,
    resourceId: i.resourceId,

    availableCount: 0,// Number(i.availableCount),
    inventoryRemainingCount: Number(i.inventoryRemainingCount),
    soldCount: Number(i.soldCount),
    unitPrice: Number(i.unitPrice),
    currencyResourceId: i.currencyResourceId,
    state: i.state as PlayerShopItemState,
    comment: meta.comment,
    perPlayerDailyLimit: meta.perPlayerDailyLimit,
    perPlayerLimitIntervalDays: meta.perPlayerLimitIntervalDays,
  };
}

function toPurchaseDTO(p: any): PlayerShopPurchaseDTO {
  return {
    uuid: p.uuid,
    buyerUuid: p.buyerUuid,
    // sellerUuid: p.sellerUuid,
    // shopUuid: p.shopUuid,
    itemUuid: p.itemUuid,
    resourceId: p.resourceId,
    currencyResourceId: p.currencyResourceId,
    unitPrice: Number(p.unitPrice),
    count: Number(p.count ?? 0),
    // totalCost: Number(p.totalCost ?? 0),
    // state: p.state,
    createdAt: p.createdAt?.toISOString?.() ?? new Date(p.createdAt).toISOString(),
  };
}

// Sanitize shop info for public list (least info exposure)
function sanitizeShopForPublic(dto: PlayerShopDTO): PlayerShopDTO {
  return {
    ...dto,
    // owner: "",
    guildUuid: null,
    area: null,
    // keep visibility/state/expiresAt for client rendering
  };
}

// Sanitize item info for non-owner viewer
function sanitizeItemForViewer(
  item: PlayerShopItemDTO,
  isOwner: boolean
): PlayerShopItemDTO {
  if (isOwner) return item;
  return {
    // availableCount: 0,
    // soldCount: 0,
    ...item,
    inventoryRemainingCount: 0,
    // sellerUuid: "",
    // Do not leak total stock and sold numbers to non-owner
    // stockCount: 0,
  };
}

export async function createPlayerShop(
  ownerUuid: string,
  payload: CreatePlayerShopPayload
): Promise<PlayerShopDTO> {

  payload.name = sanitizeInput(payload.name)
  payload.description = sanitizeInput(payload.description ?? "")

  if (
    !payload?.name ||
    typeof payload.name !== "string" ||
    payload.name.length > 12
  ) {
    throw new Error("名称不合法");
  }
  if (await checkSensitiveWords(payload.name)) {
    throw new Error("名称不合法");
  }

  if (payload.description && typeof payload.description !== "string") {
    throw new Error("描述不合法");
  }
  if ((payload.description?.length ?? 0) > 24) {
    throw new Error("描述不合法");
  }
  if (payload.description && await checkSensitiveWords(payload.description)) {
    throw new Error("描述不合法");
  }

  if (await isIronCat(ownerUuid)) {
    throw new Error("铁喵不能创建店铺");
  }

  const rawDays = DEFAULT_RENT_DAYS;
  const days = Math.max(1, Math.floor(rawDays));
  const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);

  return prisma.$transaction(async (tx) => {
    // 如果已经拥有了店铺，则不允许再创建
    const existing = await tx.playerShop.findFirst({
      where: { owner: ownerUuid },
    });

    if (existing) {
      throw new Error("已经拥有店铺，无法重复创建");
    }

  const requirement = convertItemCountInfoToResourceRequirement(CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT)
  const hasEnoughResource = await checkResourceRequirementInDB(ownerUuid, requirement, tx)
    if (!hasEnoughResource) {
        throw new Error("所需资源不足")
    }

    await decreaseItemCount(ownerUuid, CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT, {
        type: ModifyItemCountType.Other,
        actionName: "创建店铺",
        sendModifyEvent: true,
        showModifyInfo: true
    }, tx)
    await invalidateInventoryCache(ownerUuid);

    // 校验可见性，默认为公开（从 payload 动态读取，避免类型不匹配报错）
    let visibility = PlayerShopVisibility.PUBLIC;
    const reqVisibility = (payload as any)?.visibility;
    if (reqVisibility !== undefined && reqVisibility !== null) {
      const v = reqVisibility as PlayerShopVisibility;
      if (
        v === PlayerShopVisibility.PUBLIC ||
        v === PlayerShopVisibility.GUILD ||
        v === PlayerShopVisibility.PRIVATE
      ) {
        visibility = v;
      } else {
        throw new Error("可见性不合法");
      }
    }

    const shop = await tx.playerShop.create({
      data: {
        owner: ownerUuid,
        name: payload.name,
        description: payload.description ?? null,
        visibility,
        state: PlayerShopState.OPEN,
        expiresAt,
        guildUuid: null,
        area: null,
      },
    });
    return toShopDTO(shop);
  });
}

export async function renewPlayerShop(
  ownerUuid: string,
  payload: RenewPlayerShopPayload
): Promise<PlayerShopDTO> {
  const rawDays = Number(payload.days);
  if (!Number.isFinite(rawDays)) throw new Error("天数参数不合法");
  const days = Math.max(1, Math.floor(rawDays));
  return await withUniqueLock(
    `playerShop:renew:${payload.shopUuid}`,
    async () => {
      const shop = await prisma.playerShop.findUnique({
        where: { uuid: payload.shopUuid },
      });
      if (!shop) throw new Error("店铺不存在");
      assertShopOwner(shop as any, ownerUuid);

      const base =
        shop.expiresAt && shop.expiresAt > new Date()
          ? shop.expiresAt
          : new Date();
      const newExpires = new Date(base.getTime() + days * 24 * 3600 * 1000);

      const updated = await prisma.playerShop.update({
        where: { uuid: payload.shopUuid },
        data: { expiresAt: newExpires, state: PlayerShopState.OPEN },
      });
      return toShopDTO(updated);
    }
  );
}

export async function updatePlayerShop(
  ownerUuid: string,
  payload: UpdatePlayerShopPayload
): Promise<PlayerShopDTO> {
  if (!payload?.shopUuid || typeof payload.shopUuid !== "string") {
    throw new Error("shopUuid 参数不合法");
  }

  const data: any = {};

  payload.name = sanitizeInput(payload.name ?? "")
  payload.description = sanitizeInput(payload.description ?? "")

  if (!!payload.name) {
    if (
      typeof payload.name !== "string" ||
      !payload.name ||
      payload.name.length > 12
    ) {
      throw new Error("名称不合法");
    }

    if (await checkSensitiveWords(payload.name)) {
      throw new Error("名称不合法");
    }

    data.name = payload.name;
  }

  if (payload.description !== undefined) {
    if (payload.description !== null && typeof payload.description !== "string") {
      throw new Error("描述不合法");
    }

    if ((payload.description?.length ?? 0) > 24) {
        throw new Error("描述不合法");
    }

    if (payload.description && await checkSensitiveWords(payload.description)) {
        throw new Error("描述不合法");
    }

    data.description = payload.description;
  }

  if (payload.visibility !== undefined && payload.visibility !== null) {
    const v = payload.visibility as any;
    const valid =
      v === PlayerShopVisibility.PUBLIC ||
      v === PlayerShopVisibility.GUILD ||
      v === PlayerShopVisibility.PRIVATE;
    if (!valid) {
      throw new Error("可见性不合法");
    }
    data.visibility = payload.visibility;
  }

  const shop = await prisma.playerShop.findUnique({
    where: { uuid: payload.shopUuid },
  });
  if (!shop) throw new Error("店铺不存在");
  assertShopOwner(shop as any, ownerUuid);

  const updated = await prisma.playerShop.update({
    where: { uuid: shop.uuid },
    data,
  });
  return toShopDTO(updated);
}

// todo 创建物品时，检查是否重复上架
// todo 添加库存保底量
export async function addItemToShop(
  ownerUuid: string,
  payload: AddItemToShopPayload
): Promise<PlayerShopItemDTO> {
  if (!payload?.shopUuid) throw new Error("shopUuid 参数不合法");
  if (!payload?.resourceId) throw new Error("资源ID不合法");
  const rawPrice = Number(payload.unitPrice);
  const rawInventoryRemainingCount = Number(payload.inventoryRemainingCount);

  const owner = await prisma.user.findUnique({ where: { uuid: ownerUuid } });
  if (!owner?.email_verified) {
    throw new Error("请先验证邮箱后再进行店铺操作");
  }

  if (!Number.isInteger(rawPrice) || rawPrice <= 0)
    throw new Error("单价不合法");

  if (!Number.isInteger(rawInventoryRemainingCount) || rawInventoryRemainingCount < 0)
    throw new Error("库存保留数量不合法");
  const unitPrice = rawPrice;

  const resource = allGameResource[payload.resourceId];

  if (!resource?.name) {
    throw new Error("售卖物品资源无效");
  }
  if (resource.hideInMarket || resource.hideInShop) {
    throw new Error("该物品不可在店铺交易");
  }

  // 校验评论：可选，长度限制，敏感词过滤
  if (payload.comment !== undefined && payload.comment !== null) {
    if (typeof payload.comment !== 'string') {
      throw new Error('评价不合法');
    }
    const trimmed = payload.comment.trim();
    if (trimmed.length > 40) {
      throw new Error('评价不合法');
    }
    if (trimmed && await checkSensitiveWords(trimmed)) {
      throw new Error('评价不合法');
    }
    payload.comment = sanitizeInput(trimmed);
  }

  // 校验每日限购：可选，必须为整数 >= 0
  if (payload.perPlayerDailyLimit !== undefined && payload.perPlayerDailyLimit !== null) {
    const v = Number(payload.perPlayerDailyLimit);
    if (!Number.isInteger(v) || v < 0) {
      throw new Error("每日限购数量不合法");
    }
    payload.perPlayerDailyLimit = v;
    if (v > 0) {
      const normalizedInterval = normalizeLimitIntervalDays(payload.perPlayerLimitIntervalDays);
      if (!normalizedInterval) {
        throw new Error("限购周期必须在1到30天之间");
      }
      payload.perPlayerLimitIntervalDays = normalizedInterval;
    } else {
      payload.perPlayerLimitIntervalDays = undefined;
    }
  } else {
    payload.perPlayerLimitIntervalDays = undefined;
  }

  return await withUniqueLock(
    `playerShop:addItem:${payload.shopUuid}:${payload.resourceId}`,
    async () => {
      return prisma.$transaction(async (tx) => {
        const shop = await tx.playerShop.findUnique({
          where: { uuid: payload.shopUuid },
        });

        if (!shop) throw new Error("店铺不存在");
        assertShopOwner(shop as any, ownerUuid);
        assertShopIsOpen(shop as any);

        // 检查是否已经存在相同资源
        const existing = await tx.playerShopItem.findFirst({
            where: {
                shopUuid: shop.uuid,
                resourceId: payload.resourceId
            }
        });
        if (existing) {
            throw new Error("已存在相同资源的上架项，请勿重复添加");
        }

        // Enforce max active item slots per shop (respect per-user expansions stored in UserSlotExpansion)
        const slotRow = await tx.userSlotExpansion.findUnique({ where: { userUuid: ownerUuid } });
        const extraSlots = (slotRow?.playerShopSchemeUsage_default ?? 0) + (slotRow?.playerShopSchemeUsage_fast ?? 0)
        const maxSlotsForUser = BASE_MAX_PLAYER_SHOP_ITEM_SLOT + extraSlots;

        const activeCount = await tx.playerShopItem.count({
          where: {
            shopUuid: shop.uuid,
            state: { in: [PlayerShopItemState.ACTIVE, PlayerShopItemState.HIDDEN, PlayerShopItemState.OUT] as any },
          },
        });
        if (activeCount >= maxSlotsForUser) {
          throw new Error(`已达到最大上架栏位（${maxSlotsForUser}）`);
        }

        // 创建上架项
        const item = await tx.playerShopItem.create({
          data: {
            shopUuid: shop.uuid,
            sellerUuid: ownerUuid,
            resourceId: payload.resourceId as any,
            inventoryRemainingCount: BigInt(rawInventoryRemainingCount),
            soldCount: BigInt(0),
            unitPrice: unitPrice,
            currencyResourceId: "gold",
            state: PlayerShopItemState.ACTIVE,
            metadata: serializeItemMetadata({
              comment: payload.comment ?? undefined,
              perPlayerDailyLimit:
                payload.perPlayerDailyLimit && payload.perPlayerDailyLimit > 0
                  ? payload.perPlayerDailyLimit
                  : undefined,
              perPlayerLimitIntervalDays:
                payload.perPlayerDailyLimit && payload.perPlayerDailyLimit > 0
                  ? payload.perPlayerLimitIntervalDays || MIN_LIMIT_INTERVAL_DAYS
                  : undefined,
            }),
          },
        });

        await updateShopSellResources(shop.uuid, tx);
        return toItemDTO(item);
      });
    }
  );
}

export async function updatePlayerShopItem(
  ownerUuid: string,
  payload: UpdatePlayerShopItemPayload
): Promise<PlayerShopItemDTO> {
  if (!payload?.itemUuid || typeof payload.itemUuid !== "string") {
    throw new Error("itemUuid 参数不合法");
  }

  return await withUniqueLock(
    `playerShop:item:update:${payload.itemUuid}`,
    async () => {
      return prisma.$transaction(async (tx) => {
        const item = await tx.playerShopItem.findUnique({
          where: { uuid: payload.itemUuid },
        });
        if (!item) {
          throw new Error("商品不存在");
        }
        if (item.sellerUuid !== ownerUuid) {
          throw new Error("无权操作该商品");
        }

        const updateData: Prisma.PlayerShopItemUpdateInput = {};
        const meta = parseItemMetadata(item.metadata ?? null);

        if (payload.unitPrice !== undefined && payload.unitPrice !== null) {
          const rawPrice = Number(payload.unitPrice);
          if (!Number.isInteger(rawPrice) || rawPrice <= 0) {
            throw new Error("单价不合法");
          }
          updateData.unitPrice = rawPrice;
        }

        if (payload.comment !== undefined) {
          if (payload.comment === null || payload.comment === "") {
            delete meta.comment;
          } else {
            if (typeof payload.comment !== "string") {
              throw new Error("评价不合法");
            }
            const trimmed = payload.comment.trim();
            if (trimmed.length > 40) {
              throw new Error("评价不合法");
            }
            if (trimmed && (await checkSensitiveWords(trimmed))) {
              throw new Error("评价不合法");
            }
            meta.comment = sanitizeInput(trimmed);
          }
        }

        let limitUpdated = false;
        if (payload.perPlayerDailyLimit !== undefined) {
          if (payload.perPlayerDailyLimit === null) {
            delete meta.perPlayerDailyLimit;
            delete meta.perPlayerLimitIntervalDays;
            limitUpdated = true;
          } else {
            const limitValue = Number(payload.perPlayerDailyLimit);
            if (!Number.isInteger(limitValue) || limitValue < 0) {
              throw new Error("每日限购数量不合法");
            }
            if (limitValue === 0) {
              delete meta.perPlayerDailyLimit;
              delete meta.perPlayerLimitIntervalDays;
            } else {
              meta.perPlayerDailyLimit = limitValue;
              const intervalSource =
                payload.perPlayerLimitIntervalDays !== undefined
                  ? payload.perPlayerLimitIntervalDays
                  : meta.perPlayerLimitIntervalDays ?? MIN_LIMIT_INTERVAL_DAYS;
              const normalizedInterval = normalizeLimitIntervalDays(intervalSource);
              if (!normalizedInterval) {
                throw new Error("限购周期必须在1到30天之间");
              }
              meta.perPlayerLimitIntervalDays = normalizedInterval;
            }
            limitUpdated = true;
          }
        }

        if (!limitUpdated && payload.perPlayerLimitIntervalDays !== undefined) {
          if (!meta.perPlayerDailyLimit || meta.perPlayerDailyLimit <= 0) {
            throw new Error("请先设置限购数量");
          }
          const normalizedInterval = normalizeLimitIntervalDays(
            payload.perPlayerLimitIntervalDays
          );
          if (!normalizedInterval) {
            throw new Error("限购周期必须在1到30天之间");
          }
          meta.perPlayerLimitIntervalDays = normalizedInterval;
        }

        const newMetadata = serializeItemMetadata(meta);
        updateData.metadata = newMetadata;

        const updated = await tx.playerShopItem.update({
          where: { uuid: item.uuid },
          data: updateData,
        });

        return toItemDTO(updated);
      });
    }
  );
}

export async function removeItemFromShop(
  ownerUuid: string,
  payload: RemoveItemFromShopPayload
): Promise<{ itemUuid: string; returned: number }> {
  if (!payload?.itemUuid || typeof payload.itemUuid !== "string")
    throw new Error("itemUuid 参数不合法");

  return await withUniqueLock(
    `playerShop:item:${payload.itemUuid}`,
    async () => {
      const item = await prisma.playerShopItem.findUnique({
        where: { uuid: payload.itemUuid },
      });
      if (!item) throw new Error("商品不存在");
      if (item.sellerUuid !== ownerUuid) throw new Error("无权操作该商品");

      if (item.state === PlayerShopItemState.REMOVED)
        return { itemUuid: item.uuid, returned: 0 };

      await prisma.$transaction(async (tx) => {
        await tx.playerShopItem.delete({
          where: { uuid: item.uuid },
        });
        await updateShopSellResources(item.shopUuid, tx);
      });
      return { itemUuid: item.uuid, returned: 0 };
    }
  );
}

export async function buyFromShop(
  buyerUuid: string,
  payload: BuyFromShopPayload
): Promise<{
  itemUuid: string;
  buyCount: number;
  totalCost: number;
  sellerUuid: string;
  resourceId: AllGameResourceID;
}> {
  if (!payload?.itemUuid || typeof payload.itemUuid !== "string")
    throw new Error("itemUuid 参数不合法");

  const rawCount = Number(payload.count);

  if (!Number.isInteger(rawCount) || rawCount <= 0)
    throw new Error("数量不合法");

  const count = rawCount;

  if (await isIronCat(buyerUuid)) {
    throw new Error("铁喵不能从店铺购买商品");
  }

  const buyer = await prisma.user.findUnique({ where: { uuid: buyerUuid } });
  if (!buyer?.email_verified) {
    throw new Error("请先验证邮箱后再进行购买");
  }

  // 创建账号48小时内无法购买店铺商品
  const accountAgeMs = Date.now() - buyer.create_date.getTime();
  if (accountAgeMs < 36 * 3600 * 1000) {
    throw new Error("新账号创建36小时内无法从商业街店铺中购买商品");
  }

  // Use a slightly longer TTL/retry for purchase to avoid transient lock collisions under high load
  return await withUniqueLock(
    `playerShop:item:${payload.itemUuid}`,
    async () => {
      return prisma.$transaction(async (tx) => {
        // Keep pre-checks light before transaction to minimize lock hold time
        const fresh = await tx.playerShopItem.findUnique({
          where: { uuid: payload.itemUuid },
        });
        if (!fresh) {
          throw new Error("商品不存在");
        }
        if (fresh.sellerUuid === buyerUuid) {
          throw new Error("不能购买自己上架的商品");
        }

        if (fresh.state !== PlayerShopItemState.ACTIVE) {
          throw new Error("该商品当前不可售");
        }

        const sellerUuid = fresh.sellerUuid;

        const selledResource = allGameResource[fresh.resourceId];
        const currencyResource = allGameResource[fresh.currencyResourceId];

        if (!selledResource?.name) {
          throw new Error("售卖物品资源无效");
        }
        if (selledResource.hideInMarket || selledResource.hideInShop) {
          throw new Error("该物品不可在店铺交易");
        }

        if (!currencyResource?.name) {
          throw new Error("货币资源无效");
        }
        if (currencyResource.id != 'gold') {
          throw new Error("该货币不可用于店铺交易");
        }

        if (SPECIAL_ITEM_20251202.includes(selledResource.id)) {
          const unlockDate = new Date('2025-12-01T10:00:00.000Z');
          if (new Date() < unlockDate) {
            throw new Error(`该资源在${formatTime(unlockDate)}后才可购买`);
          }
        }

        const shop = await tx.playerShop.findUnique({
          where: { uuid: fresh.shopUuid },
        });
        if (!shop) throw new Error("店铺不存在");
        assertShopIsOpen(shop as any);

        const totalCost = Number(fresh.unitPrice) * count;
        const meta = parseItemMetadata(fresh.metadata ?? null);
        const perPlayerDailyLimit = meta.perPlayerDailyLimit;
        const effectiveIntervalDays =
          perPlayerDailyLimit && perPlayerDailyLimit > 0
            ? meta.perPlayerLimitIntervalDays || MIN_LIMIT_INTERVAL_DAYS
            : undefined;
        let limitKey: string | null = null;
        let limitTtlSec = 0;
        let limitCurrent = 0;
        if (perPlayerDailyLimit && perPlayerDailyLimit > 0 && effectiveIntervalDays) {
          const now = new Date();
          const { keySuffix, ttlSec } = computeLimitWindow(
            now,
            effectiveIntervalDays
          );
          limitKey = `shopLimit:${fresh.uuid}:${buyerUuid}:${keySuffix}`;
          limitTtlSec = ttlSec;
          // redisClient.get: 读取 key 的字符串值，若不存在返回 null
          // 用途：读取本周期内用户已经购买的计数，用于限购校验
          const currentStr = await redisClient.get(limitKey);
          limitCurrent = currentStr ? Number(currentStr) : 0;
          if (limitCurrent + count > perPlayerDailyLimit) {
            const remain = Math.max(0, perPlayerDailyLimit - limitCurrent);
            throw new Error(`超过限购，本周期剩余可购数量：${remain}`);
          }
        }
        const currency = fresh.currencyResourceId as AllGameResourceID;

        const selledResourceInfo: ItemCountInfo = {
          [fresh.resourceId]: { count },
        };

    const sellerInventoryCount = await getItemCount(sellerUuid, fresh.resourceId, tx);
        if (sellerInventoryCount < count) {
            throw new Error("小卖部库存不足，请刷新");
        }

        if (fresh.inventoryRemainingCount && sellerInventoryCount - count < Number(fresh.inventoryRemainingCount)) {
            throw new Error("小卖部库存不足，请刷新");
        }

        const neededResource: ItemCountInfo = {
          [currency]: { count: totalCost },
        };
        const neededResourceRequirement =
          convertItemCountInfoToResourceRequirement(neededResource);
        const buyerHasEnouthResource = await checkResourceRequirementInDB(
          buyerUuid,
          neededResourceRequirement,
          tx
        );
        if (!buyerHasEnouthResource) {
          throw new Error("购买所需资源不足");
        }

        // 卖家扣除货物（校验实际扣减数量）
        const sellerDec = await decreaseItemCount(
          sellerUuid,
          selledResourceInfo,
          {
            actionName: `店铺出售 ${selledResource.name} x${count}`,
            type: ModifyItemCountType.Market,
            showModifyInfo: true,
            sendModifyEvent: true,
          },
          tx
        );
        await invalidateInventoryCache(sellerUuid);
        if ((sellerDec[fresh.resourceId]?.count ?? 0) !== count) {
          throw new Error("小卖部库存不足，请刷新");
        }

        // 买家支付（校验实际扣减数量）
        const buyerDec = await decreaseItemCount(
          buyerUuid,
          neededResource,
          {
            actionName: `店铺购买 ${selledResource.name} x${count}`,
            type: ModifyItemCountType.Market,
            sendModifyEvent: true,
            showModifyInfo: true,
          },
          tx
        );
        await invalidateInventoryCache(buyerUuid);
        if ((buyerDec[currency]?.count ?? 0) !== totalCost) {
          throw new Error("购买所需资源不足");
        }

        const actualIncoming: ItemCountInfo = {}
        for(const itemId of Object.keys(neededResource)) {
            let count = neededResource[itemId]?.count;
            if (!count || count <= 0) {
                continue;
            }

            count = Math.floor(count * (1 - PLAYER_SHOP_FEE));

            if (count <= 0) {
                continue;
            }

            actualIncoming[itemId] = { count };
        }

        // 卖家收款
        await enqueueToHarvestBox(
          fresh.sellerUuid,
          actualIncoming,
          {
            title: `店铺售出 ${selledResource.name}`,
            source: HarvestBoxSource.Event,
          },
          tx
        );

        // 买家收货
        await increaseItemCount(
          buyerUuid,
          selledResourceInfo,
          {
            actionName: `店铺购买 ${selledResource.name} x${count}`,
            type: ModifyItemCountType.Market,
            sendModifyEvent: true,
            showModifyInfo: true,
          },
          tx
        );
        await invalidateInventoryCache(buyerUuid);

        // 更新库存
        const newSold = Number(fresh.soldCount) + count;
        await tx.playerShopItem.update({
          where: { uuid: fresh.uuid },
          data: {
            soldCount: BigInt(newSold),
          },
        });

        // 记录购买流水
        await tx.playerShopPurchase.create({
          data: {
            buyerUuid,
            sellerUuid: fresh.sellerUuid,
            shopUuid: fresh.shopUuid,
            itemUuid: fresh.uuid,
            resourceId: fresh.resourceId,
            currencyResourceId: fresh.currencyResourceId,
            unitPrice: fresh.unitPrice as any,
            count,
            totalCost: BigInt(totalCost),
            itemSnapshot: JSON.stringify({
              inventoryRemainingCount: Number(fresh.inventoryRemainingCount ?? 0),
              soldCount: Number(fresh.soldCount ?? 0),
              metadata: fresh.metadata ? JSON.parse(fresh.metadata) : null,
            }),
            state: "SUCCESS",
          },
        });

        // 成功后增加每日限购计数，并设置过期到今天 24:00（服务器时区）
        try {
          if (limitKey && perPlayerDailyLimit && perPlayerDailyLimit > 0) {
            // redisClient.incrBy: 对 key 的整数值原子自增并返回新值
            // 用途：记录并累加用户本周期购买数量（并发安全）
            const newVal = await redisClient.incrBy(limitKey, count);
            if (newVal === count) {
              // expire: 为 key 设置过期时间（秒），用于让计数器在周期结束时自动过期
              await redisClient.expire(limitKey, limitTtlSec);
            } else {
              // ttl: 获取 key 剩余生存时间（秒），若接近过期则重置为期望的 ttl
              const ttl = await redisClient.ttl(limitKey);
              if (ttl < 60) await redisClient.expire(limitKey, limitTtlSec);
            }
          }
        } catch {}

        return {
          itemUuid: fresh.uuid,
          buyCount: count,
          totalCost,
          sellerUuid: fresh.sellerUuid,
          resourceId: fresh.resourceId as AllGameResourceID,
        };
      });
    }
    // { expireSec: 10, maxRetry: 10, minDelayMs: 50, maxDelayMs: 200 }
  );
}

export async function getMyShops(
  ownerUuid: string,
  query: GetMyShopsQuery
): Promise<PlayerShopDTO[]> {
  const shops = await prisma.playerShop.findMany({
    where: {
      owner: ownerUuid,
      ...(query.includeExpired
        ? {}
        : {
            expiresAt: { gt: new Date() },
            state: { in: [PlayerShopState.OPEN, PlayerShopState.PAUSED] },
          }),
    },
    orderBy: { createdAt: "desc" },
  });
  const pinned = new Set(await getPinnedShopUuids());
  return shops.map(s => ({ ...toShopDTO(s), isPinned: pinned.has(s.uuid) }));
}

export async function getShopDetail(
  shopUuid: string,
  viewerUuid: string
): Promise<{ shop: PlayerShopDTO; items: PlayerShopItemDTO[] }> {
  let shop = await prisma.playerShop.findUnique({ where: { uuid: shopUuid } });
  if (!shop) throw new Error("店铺不存在");
  // visibility access control
  assertCanViewShop(shop as any, viewerUuid);
  // 懒触发到期回退：当查询已到期店铺时，自动执行一次到期结算
  if (shop.expiresAt <= new Date() && shop.state !== PlayerShopState.EXPIRED) {
    await expireShop(shopUuid);
    shop = (await prisma.playerShop.findUnique({
      where: { uuid: shopUuid },
    })) as any;
  }
  const items = await prisma.playerShopItem.findMany({
    where: {
      shopUuid: shopUuid,
      state: {
        in: [
          PlayerShopItemState.ACTIVE,
          PlayerShopItemState.OUT,
          PlayerShopItemState.HIDDEN,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const shopDto = toShopDTO(shop);
  const isOwner = !!viewerUuid && shopDto.owner === viewerUuid;
  // For non-owner, minimize item info

  const itemDtos: PlayerShopItemDTO[] = []
  for(const item of items) {
    let itemDto = toItemDTO(item);

    const inventoryCount = await getItemCount(shopDto.owner, item.resourceId);
    itemDto.availableCount = inventoryCount;
    if (item.inventoryRemainingCount) {
        itemDto.availableCount = Math.max(0, inventoryCount - Number(item.inventoryRemainingCount))
    }
    if (itemDto.perPlayerDailyLimit && itemDto.perPlayerDailyLimit > 0 && !itemDto.perPlayerLimitIntervalDays) {
      itemDto.perPlayerLimitIntervalDays = MIN_LIMIT_INTERVAL_DAYS;
    }

    itemDtos.push(sanitizeItemForViewer(itemDto, isOwner));
  }

  // Also hide some shop fields for non-owner viewers (no guild/area exposure)
  const finalShop = isOwner
    ? shopDto
    : { ...shopDto, guildUuid: null, area: null };
  return { shop: finalShop, items: itemDtos };
}

// 公共店铺列表
export async function getPublicShops(
  query: GetPublicShopsQuery
): Promise<GetPublicShopsResult> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)));
  const now = new Date();

  // Pre-filter by item if provided
  let filterShopUuids: string[] | null = null;
  if (query.resourceId) {
    const rows = await prisma.playerShopItem.findMany({
      where: {
        resourceId: query.resourceId,
        state: { in: [PlayerShopItemState.ACTIVE, PlayerShopItemState.OUT] },
      },
      select: { shopUuid: true },
    });
    filterShopUuids = Array.from(new Set(rows.map((r) => r.shopUuid)));
    // 如果没有店铺售卖该物品，直接返回空结果
    if (!filterShopUuids.length) {
      return { shops: [], total: 0, page, pageSize };
    }
  }

  const where: Prisma.PlayerShopWhereInput = {
    visibility: PlayerShopVisibility.PUBLIC as any,
    state: { in: [PlayerShopState.OPEN] as any },
    // expiresAt: { gt: now },
    // sellResource: {
    // }
    // ...(query.area ? { area: query.area } : {}),
    // ...(query.guildUuid ? { guildUuid: query.guildUuid } : {}),
    // ...(query.excludeOwner ? { owner: { not: query.excludeOwner } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, } },
            { description: { contains: query.search, } },
          ],
        }
      : {}),
    ...(filterShopUuids ? { uuid: { in: filterShopUuids } } : {}),
  } as any;

  // 为了随机排序且分页不重复：
  // 1) 先取出一页上限的“足够多”候选，或干脆全部（数量预期不大）；
  // 2) 使用 seed 进行可复现的洗牌；
  // 3) 再按 page/pageSize 切片。
  // 这里采用“先取全部再洗牌”的策略，简单且结果正确（若后续数据量大，可优化为 seed-based rank + offset）。
  const [total, allRows] = await prisma.$transaction([
    prisma.playerShop.count({ where }),
    prisma.playerShop.findMany({
      where,
      orderBy: { createdAt: "desc" }, // 原始顺序仅作为稳定输入
    }),
  ]);

  // 生成 PRNG（Mulberry32）
  function mulberry32(a: number) {
    return function() {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 将 seed 字符串转为 32 位整数
  function hashSeed(s: string) {
    let h = 2166136261 >>> 0; // FNV-1a
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const seedStr = query.seed || `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`; // 默认为当天种子
  const rng = mulberry32(hashSeed(seedStr));

  // Fisher-Yates 洗牌（基于种子）
  const rows = allRows.slice();
  // Ensure pinned shops always stay at the front. Pull pinned uuids first.
  const pinnedUuids = await getPinnedShopUuids();
  const pinnedSet = new Set(pinnedUuids);
  const pinnedRows = rows.filter(r => pinnedSet.has(r.uuid));
  const normalRows = rows.filter(r => !pinnedSet.has(r.uuid));
  // shuffle normal rows only
  for (let i = normalRows.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [normalRows[i], normalRows[j]] = [normalRows[j], normalRows[i]];
  }
  const orderedRows = [...pinnedRows, ...normalRows];

  // 分页切片
  const pagedRows = orderedRows.slice((page - 1) * pageSize, page * pageSize);

  // Aggregate total sold count for each shop in the current page
  const shopUuids = pagedRows.map((r) => r.uuid);
  let sumMap = new Map<string, number>();
  if (shopUuids.length > 0) {
    const sums = await prisma.playerShopItem.groupBy({
      by: ["shopUuid"],
      where: { shopUuid: { in: shopUuids } },
      _sum: { soldCount: true },
    });
    sumMap = new Map(
      sums.map((s) => [s.shopUuid, Number(s._sum.soldCount ?? 0)])
    );
  }

  const shopsWithTotals = pagedRows
    .map(toShopDTO)
    .map((s) => ({ ...s, totalSoldCount: Number(sumMap.get(s.uuid) ?? 0), isPinned: pinnedSet.has(s.uuid) }))
    .map(sanitizeShopForPublic)
    .filter((shop) => !!shop.sellResource?.length);

  return {
    shops: shopsWithTotals,
    total,
    page,
    pageSize,
  };
}

// 到期处理（懒触发/定时触发均可复用），把可售库存回退给店主
export async function expireShop(shopUuid: string) {
  return await withUniqueLock(`playerShop:expire:${shopUuid}`, async () => {
    return prisma.$transaction(async (tx) => {
      const shop = await tx.playerShop.findUnique({
        where: { uuid: shopUuid },
      });
      if (!shop) return { ok: true, already: true };

      if (shop.expiresAt > new Date() && shop.state === PlayerShopState.OPEN)
        return { ok: true, already: true };

      const items = await tx.playerShopItem.findMany({
        where: {
          shopUuid,
          state: {
            in: [
              PlayerShopItemState.ACTIVE,
              PlayerShopItemState.HIDDEN,
              PlayerShopItemState.OUT,
            ],
          },
        },
      });

      for (const it of items) {
        await tx.playerShopItem.update({
          where: { uuid: it.uuid },
          data: { state: PlayerShopItemState.OUT },
        });
      }
      await tx.playerShop.update({
        where: { uuid: shop.uuid },
        data: { state: PlayerShopState.EXPIRED },
      });
    });
  });
}

// 获取某个上架项的购买记录（分页）
export async function getPurchaseList(
  viewerUuid: string,
  query: GetShopPurchaseListQuery
): Promise<GetShopPurchaseListResult> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 20)));

  // 权限与存在性检查：必须能访问该 item 所属店铺（店主可见；未来可扩展为卖家/买家各自可见）
  const item = await prisma.playerShopItem.findUnique({ where: { uuid: query.itemUuid } });
  if (!item) throw new Error("上架项不存在");
  const shop = await prisma.playerShop.findUnique({ where: { uuid: item.shopUuid } });
  if (!shop) throw new Error("店铺不存在");
  // Reuse owner check with a specific message
  try {
    assertShopOwner(shop as any, viewerUuid, "无权查看该记录");
  } catch (e) {
    throw e;
  }

  const where = { itemUuid: query.itemUuid } as any;
  const [total, rows] = await prisma.$transaction([
    prisma.playerShopPurchase.count({ where }),
    prisma.playerShopPurchase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    records: rows.map(toPurchaseDTO),
    total,
    page,
    pageSize,
  };
}
