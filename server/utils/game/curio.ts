// server/utils/game/curio.ts
import { runCurioGenerator } from '~/server/utils/coze/curioGenerator';
import { CurioItem, CurioIdentifyResult } from '~/shared/types/curio';
import { randomNumberInFullColseRange } from '~/shared/utils';
import { checkResourceRequirementInDB, decreaseItemCount } from './characterInventory';
import { convertReseourceRequirementToItemModify } from '~/shared/utils/game/requirementCheck';
import { ModifyItemCountType } from '~/shared/types/gameInventory';

// 普通物品池：90%概率从中随机选择
const itemPool = [
  { id: 'catPawFossil', count: 1 },
  { id: 'catStatue', count: 1 },
  { id: 'mysteriousBell', count: 1 },
  { id: 'ancientCatBowl', count: 1 },
  { id: 'catAntiqueShard', count: 1 },
  { id: 'ancientFishBone', count: 1 },
  { id: 'catRelic', count: 1 },
];

export async function identifyCurios(owner: string, count: number): Promise<CurioIdentifyResult[]> {
  if (count < 1 || count > 10) {
    throw new Error('鉴定数量必须在1-10之间');
  }

  const cost = [{ id: 'unidentifiedCurio', count }];
  const cooldownKey = `curio:identify:cooldown:${owner}`;

  const pass = await checkResourceRequirementInDB(owner, cost);
  if (!pass) {
    throw new Error('未满足鉴定所需的资源');
  }

  // 检查冷却时间
  // @ts-ignore
  const existingCooldown = await redisClient.get(cooldownKey);
  if (existingCooldown) {
    throw new Error('鉴定过于频繁，请等待5秒后再试');
  }

  // 设置冷却时间5秒
  // @ts-ignore
  await redisClient.set(cooldownKey, '1', { EX: 5 });

  // 预生成结果，避免在事务中调用耗时的AI
  const preResults: { type: 'item' | 'curio', itemData?: { id: string, count: number }, curioData?: any }[] = [];

  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    if (rand < 0.9) {
      // 90%概率获得普通物品
      const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];
      preResults.push({
        type: 'item',
        itemData: { id: randomItem.id, count: randomItem.count },
      });
    } else {
      // 10%概率获得古董 - 预生成数据
      const generated = await runCurioGenerator();
      if (generated) {
        let extra = {
          status: [
            { status: generated.status, value: generated.status_val }
          ]
        };

        if (generated.rarity >= 8) {
          extra.status.push({
            status: "luck",
            value: randomNumberInFullColseRange(0.1, 0.3),
          });
        }

        preResults.push({
          type: 'curio',
          curioData: {
            name: generated.name,
            description: generated.description,
            lore_tag: generated.lore_fragment_tag,
            rarity: generated.rarity,
            extra: JSON.stringify(extra),
          },
        });
      } else {
        // 如果AI生成失败，给个普通物品作为补偿
        const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];
        preResults.push({
          type: 'item',
          itemData: { id: randomItem.id, count: randomItem.count },
        });
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const results: CurioIdentifyResult[] = [];

    // 批量创建古董
    const curioCreates = preResults.filter(r => r.type === 'curio').map(r => r.curioData);
    let createdCurios: CurioItem[] = [];
    if (curioCreates.length > 0) {
      const created = await tx.curioItem.createMany({
        data: curioCreates.map(data => ({ ...data, owner })),
        skipDuplicates: false,
      });

      // 获取刚创建的古董
      const recentCurios = await tx.curioItem.findMany({
        where: { owner },
        orderBy: { created_at: 'desc' },
        take: curioCreates.length,
      });

      createdCurios = recentCurios.map(curio => ({
        id: curio.id,
        uuid: curio.uuid,
        owner: curio.owner,
        name: curio.name,
        description: curio.description,
        lore_tag: curio.lore_tag,
        rarity: curio.rarity,
        extra: curio.extra || undefined,
        is_deleted: curio.is_deleted,
        created_at: curio.created_at,
        updated_at: curio.updated_at,
      }));
    }

    let curioIndex = 0;
    for (const preResult of preResults) {
      if (preResult.type === 'item') {
        results.push({
          type: 'item',
          data: preResult.itemData!,
        });
      } else {
        results.push({
          type: 'curio',
          data: createdCurios[curioIndex++],
        });
      }
    }

    // 扣除资源
    const dec = convertReseourceRequirementToItemModify(cost);
    await decreaseItemCount(owner, dec, {
      actionName: "古董鉴定",
      type: ModifyItemCountType.Other,
      showModifyInfo: true,
      sendModifyEvent: true,
    }, tx);
    await invalidateInventoryCache(owner);

    return results;
  });
}

