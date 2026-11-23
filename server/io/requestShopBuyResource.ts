import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import {
  AllGameResourceID,
  GameResourceTradeEvent,
} from "~/shared/types/gameResource";
import { allGameResource } from "~/shared/data/allGameResources";
import {
  decreaseItemCount,
  dispatchInventoryInfoToClient,
  getInventoryInfo,
  increaseItemCount,
} from "../utils/game/characterInventory";
import {
  ItemCountInfo,
  ModifyItemCountType,
} from "~/shared/types/gameInventory";
import { prisma } from "../utils/game/db";
import { emitEventToUser } from ".";
import { dispatchShopBuySuccess } from "../utils/game/trade";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  { user, data }: GameSocketData<GameResourceTradeEvent>
) {
  if (!user || !data || !data.id || !data.count) {
    emitEventToUser(user, "requestShopBuyResource:fail", {
      message: "参数错误",
    });
    return;
  }

  const buyResourceInfo = allGameResource[data.id];
  const tradeCount = data.count;

  // 检查tradeCount是否为整数、且不是科学计数法
  if (!Number.isInteger(tradeCount) || tradeCount.toString().includes("e")) {
    emitEventToUser(user.uuid, "requestShopBuyResource:fail", {
      message: "购买数量异常",
    });
    return;
  }

  if (tradeCount <= 0 || tradeCount > 100000000) {
    emitEventToUser(user.uuid, "requestShopBuyResource:fail", {
      message: "购买数量异常",
    });
    return;
  }

  if (!buyResourceInfo || !buyResourceInfo.userBuyCost || !tradeCount) {
    emitEventToUser(user, "requestShopBuyResource:fail", {
      message: "参数错误",
    });
    return;
  }

  return withUniqueLock("shopBuyResource:" + user.uuid, async () => {
    return prisma.$transaction(async (tx) => {
      const inventoryInfo = await getInventoryInfo(user.uuid, tx);

      let buyCost: ItemCountInfo = {};

      for (const cost of buyResourceInfo.userBuyCost!) {
        const costResourceId = cost.cost ?? "gold";
        const costResourceInventoryInfo = inventoryInfo[costResourceId];

        // 某一项购买需要的资源没有，直接返回
        if (!costResourceInventoryInfo) {
          emitEventToUser(user.uuid, "requestShopBuyResource:fail", {
            message: `库存不足`,
          });
          return;
        }

        const inventoryCount = costResourceInventoryInfo.count ?? 0;
        if (inventoryCount < cost.count * tradeCount) {
          emitEventToUser(user.uuid, "requestShopBuyResource:fail", {
            message: `库存不足`,
          });
          return;
        }

        buyCost[costResourceId] = {
          count: cost.count * tradeCount,
        };
      }

      if (!Object.keys(buyCost).length) {
        emitEventToUser(user.uuid, "requestShopBuyResource:fail", {
          message: "库存不足",
        });
        return;
      }

      // 给出交易需要的标的
      await decreaseItemCount(
        user.uuid,
        buyCost,
        {
          actionName: `商店购买 ${buyResourceInfo.name}`,
          type: ModifyItemCountType.Market,
          showModifyInfo: true,
          sendModifyEvent: true,
        },
        tx
      );

      // 获得交易目标资源
      const getItemInfo: ItemCountInfo = {};
      getItemInfo[buyResourceInfo.id] = {
        count: tradeCount,
      };
      await increaseItemCount(
        user.uuid,
        getItemInfo,
        {
          actionName: `商店购买 ${buyResourceInfo.name}`,
          type: ModifyItemCountType.Market,
          showModifyInfo: true,
          sendModifyEvent: true,
        },
        tx
      );

      await invalidateInventoryCache(user.uuid);

      // // 获取最新库存信息
      const latestInventoryInfo = await getInventoryInfo(user.uuid, tx);
      dispatchShopBuySuccess(user.uuid, getItemInfo, latestInventoryInfo);
      // dispatchInventoryInfoToClient(user.uuid);

      return true
    });
  });
}
