// 随机词条（Affix）核心服务
// 约束说明：
// - 尽量减少对外部输入依赖，所有入口均做严格校验（由 IO 层与本服务共同完成）
// - 关键写操作使用 Redis 分布式锁 + Prisma 事务，保证并发安全
// - 重要操作均记录审计日志（ADD/UPDATE/REMOVE/REROLL），便于追踪
import { prisma } from "../prisma";
import type { PrismaTx } from "~/shared/types/socket/db";
import { safeJsonParse } from "~/shared/utils";
import type {
  AffixDefinition,
  AffixPool,
  CharacterAffixInstance,
  AffixRarity,
} from "~/shared/types/affix";
import { affixDefinitions } from "~/shared/data/affix/definitions";
import { allAffixPools } from "~/shared/data/affix/pools";

// 内存映射：affixId -> 定义
const definitionMap = new Map<string, AffixDefinition>(
  affixDefinitions.map((d) => [d.affixId, d])
);

// Backward-compat: normalize legacy array-shaped effect JSON to a single object
function normalizeAffixEffect<T extends object = any>(val: unknown, fallback: T): T {
  const v = (val ?? fallback) as any;
  if (Array.isArray(v)) return (v[0] ?? fallback) as T;
  if (v && typeof v === 'object') return v as T;
  return fallback;
}

// 查询角色词条（只读）
// 查询角色词条：仅返回指定用户与角色下的数据
export async function listCharacterAffixes(userUuid: string, characterUuid: string, tx?: PrismaTx): Promise<CharacterAffixInstance[]> {
    if (!tx) {
        tx = prisma;
    }

  const rows = await tx.characterAffix.findMany({
    where: { userUuid, characterUuid },
    orderBy: [{ createdAt: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    userUuid: r.userUuid,
    characterUuid: r.characterUuid,
    affixId: r.affixId,
    rarity: r.rarity as any,
  effect: normalizeAffixEffect(safeJsonParse(r.effect, {}), {}),
    score: Number(r.score || 0),
    state: r.state as any,
    source: r.source || undefined,
    seed: r.seed || undefined,
    version: r.version,
    createdAt: r.createdAt?.toISOString?.() ?? (r.createdAt as any),
    updatedAt: r.updatedAt?.toISOString?.() ?? (r.updatedAt as any),
  }));
}