export async function getCuriosByOwner(owner: string, page: number = 1, limit: number = 10): Promise<{ curios: CurioItem[]; total: number }> {
  const skip = (page - 1) * limit;
  const [curios, total] = await Promise.all([
    prisma.curioItem.findMany({
      where: { owner, is_deleted: false },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.curioItem.count({
      where: { owner, is_deleted: false },
    }),
  ]);

  // 映射到我们的CurioItem类型
  const mappedCurios: CurioItem[] = curios.map(curio => ({
    id: curio.id,
    uuid: curio.uuid,
    owner: curio.owner,
    name: curio.name,
    description: curio.description,
    lore_tag: curio.lore_tag,
    rarity: curio.rarity,
    extra: curio.extra || undefined,
    is_deleted: curio.is_deleted,
    created_at: curio.created_at,
    updated_at: curio.updated_at,
  }));

  return { curios: mappedCurios, total };
}

export async function getAllCurioTags(): Promise<string[]> {
  const tags = await prisma.curioItem.findMany({
    where: { is_deleted: false },
    select: { lore_tag: true },
    distinct: ['lore_tag'],
  });

  return tags.map(t => t.lore_tag);
}

export async function getCuriosByTag(owner: string, tag: string, page: number = 1, limit: number = 10): Promise<{ curios: CurioItem[]; total: number }> {
  const skip = (page - 1) * limit;
  const [curios, total] = await Promise.all([
    prisma.curioItem.findMany({
      where: { owner, lore_tag: tag, is_deleted: false },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.curioItem.count({
      where: { owner, lore_tag: tag, is_deleted: false },
    }),
  ]);

  // 映射到我们的CurioItem类型
  const mappedCurios: CurioItem[] = curios.map(curio => ({
    id: curio.id,
    uuid: curio.uuid,
    owner: curio.owner,
    name: curio.name,
    description: curio.description,
    lore_tag: curio.lore_tag,
    rarity: curio.rarity,
    extra: curio.extra || undefined,
    is_deleted: curio.is_deleted,
    created_at: curio.created_at,
    updated_at: curio.updated_at,
  }));

  return { curios: mappedCurios, total };
}

export async function getMuseumCurios(page: number = 1, limit: number = 10): Promise<{ curios: (CurioItem & { ownerName?: string })[]; total: number }> {
  const skip = (page - 1) * limit;
  const [curios, total] = await Promise.all([
    prisma.curioItem.findMany({
      where: { rarity: { gte: 5 }, is_deleted: false },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.curioItem.count({
      where: { rarity: { gte: 5 }, is_deleted: false },
    }),
  ]);

  // 获取用户名字
  const ownerUuids = [...new Set(curios.map(c => c.owner))];
  const users = await prisma.user.findMany({
    where: { uuid: { in: ownerUuids } },
    select: { uuid: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.uuid, u.name]));

  // 映射到我们的CurioItem类型，添加 ownerName
  const mappedCurios: (CurioItem & { ownerName?: string })[] = curios.map(curio => ({
    id: curio.id,
    uuid: curio.uuid,
    owner: curio.owner,
    ownerName: userMap.get(curio.owner),
    name: curio.name,
    description: curio.description,
    lore_tag: curio.lore_tag,
    rarity: curio.rarity,
    extra: curio.extra || undefined,
    is_deleted: curio.is_deleted,
    created_at: curio.created_at,
    updated_at: curio.updated_at,
  }));

  return { curios: mappedCurios, total };
}