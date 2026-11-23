import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type {
  GameResource,
  GameResourceTradeEvent,
} from "~/shared/types/gameResource";

export function calcSingleSellCost(
  resourceInfo: GameResource,
  tradeCount: number,
  index: number
): ItemCountInfo | null {
  if (!resourceInfo.userSellCost) {
    return null;
  }

  let sellGain: ItemCountInfo | null = null;

  const thisSellResourceInfo = resourceInfo.userSellCost[index];
  let sellResourceId = thisSellResourceInfo.cost;
  let sellResourceCount = thisSellResourceInfo.count;

  // 最简单的情况，提供了售卖可以获得的资源id与数量
  if (
    sellResourceId &&
    typeof sellResourceCount == "number" &&
    sellResourceCount > 0
  ) {
    sellGain ??= {};
    sellGain[sellResourceId] = {
      count: sellResourceCount * tradeCount,
    };

    return sellGain;
  }

  // 获取对应下标的购买信息
  let pairBuyInfo = resourceInfo.userBuyCost?.[index];

  // 如果没有提供资源id，则从对应下标的购买配置中获取资源id
  if (!sellResourceId) {
    sellResourceId = pairBuyInfo?.cost;
  }

  // 如果仍然没有提供资源id，且下标==0，则直接认为是'gold'
  if (!sellResourceId && index == 0) {
    sellResourceId = "gold";
  }

  // 如果仍然没有提供资源id，且下标>0，则直接视为错误
  if (!sellResourceId) {
    return null;
  }

  // 计算数量
  if (typeof sellResourceCount == "string") {
    // 如果获取到的数量信息是基于出售信息，且没有找到对应出售信息，则视为错误
    if (!pairBuyInfo) {
      return null;
    }

    switch (sellResourceCount) {
      case "1/2":
        sellResourceCount = +(pairBuyInfo.count / 2).toFixed(0);
        break;
      case "1/3":
        sellResourceCount = +(pairBuyInfo.count / 3).toFixed(0);
        break;
      case "2/3":
        sellResourceCount = +((pairBuyInfo.count / 3) * 2).toFixed(0);
        break;
    }
  }

  // 没有实际需要出售的资源的数量 直接返回
  if (!sellResourceCount) {
    return null;
  }

  sellGain ??= {};
  sellGain[sellResourceId] = {
    count: sellResourceCount * tradeCount,
  };

  return sellGain;
}

export function calcSellCost(
  resourceInfo: GameResource,
  tradeCount: number
): ItemCountInfo | null {
  // 没有出售信息，即不可出售
  if (!resourceInfo.userSellCost) {
    return null;
  }

  let sellGain: ItemCountInfo | null = null;

  for (let i = 0; i < resourceInfo.userSellCost.length; i++) {
    sellGain ??= {}
    sellGain = {
        ...sellGain,
        ...calcSingleSellCost(resourceInfo, tradeCount, i)
    }
    
  }

  return sellGain;
}
