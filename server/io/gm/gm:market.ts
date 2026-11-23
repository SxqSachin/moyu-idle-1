import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { GMRestockMarketInput } from "~/shared/types/gm";
import { safeJsonParse } from "~/shared/utils";
import { allGameResource } from "~/shared/data/allGameResources";

const checkGmAction = async (userUuid: string, bearer: string) => {
    const required = process.env.GM_ACTION_BEARER;
    if (!required || bearer !== required) {
        return false
    }

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
         return false;
    }

    return true
}

export async function handleGetGMRestockMarketInfo(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ bearer: string }>
) {
  const userUuid = data.user.uuid;
  const { bearer } = data.data;

  let isGm = await checkGmAction(userUuid, bearer);
  if (!isGm) {
    emitEventToUser(userUuid, "gmcheck:fail", { message: "操作失败" });
    return;
  }

  const str = await redisClient.get("gm:marketRestock");

  const res = safeJsonParse(str);

  // 通知GM操作成功
  emitEventToUser(userUuid, "aonrevoi:info:success", { res });
}

export async function handleGMRestockMarket(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ info: GMRestockMarketInput[], bearer: string }>
) {
    const userUuid = data.user.uuid;
    const { info, bearer } = data.data;

    let isGm = await checkGmAction(userUuid, bearer)
    if (!isGm) {
        emitEventToUser(userUuid, "gmcheck:fail", { message: "操作失败" });
        return;
    }

    const actInfo: GMRestockMarketInput[] = []
    for(const restockInfo of info) {
        const resource = allGameResource[restockInfo.resourceId];
        if (!resource) {
            continue;
        }

        if (resource.hideInMarket || resource.hideInShop) {
            continue;
        }

        actInfo.push(restockInfo);
    }

    await redisClient.set("gm:marketRestock", JSON.stringify(actInfo))

    // 通知GM操作成功
    emitEventToUser(userUuid, "aonrevoi:update:success");

    // for(const restockInfo of info) {
    //     const { resourceId, count, cost } = restockInfo;

    //     // 处理每个补货请求
    //     // 例如：增加物品数量、更新数据库等

    //     const actCount = randomIntegerInFullCloseRange(count)
    //     const actCost = randomIntegerInFullCloseRange(cost)

    //     await increaseItemCount(userUuid, {
    //         [resourceId]: {
    //             count: actCount,
    //         }
    //     })

    //     await listToMarket({
    //         sellResourceId: resourceId,
    //         sellResourceCount: actCount,

    //         costResourceId: 'gold',
    //         costPerUnit: actCost
    //     }, userUuid);
    // }

}
