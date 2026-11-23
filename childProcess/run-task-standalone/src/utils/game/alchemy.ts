import type { AlchemyAtlasEntry, AlchemyOutputSpec, AlchemyRecipe, AllResourceAlchemyTagId, UserAlchemyAtlas } from "~/shared/types/gameAlchemy";

import { increaseItemCount, decreaseItemCount, getItemCount, invalidateInventoryCache } from './characterInventory'
import { getCharacterStatusInfo } from './characterStatus'

import allAlchemyRecipesJson from "~/assets/resource/allAlchemyRecipes.json"
import { type ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { allGameResource, allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { convertItemCountInfoToDecrease } from "~/shared/utils/game/requirementCheck";
import { clone, ObjectKeysTyped, randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import type { AllBaseCharacterStatusType, CharacterEquipmentInfo, CharacterStatusImprove } from "~/shared/types/characterInfo";
import type { PrismaTx } from "~/shared/types/socket/db";
import { redisClient }  from "../redis"
import { prisma } from "../prisma";

const allAlchemyRecipes: Record<string, AlchemyRecipe[]> = allAlchemyRecipesJson as unknown as Record<string, AlchemyRecipe[]>;


let userAlchemyAtlasKey = "AlchemyAtlas:"
const getUserAlchemyAtlasKey = (userUuid: string) => {
    return `${userAlchemyAtlasKey}${userUuid}`
}

export async function doAlchemy(userUuid: string, input: ItemCountInfo, opt: {
  userEquipment: CharacterEquipmentInfo
}) {
  const res = fromInputToRecipe(input);

  // 返回失败状态
  if (!res.matched) {
    throw new Error("无法识别的炼金配方(1)");
  }
  if (!res.matched.recipe) {
    throw new Error("无法识别的炼金配方(2)");
  }

  if (!res.matched.executionCount) {
    throw new Error("无法识别的炼金配方(3)");
  }
  if (res.matched.executionCount < 0) {
    throw new Error("无法识别的炼金配方(4)");
  }

  let usedItems = res.matched.consumedInputs;
  let rewardTimes = res.matched.executionCount;

  let hasEnoughItems = true;

  for(const [id, count] of Object.entries(usedItems)) {
    if (!count) {
      continue;
    }

    let itemCountInInventory = await getItemCount(userUuid, id);

    if (itemCountInInventory < count.count) {
      hasEnoughItems = false;
      break;
    }
  }
  if (!hasEnoughItems) {
    throw new Error("物品数量不足，此次炼金已取消")
  }

  let recipe = res.matched.recipe;
  let recipeIndex = res.matched.recipeIndex;

  return await prisma.$transaction(async tx => {
    let {unlockParam, usedItems: newUsedItems, rewardItems, successCount, mutationCount} = await procRecipeToReward(userUuid, recipe, usedItems, rewardTimes, tx, {
      userEquipment: opt.userEquipment
    })
    let atlas = await unlockUserAlchemyAtlas(userUuid, recipe.recipeId, recipeIndex, unlockParam, tx)

    return {
      atlas,
      usedItems: newUsedItems,
      rewardItems,
      rewardTimes,
      successCount, mutationCount,
      expectMainOutput: recipe.mainOutputResourceId,
      recipeIndex,
    }
  })
}

export async function procRecipeToReward(
  userUuid: string,
  recipe: AlchemyRecipe,
  usedItem: ItemCountInfo,
  rewardTimes: number,
  tx: PrismaTx,
  opt: {
    userEquipment: CharacterEquipmentInfo
  }
) {
  let characterStatusInfo = await getCharacterStatusInfo(userUuid);
  let matchStatusRequire = ObjectKeysTyped(recipe.minSuccessStatusLevel).every(
    (k) => {
      const requiredStatusLevel = recipe.minSuccessStatusLevel[k];
      const characterThisStatusLevel = characterStatusInfo[k].final ?? characterStatusInfo[k].level ?? 0;

      if (!requiredStatusLevel) {
        return true;
      }

      return characterThisStatusLevel >= requiredStatusLevel;
    }
  );

  const dateNowStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
  });
  const dateHour = new Date(dateNowStr).getHours();
  const isNight = dateHour >= 18 || dateHour < 6;

  let increaseItems: ItemCountInfo = {};
  let expReward: {[key in AllBaseCharacterStatusType]?: number} = {}
  let unlockParam: AlchemyAtlasUnlockParam = {};

  let successCount = 0;
  let failedCount = 0;
  let mutationCount = 0;

  for (let i = 0; i < rewardTimes; i++) {
    let baseSuccessChance = recipe.baseSuccessChance;
    let percent = randomNumberInFullColseRange(0, 1);
    let mutationPercent = randomNumberInFullColseRange(0, 1);

    let alchemySuccess = true;
    let mutation = false;

    if (!baseSuccessChance) {
      alchemySuccess = false;
    } else if (percent > baseSuccessChance) {
      alchemySuccess = false;
    } else if (!matchStatusRequire) {
      alchemySuccess = false;
    }

    let rewards: AlchemyOutputSpec[] = [];

    let mutationPercentWhenNight = recipe.mutationPercentWhenNight;
    let mutationPercentWhenDay = recipe.mutationPercentWhenDay;

    let extraMutationPercentFromEquipment = 0;
    for(const equipId of Object.values(opt.userEquipment)) {
      if (!equipId) continue;

      let resource = allGameResourceWithInternal[equipId];

      for(const onEquip of resource.onEquip ?? []) {
        if (onEquip.alchemyModify?.mutationPercentIncrease) {
          extraMutationPercentFromEquipment += onEquip.alchemyModify.mutationPercentIncrease;
        }
      }
    }

    mutationPercentWhenDay += extraMutationPercentFromEquipment;
    mutationPercentWhenNight += extraMutationPercentFromEquipment;

    if (isNight) {
      if (alchemySuccess) {
        rewards = recipe.outputsOnSuccessWhenNight;
        unlockParam.unlockOutputsOnSuccessWhenNight = true;

        if (mutationPercent < mutationPercentWhenNight) {
          rewards = recipe.outputsOnMutationWhenNight;
          unlockParam.unlockOutputsOnMutationWhenNight = true;
          mutation = true;
        }
      } else {
        rewards = recipe.outputsOnFailWhenNight;
        unlockParam.unlockOutputsOnFailWhenNight = true;
      }
    } else {
      if (alchemySuccess) {
        rewards = recipe.outputsOnSuccessWhenDay;
        unlockParam.unlockOutputsOnSuccessWhenDay = true;

        if (mutationPercent < mutationPercentWhenDay) {
          rewards = recipe.outputsOnMutationWhenDay;
          unlockParam.unlockOutputsOnMutationWhenDay = true;
          mutation = true;
        }
      } else {
        rewards = recipe.outputsOnFailWhenDay;
        unlockParam.unlockOutputsOnFailWhenDay = true;
      }
    }

    for (const reward of rewards) {
      let rewardPercent = reward.percent;
      if (randomNumberInFullColseRange(0, 1) > rewardPercent) {
        continue;
      }

      let rewardItemId = reward.id;
      if (!increaseItems[rewardItemId]) {
        increaseItems[rewardItemId] = {
          count: 0,
        };
      }

      increaseItems[rewardItemId].count += randomIntegerInFullCloseRange(
        reward.range
      );

      // expReward
    }

    ObjectKeysTyped(recipe.expReward).forEach((k) => {
      if (!expReward[k]) {
        expReward[k] = 0;
      }

      expReward[k] += recipe.expReward[k] || 0;
    });

    if (alchemySuccess) {
      successCount++;
    } else {
      failedCount++
    }
    if (mutation) {
      mutationCount++;
    }
  }

  await decreaseItemCount(
    userUuid,
    usedItem,
    {
      type: ModifyItemCountType.Alchemy,
      actionName: "炼金消耗",
      showModifyInfo: true,
      sendModifyEvent: true,
    },
    tx
  );
  await increaseItemCount(
    userUuid,
    increaseItems,
    {
      type: ModifyItemCountType.Alchemy,
      actionName: "炼金产出",
      showModifyInfo: true,
      sendModifyEvent: true,
    },
    tx
  );
  await invalidateInventoryCache(userUuid);

  let expRewardList: CharacterStatusImprove[] = []
  ObjectKeysTyped(expReward).forEach(k => {
    let exp = expReward[k] ?? 0;
    if (!exp) {
      return;
    }

    expRewardList.push({
      status: k,
      increaseExp: exp
    })
  })
  // 测试期间不提供经验
  // await increaseCharacterStatusExp(userUuid, expRewardList, tx);

  return {
    successCount,
    mutationCount,
    unlockParam,
    usedItems: usedItem,
    rewardItems: increaseItems,
  }
}

export function fromInputToRecipe(input: ItemCountInfo, consumedOut?: ItemCountInfo) {
  /**
   * 根据玩家输入的 ItemCountInfo 匹配最合适的配方，并计算在该配方下最大可执行次数与剩余材料。
   *
   * 优化点：
   * 1) 支持标签内多个 tag 的 AND 逻辑，例如 "(air,glass)" 要求某个物品同时拥有 air 与 glass 两个 tag。
   * 2) 若存在完全由具体资源 id（非标签）匹配并满足的配方，则优先选择不含标签的配方。
   *
   * 其它说明同之前版本：
   * - consumedOut?: 可选参数，函数会把实际被消耗的资源写入该对象（覆盖原内容）。
   * - 返回 matched（包括 executionCount / leftoverInputs / consumedInputs）与候选列表。
   */

  type Candidate = {
    mainOutputResourceId: string
    recipeIndex: number
    recipe: AlchemyRecipe
    matchCount: number
    totalRequiredCount: number
    extraInputCount: number
    score: number
  };

  const candidates: Candidate[] = [];
  const inputKeys = Object.keys(input);

  /**
   * 解析 tag key：支持 "(t1,t2)" 或 "(t1)" 等，返回 string[]（trim 后）
   */
  const parseTagList = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean);

  /**
   * providedCountForRequirement(reqKey, remainingMap?)
   * - 若 reqKey 为 "(tag或者tag1,tag2)"，统计所有输入中同时包含所有 tag 的数量（基于 remainingMap 或原始 input）
   * - 否则返回对应具体 id 的数量
   */
  const providedCountForRequirement = (reqKey: string, remainingMap?: Record<string, number>) => {
    if (reqKey.startsWith("(") && reqKey.endsWith(")")) {
      const tagList = parseTagList(reqKey.slice(1, -1)) as AllResourceAlchemyTagId[];
      let sum = 0;
      for (const inKey of inputKeys) {
        const provided = remainingMap ? (remainingMap[inKey] ?? 0) : (input[inKey]?.count ?? 0);
        const resource = allGameResourceWithInternal[inKey];
        const tags: string[] = resource?.alchemyTag ?? [];
        // 必须同时包含 tagList 中的所有 tag（AND 关系）
        const ok = tagList.every(t => tags && tags.includes(t));
        if (ok) sum += provided;
      }
      return sum;
    } else {
      return remainingMap ? (remainingMap[reqKey] ?? 0) : (input[reqKey]?.count ?? 0);
    }
  };

  /**
   * 判断某个具体输入资源 id 是否能满足 reqKey（支持多 tag 的 AND）
   */
  const inputResourceMatchesRequirement = (inputResourceId: string, reqKey: string) => {
    if (reqKey.startsWith("(") && reqKey.endsWith(")")) {
      const tagList = parseTagList(reqKey.slice(1, -1));
      const resource = (allGameResourceWithInternal as any)[inputResourceId];
      const tags: string[] = resource?.alchemyTag ?? [];
      return tagList.every(t => tags && tags.includes(t));
    } else {
      return inputResourceId === reqKey;
    }
  };

  // 遍历所有配方变体，筛选候选
  for (const mainOutputResourceId of Object.keys(allAlchemyRecipes)) {
    const variants = allAlchemyRecipes[mainOutputResourceId] || [];
    for (let i = 0; i < variants.length; i++) {
      const recipe = variants[i];
      const reqInputs: ItemCountInfo = recipe.inputs || {};
      const reqKeys = Object.keys(reqInputs);

      let ok = true;
      let matchCount = 0;
      let totalRequiredCount = 0;
      for (const rk of reqKeys) {
        const required = reqInputs[rk]?.count ?? 0;
        totalRequiredCount += required;
        const provided = providedCountForRequirement(rk);
        if (required > 0) {
          if (provided >= required) matchCount++;
          else {
            ok = false;
            break;
          }
        } else {
          matchCount++;
        }
      }
      if (!ok) continue;

      // 记录哪些输入种类可被此配方使用（用于计算未被使用的输入种类数）
      const usedInputResourceIds = new Set<string>();
      for (const rk of reqKeys) {
        for (const inKey of inputKeys) {
          if (inputResourceMatchesRequirement(inKey, rk)) usedInputResourceIds.add(inKey);
        }
      }
      const extraInputCount = inputKeys.filter(k => !usedInputResourceIds.has(k)).length;

      const score = matchCount * 1000 + totalRequiredCount - extraInputCount * 10;

      candidates.push({
        mainOutputResourceId,
        recipeIndex: i,
        recipe,
        matchCount,
        totalRequiredCount,
        extraInputCount,
        score,
      });
    }
  }

  // 如果存在完全由具体 id（不含任何标签 reqKey）满足的配方，优先在这些配方中选最优
  const nonTagCandidates = candidates.filter(c => {
    const reqKeys = Object.keys(c.recipe.inputs || {});
    return reqKeys.every(k => !(k.startsWith("(") && k.endsWith(")")));
  });

  let best: Candidate | null = null;
  if (nonTagCandidates.length > 0) {
    // 从 non-tag candidates 中取最高 score（若并列按 totalRequiredCount）
    nonTagCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.totalRequiredCount !== a.totalRequiredCount) return b.totalRequiredCount - a.totalRequiredCount;
      return a.extraInputCount - b.extraInputCount;
    });
    best = nonTagCandidates[0];
  } else {
    // 否则从全部候选中选最优
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.totalRequiredCount !== a.totalRequiredCount) return b.totalRequiredCount - a.totalRequiredCount;
      return a.extraInputCount - b.extraInputCount;
    });
    best = candidates.length > 0 ? candidates[0] : null;
  }

  if (!best) {
    // 若未匹配，确保 consumedOut 被置为空（若传入）
    if (consumedOut) {
      for (const k of Object.keys(consumedOut)) delete consumedOut[k];
    }
    return {
      matched: null,
      candidates: candidates.map((c) => ({
        mainOutputResourceId: c.mainOutputResourceId,
        recipeIndex: c.recipeIndex,
        matchCount: c.matchCount,
        totalRequiredCount: c.totalRequiredCount,
        extraInputCount: c.extraInputCount,
        score: c.score,
      })),
    };
  }

  const recipe = best.recipe;
  const reqInputs: ItemCountInfo = recipe.inputs || {};
  const reqKeys = Object.keys(reqInputs);

  if (reqKeys.length === 0) {
    // 不消耗任何材料——不做批量执行
    if (consumedOut) {
      for (const k of Object.keys(consumedOut)) delete consumedOut[k];
    }
    return {
      matched: {
        mainOutputResourceId: best.mainOutputResourceId,
        recipeIndex: best.recipeIndex,
        recipe: best.recipe,
        executionCount: 0,
        leftoverInputs: { ...input },
        consumedInputs: {},
      },
      candidates: candidates.map((c) => ({
        mainOutputResourceId: c.mainOutputResourceId,
        recipeIndex: c.recipeIndex,
        matchCount: c.matchCount,
        totalRequiredCount: c.totalRequiredCount,
        extraInputCount: c.extraInputCount,
        score: c.score,
      })),
    };
  }

  // remaining map（resourceId -> 剩余数量）
  const remaining: Record<string, number> = {};
  for (const k of inputKeys) remaining[k] = input[k]?.count ?? 0;

  /**
   * consumeForRequirement(reqKey, required, remainingMap)
   * - 在 remainingMap 上尝试消耗所需数量，成功则修改 remainingMap 并返回 true，失败返回 false
   * - 对于标签需求，会优先按 inputKeys 的顺序（已排序）从匹配的资源中依次扣除
   * - 支持多 tag 的 AND 逻辑
   */
  const consumeForRequirement = (reqKey: string, required: number, remainingMap: Record<string, number>): boolean => {
    if (required <= 0) return true;
    if (reqKey.startsWith("(") && reqKey.endsWith(")")) {
      const tagList = parseTagList(reqKey.slice(1, -1));
      const matchingIds = inputKeys
        .filter(id => {
          const res = (allGameResourceWithInternal as any)[id];
          const tags: string[] = res?.alchemyTag ?? [];
          // 需要同时拥有所有 tag
          const ok = tagList.every(t => tags && tags.includes(t));
          return ok && (remainingMap[id] ?? 0) > 0;
        })
        .sort();
      let need = required;
      for (const id of matchingIds) {
        const avail = remainingMap[id] ?? 0;
        const take = Math.min(avail, need);
        remainingMap[id] = avail - take;
        need -= take;
        if (need <= 0) break;
      }
      return need <= 0;
    } else {
      const avail = remainingMap[reqKey] ?? 0;
      if (avail >= required) {
        remainingMap[reqKey] = avail - required;
        return true;
      }
      return false;
    }
  };

  // 计算可执行次数（在 tempRemaining 上做预检）
  let executionCount = 0;
  while (true) {
    const tempRemaining = { ...remaining };
    let ok = true;
    for (const rk of reqKeys) {
      const required = reqInputs[rk]?.count ?? 0;
      if (!consumeForRequirement(rk, required, tempRemaining)) {
        ok = false;
        break;
      }
    }
    if (!ok) break;
    // 提交消耗
    for (const k of Object.keys(tempRemaining)) remaining[k] = tempRemaining[k];
    executionCount++;
  }

  // leftoverInputs（ItemCountInfo）
  const leftoverInputs: ItemCountInfo = {};
  for (const k of inputKeys) {
    const cnt = remaining[k] ?? 0;
    if (cnt > 0) leftoverInputs[k] = { count: cnt };
  }

  // consumedInputs = 原始输入 - leftover
  const consumedInputs: ItemCountInfo = {};
  for (const k of inputKeys) {
    const orig = input[k]?.count ?? 0;
    const left = leftoverInputs[k]?.count ?? 0;
    const consumedCnt = Math.max(0, orig - left);
    if (consumedCnt > 0) consumedInputs[k] = { count: consumedCnt };
  }

  // 如果传入 consumedOut，则写入（覆盖其内容）
  if (consumedOut) {
    for (const key of Object.keys(consumedOut)) delete consumedOut[key];
    for (const k of Object.keys(consumedInputs)) {
      consumedOut[k] = { count: consumedInputs[k]!.count };
    }
  }

  return {
    matched: {
      mainOutputResourceId: best.mainOutputResourceId,
      recipeIndex: best.recipeIndex,
      recipe: best.recipe,
      executionCount,
      leftoverInputs,
      consumedInputs,
    },
    candidates: candidates.map((c) => ({
      mainOutputResourceId: c.mainOutputResourceId,
      recipeIndex: c.recipeIndex,
      matchCount: c.matchCount,
      totalRequiredCount: c.totalRequiredCount,
      extraInputCount: c.extraInputCount,
      score: c.score,
    })),
  };
}


