import { toKitty } from "../utils/game/kitty";
import { prisma } from "../utils/prisma";
import { type Kitty as KittyCat } from "~/shared/types/kitty";
import { addKittyEssay, } from "../utils/game/kittyEssay";
import { allGameAction, } from "~/shared/data/allGameActions";
import { createKittyEncounter, createKittyFriendship } from "../utils/game/kittyFriend";
import { allKittyEncounterActionContent } from "~/shared/data/allKittyEssayContent";
import { maybeGrantForMainType } from "../utils/game/traitGrantEngine";
import { randomElementInCollection } from "~/shared/utils";

const INTERVAL = 30 * 60 * 1000; // 30分钟，单位毫秒
const ENCOUNTER_PROBABILITY = 0.10; // 10%概率
const IDLE_ENCOUNTER_PROBABILITY = 0.10; // 10%概率

// 以更低内存的方式挑选同 actionId 的目标：不创建大临时数组
function pickRandomEncounterTarget(kitty: KittyCat, sameActionList: KittyCat[]): KittyCat | null {
  let chosen: KittyCat | null = null;
  let seen = 0;
  for (const cand of sameActionList) {
    if (cand.uuid === kitty.uuid) continue;
    if (cand.owner === kitty.owner) continue;
    // 蓄水池抽样，避免构建过滤后的数组
    seen++;
    if (Math.floor(Math.random() * seen) === 0) {
      chosen = cand;
    }
  }
  return chosen;
}

async function maybeKittyEncounterOptimized(kitty: KittyCat, byAction: Map<string, KittyCat[]>) {
  if (Math.random() >= ENCOUNTER_PROBABILITY) return;
  const list = byAction.get(kitty.actionId) || [];
  if (!list.length) return;
  const target = pickRandomEncounterTarget(kitty, list);
  if (!target) return;

  const encounterAction = randomElementInCollection(allKittyEncounterActionContent)!;
  const actionName = allGameAction[kitty.actionId]?.name ?? "工作";
  const description = `${kitty.name} 在 ${actionName} 时遇到了 [${target.name}{${target.uuid}}]，${encounterAction}`;
  await createKittyEncounter({
    fromKittyUuid: kitty.uuid,
    toKittyUuid: target.uuid,
    description,
  });

  try {
    await maybeGrantForMainType('encounter', kitty, target);
  } catch (e) {
    console.error('maybeGrantForMainType error', e);
  }

  await addKittyEssay(kitty, description, { action: kitty.actionId });
}

async function maybeIdleKittyEncounter(kitty: KittyCat, allKitty: KittyCat[]) {
  if (Math.random() < IDLE_ENCOUNTER_PROBABILITY) {
    // 找到同类型工作的其他猫咪（排除自己以及主人的其他猫咪）
    const sameTypeKitties = allKitty.filter(
      k => !k.isWorking && !kitty.isWorking && k.uuid !== kitty.uuid && k.owner !== kitty.owner
    );
    if (sameTypeKitties.length > 0) {
      // 随机选一个偶遇对象
      const target = randomElementInCollection(sameTypeKitties)!;
      const encounterAction = randomElementInCollection(allKittyEncounterActionContent)!;
      // 构造偶遇描述
      const description = `${kitty.name} 在 休息 时遇到了 [${target.name}{${target.uuid}}]，${encounterAction}`;
      await createKittyEncounter({
        fromKittyUuid: kitty.uuid,
        toKittyUuid: target.uuid,
        description,
      });

      // 同时写日记
      await addKittyEssay(kitty, description, {
        action: kitty.actionId
      })
    }
  }
}

