// @ts-nocheck

import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { AllGameResourceID, GameResourceTradeEvent } from "~/shared/types/gameResource";
import { allGameResource } from "~/shared/data/allGameResources";
import {
  decreaseItemCount,
  getInventoryInfo,
  increaseItemCount,
} from "../utils/game/characterInventory";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { dispatchShopBuySuccess } from "../utils/game/trade";
import { calcSellCost } from "~/shared/utils/game/trade";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  { user, data }: GameSocketData<GameResourceTradeEvent>
) {
  await withUniqueLock(`shop-sell-resource-${user.uuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      const inventoryInfo = await getInventoryInfo(user.uuid, tx);

      const sellResourceInfo = allGameResource[data.id];

      const tradeCount = data.count;

      // 没有出售信息的情况
      if (!sellResourceInfo || !sellResourceInfo.userSellCost || !tradeCount) {
        throw new Error("没有出售信息");
      }

      if (!Number.isInteger(tradeCount) || tradeCount <= 0 || tradeCount > 100000000) {
        throw new Error("出售数量异常");
      }

      // 检查待出售物品的库存
      const thisResourceInventoryInfo = inventoryInfo[data.id];

      // 被出售的物品，库存不足，取消交易
      if (
        !thisResourceInventoryInfo ||
        thisResourceInventoryInfo.count < tradeCount
      ) {
        throw new Error("库存不足，无法出售");
      }

      // 售卖物品所得
      let sellGain: ItemCountInfo = {}
      for (let i = 0; i < sellResourceInfo.userSellCost.length; i++) {
        const thisSellGain = sellResourceInfo.userSellCost[i]

        const resourceId = thisSellGain.cost ?? 'gold';
        const count = thisSellGain.count;

        if (typeof count !== "number" || count <= 0 || !Number.isInteger(count)) {
          throw new Error("出售配置异常");
        }

        if (count <= 0) {
          continue;
        }

        if (!sellGain[resourceId]) {
          sellGain[resourceId] = {
            count: 0,
          }
        }

        sellGain[resourceId].count += count * tradeCount
      }


      if (!sellGain) {
        throw new Error("无法计算出售收益");
      }

      // 给出交易需要的标的
      await increaseItemCount(user.uuid, sellGain, {
        actionName: "商店出售获得",
        type: ModifyItemCountType.Market,
        showModifyInfo: true,
        sendModifyEvent: true,
      }, tx);

      // 获得交易目标资源
      const sellItemInfo: ItemCountInfo = {};
      sellItemInfo[sellResourceInfo.id] = {
        count: tradeCount,
      };
      await decreaseItemCount(user.uuid, sellItemInfo, {
        actionName: "商店出售减少",
        type: ModifyItemCountType.Market,
        showModifyInfo: true,
        sendModifyEvent: true,
      }, tx);

      await invalidateInventoryCache(user.uuid);


      // 获取最新库存信息
      const latestInventoryInfo = await getInventoryInfoPreferCache(user.uuid);
      await dispatchShopSellSuccess(user.uuid);
    });
  });
}