export async function getUserAlchemyAtlas(
  userUuid: string
): Promise<UserAlchemyAtlas> {
  let redisKey = getUserAlchemyAtlasKey(userUuid);

  const cache = await redisClient.get(redisKey);
  if (cache) {
    try {
      let res = JSON.parse(cache);

      let unlockedIndex = 0;
      for (const recipe of Object.keys(allAlchemyRecipes)) {
        if (!res[recipe]) {
          res["ul_" + unlockedIndex++] = [];
        }
      }

      return res;
    } catch (e) {}
  }

  const userAlchemyAtlas = await getUserAlchemyAtlasFromDB(userUuid);

  // 查库后写入一份到 Redis
  await redisClient.set(redisKey, JSON.stringify(userAlchemyAtlas), {
    expiration: {
      type: "EX",
      value: 3600 * 4, // 缓存1小时
    },
  });

  return userAlchemyAtlas;
}

export async function getUserAlchemyAtlasFromDB(
  userUuid: string,
  tx?: PrismaTx
): Promise<UserAlchemyAtlas> {
  if (!tx) {
    tx = prisma;
  }

  const userAlchemyAtlas = await tx.alchemyAtlas.findMany({
    where: {
      userUuid: userUuid,
    },
  });

  let res: Record<string, AlchemyAtlasEntry[]> = {};

  for (const atlasUnlockInfo of userAlchemyAtlas) {
    const recipeId = atlasUnlockInfo.recipeId;
    const thisRecipeIndex = atlasUnlockInfo.recipeIndex;

    if (!res[recipeId]) {
      if (!allAlchemyRecipes[recipeId]?.length) {
        continue
      }

      res[recipeId] = new Array(allAlchemyRecipes[recipeId].length);
    }

    let recipe = allAlchemyRecipes[recipeId]?.[thisRecipeIndex];

    if (!recipe) {
      continue;
    }

    res[recipeId][thisRecipeIndex] = {
      recipeId,
      mainOutputResourceId: recipe.mainOutputResourceId,
      thisRecipeIndex,

      inputs: recipe.inputs,

      baseDurationSeconds: recipe.baseDurationSeconds,
      baseSuccessChance: recipe.baseSuccessChance,

      minSuccessStatusLevel: recipe.minSuccessStatusLevel,

      outputsOnSuccessWhenDay: atlasUnlockInfo.unlockOutputsOnSuccessWhenDay
        ? recipe.outputsOnSuccessWhenDay
        : undefined,
      outputsOnFailWhenDay: atlasUnlockInfo.unlockOutputsOnFailWhenDay
        ? recipe.outputsOnFailWhenDay
        : undefined,
      outputsOnSuccessWhenNight: atlasUnlockInfo.unlockOutputsOnSuccessWhenNight
        ? recipe.outputsOnSuccessWhenNight
        : undefined,
      outputsOnFailWhenNight: atlasUnlockInfo.unlockOutputsOnFailWhenNight
        ? recipe.outputsOnFailWhenNight
        : undefined,

      mutationPercentWhenDay: atlasUnlockInfo.unlockOutputsOnMutationWhenDay
        ? recipe.mutationPercentWhenDay
        : undefined,
      mutationPercentWhenNight: atlasUnlockInfo.unlockOutputsOnMutationWhenNight
        ? recipe.mutationPercentWhenNight
        : undefined,
      outputsOnMutationWhenDay: atlasUnlockInfo.unlockOutputsOnMutationWhenDay
        ? recipe.outputsOnMutationWhenDay
        : undefined,
      outputsOnMutationWhenNight:
        atlasUnlockInfo.unlockOutputsOnMutationWhenNight
          ? recipe.outputsOnMutationWhenNight
          : undefined,

      expReward: recipe.expReward,
    };
  }

  let unlockedIndex = 0;
  for(const recipe of Object.keys(allAlchemyRecipes)) {
    if (!res[recipe]) {
      res['ul_' + unlockedIndex++] = [];
    }
  }

  for(const recipeId of Object.keys(allAlchemyRecipes)) {
    const variants = allAlchemyRecipes[recipeId] || [];
    for(let i = 0; i < variants.length; i++) {
      const recipe = variants[i];

      if (recipe.alwaysReveal) {
        if (!res[recipeId]) {
          res[recipeId] = new Array(variants.length);
        }

        const recipeIndex = variants.indexOf(recipe);
        if (res[recipeId][recipeIndex]) {
          continue;
        }

        res[recipeId][recipeIndex] = {
          recipeId,
          mainOutputResourceId: recipe.mainOutputResourceId,
          thisRecipeIndex: recipeIndex,

          inputs: recipe.inputs,

          baseDurationSeconds: recipe.baseDurationSeconds,
          baseSuccessChance: recipe.baseSuccessChance,

          minSuccessStatusLevel: recipe.minSuccessStatusLevel,

          outputsOnSuccessWhenDay: recipe.outputsOnSuccessWhenDay,
          outputsOnFailWhenDay: recipe.outputsOnFailWhenDay,
          outputsOnSuccessWhenNight: recipe.outputsOnSuccessWhenNight,
          outputsOnFailWhenNight: recipe.outputsOnFailWhenNight,

          mutationPercentWhenDay: recipe.mutationPercentWhenDay,
          mutationPercentWhenNight: recipe.mutationPercentWhenNight,
          outputsOnMutationWhenDay: recipe.outputsOnMutationWhenDay,
          outputsOnMutationWhenNight: recipe.outputsOnMutationWhenNight,

          expReward: recipe.expReward,
        }
      }
    }
  }

  return res;
}