async function checkMutualEncounters() {
  const PAGE_SIZE = 5000;
  let lastId: number | null = null;

  // 仅存储已见过的配对键，内存占用远低于整行对象
  const seenPairKeys = new Set<string>();

  for (;;) {
    const page: { id: number; fromKittyUuid: string; toKittyUuid: string }[] = await prisma.kittyEncounter.findMany({
      select: { id: true, fromKittyUuid: true, toKittyUuid: true },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
    });
    if (!page.length) break;

    for (const e of page) {
      const [a, b] = [e.fromKittyUuid, e.toKittyUuid].sort();
      const pairKey = `${a}->${b}`;
      if (seenPairKeys.has(pairKey)) {
        try {
          await createKittyFriendship(a, b);
        } catch (err) {
          console.error('createKittyFriendship error', err);
        }
      } else {
        seenPairKeys.add(pairKey);
      }
    }

    lastId = page[page.length - 1].id;
  }
}

async function runTask() {
  try {
    const allKitty = await prisma.kitty.findMany({
      where: { is_working: true, isInExpedition: false },
      select: { uuid: true, owner: true, name: true, is_working: true, action_id: true, isInExpedition: true },
    });
    // 构造轻量 Kitty 对象，避免 toKitty 引入不必要字段
    let allKittyCat: KittyCat[] = allKitty.map((k) => ({
      uuid: k.uuid,
      owner: k.owner,
      name: k.name,
      satiety: 0,
      maxSatiety: 0,
      mood: 0,
      maxMood: 0,
      actionId: k.action_id ?? "",
      isWorking: !!k.is_working,
      isInExpedition: !!k.isInExpedition,
    }));

    // 检查对应猫咪的主人是否已经被ban
    const ownerUuids = new Set(allKittyCat.map(k => k.owner));
    const bannedOwners = await prisma.user.findMany({
      select: {
        uuid: true,
      },
      where: {
        uuid: { in: Array.from(ownerUuids) },
        is_banned: true,
        email_verified: false,
      }
    });

    // 去除主人被ban的猫咪
    allKittyCat = allKittyCat.filter(k => !bannedOwners.some(b => b.uuid === k.owner));

    // 预先按 actionId 分组，避免在循环中反复 filter 产生大临时数组
    const byAction = new Map<string, KittyCat[]>();
    for (const k of allKittyCat) {
      const key = k.actionId || "";
      if (!byAction.has(key)) byAction.set(key, []);
      byAction.get(key)!.push(k);
    }

    console.log(`正在处理 ${allKitty.length} 只工作中猫咪的偶遇...`);

    let success = 0
    for (const kitty of allKittyCat) {
      if (!kitty.isWorking || !kitty.actionId) {
        continue; // 跳过不在工作中的猫咪
      }
      try {
        // 偶遇逻辑
        await maybeKittyEncounterOptimized(kitty, byAction);
        success++;
      } catch (error) {
        console.error(`猫咪 ${kitty.uuid} 偶遇失败：`, error);
      }
    }

    console.log(`猫咪偶遇处理完成: ${success}/${allKitty.length} 只猫咪处理成功`);

  } catch (error) {
    console.error('猫咪偶遇定时任务执行失败:', error);
  }
}

async function runIdleTask() {
  try {
    const allKitty = await prisma.kitty.findMany({
      where: {
        is_working: false,
        isInExpedition: false,
      }
    });
    const allKittyCat = allKitty.map(toKitty);

    console.log(`正在处理 ${allKitty.length} 只空闲猫咪的偶遇...`);

    let success = 0
    for(const kitty of allKitty) {
      if (kitty.is_working) {
        continue; // 跳过在工作中的猫咪
      }
      try {
        // 偶遇逻辑
        await maybeIdleKittyEncounter(toKitty(kitty), allKittyCat);
        success++;
      } catch (error) {
        console.error(`猫咪 ${kitty.uuid} 偶遇失败：`, error);
      }
    }

    console.log(`猫咪偶遇处理完成: ${success}/${allKitty.length} 只猫咪处理成功`);

  } catch (error) {
    console.error('猫咪偶遇定时任务执行失败:', error);
  }
}

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function mainLoop() {
  console.log('猫咪偶遇服务启动...');
  while (running) {
    await runTask();
    // await runIdleTask();
    await checkMutualEncounters();

    if (running) {
      await new Promise(resolve => setTimeout(resolve, INTERVAL));
    }
  }
  console.log('猫咪偶遇服务已停止。');
}

await mainLoop();
process.exit(0);