type AlchemyAtlasUnlockParam = {
    unlockOutputsOnSuccessWhenDay?: boolean;
    unlockOutputsOnFailWhenDay?: boolean;
    unlockOutputsOnSuccessWhenNight?: boolean;
    unlockOutputsOnFailWhenNight?: boolean;
    unlockOutputsOnMutationWhenDay?: boolean;
    unlockOutputsOnMutationWhenNight?: boolean;
}
export async function unlockUserAlchemyAtlas(userUuid: string, recipeId: string, thisRecipeIndex: number, opt: AlchemyAtlasUnlockParam, tx: PrismaTx): Promise<UserAlchemyAtlas> {
  if (!tx) {
    tx = prisma
  }

  await tx.alchemyAtlas.upsert({
    where: {
        alchemy_unique: {
            userUuid,
            recipeId,
            recipeIndex: thisRecipeIndex,
        }
    },
    create: {
        userUuid,
        recipeId,
        recipeIndex: thisRecipeIndex,

        ...opt,
    },
    update: {
        ...opt,
    }
  })

  return await refreshUserAlchemyAtlas(userUuid, tx);
}

export async function refreshUserAlchemyAtlas(userUuid: string, tx?: PrismaTx): Promise<UserAlchemyAtlas> {
  if (!tx) {
    tx = prisma;
  }

  let redisKey = getUserAlchemyAtlasKey(userUuid);
  const userAlchemyAtlas = await getUserAlchemyAtlasFromDB(userUuid, tx);

  // 查库后写入一份到 Redis
  await redisClient.set(redisKey, JSON.stringify(userAlchemyAtlas), {
    expiration: {
      type: "EX",
      value: 3600 * 4, // 缓存1小时
    },
  });

  return userAlchemyAtlas
}

export async function invalidUserAlchemyAtlas(userUuid: string) {
  let redisKey = getUserAlchemyAtlasKey(userUuid);
  await redisClient.del(redisKey);
}