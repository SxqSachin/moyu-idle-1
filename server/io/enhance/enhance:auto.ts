import { DefaultEventsMap, Socket } from "socket.io"
import { AllGameResourceID, GameResourceEnhanceInfo } from "~/shared/types/gameResource"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getInventoryInfo } from "~/server/utils/game/characterInventory"
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import { prisma } from "~/server/utils/game/db"
import { v4 } from "uuid"
import { AutoEnhanceRequest, AutoEnhanceRequestResult, AutoEnhanceRequestStatus, AutoEnhanceResult } from "~/shared/types/enhance"
import { allGameResource } from "~/shared/data/allGameResources"
import { safeJsonParse } from "~/shared/utils"


const getSelectedItemCanEnhanceToItems = (selectedItemId: string) => {
  if (!selectedItemId) return [];
  const result: AllGameResourceID[] = [];
  let currentId = selectedItemId;
  // @ts-ignore
  while (enhanceInfoJson[currentId]?.enhanceSuccessTo) {
    // @ts-ignore
    const nextId = enhanceInfoJson[currentId].enhanceSuccessTo;
    result.push(nextId);
    currentId = nextId;
  }
  return result;
}

export async function requestAutoEnhance (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<AutoEnhanceRequest>
) {
  const userUuid = data.user.uuid;
  const { resourceId, protectedResourceId, repeatCount, stopWhenGetResource, startProtectedWhen } = data.data;

  await withUniqueLock("autoEnhance:" + userUuid, async () => {
    // 边界检查：参数有效性
    if (!resourceId || typeof resourceId !== "string") {
      emitEventToUser(userUuid, "enhance:auto:error", {
        msg: "缺少装备ID",
      });
      return;
    }

    if (!repeatCount && !stopWhenGetResource) {
      emitEventToUser(userUuid, "enhance:auto:error", {
        msg: "请至少设置重复次数或目标强化等级中的一项",
      });
      return;
    }

    // 检查repeatCount是否为整数
    if (repeatCount && !Number.isInteger(repeatCount)) {
      emitEventToUser(userUuid, "enhance:auto:create:error", {
        msg: "重复次数必须为整数",
      });
      return;
    }

    // 检查玩家库存
    const inventory = await getInventoryInfoPreferCache(userUuid);
    if (!inventory[resourceId] || inventory[resourceId]!.count < 1) {
      emitEventToUser(userUuid, "enhance:auto:create:error", {
        msg: "背包中至少需要有一件该装备，才能进行强化",
      });
      return;
    }

    if (protectedResourceId) {
      if (!inventory[protectedResourceId] || inventory[protectedResourceId]!.count < 1) {
        emitEventToUser(userUuid, "enhance:auto:create:error", {
          msg: "背包中至少需要有一件所选择的保护装备，才能进行保护强化",
        });
        return;
      }
    }

    // 检查是否存在未完成的强化请求
    const existingRequest = await prisma.enhanceRequire.findFirst({
      where: {
        userUuid,
        status: {
          in: ["PENDING", "PROCESSING"]
        }
      }
    });

    if (existingRequest) {
      emitEventToUser(userUuid, "enhance:auto:create:error", {
        msg: "存在进行中的自动强化，请稍后再试",
      });
      return;
    }

    // 获取强化信息
    // @ts-ignore
    const enhanceInfo = enhanceInfoJson[resourceId] as GameResourceEnhanceInfo | undefined;
    if (!enhanceInfo) {
      emitEventToUser(data.user, "enhance:auto:create:error", {
        msg: "此物品无法被强化",
      });
      return;
    }

    // 检查是否存在stopWhenGetResource，如果存在，检查是否可以从resourceId强化至stopWhenGetResource 
    if (stopWhenGetResource && !getSelectedItemCanEnhanceToItems(resourceId).includes(stopWhenGetResource)) {
      emitEventToUser(data.user, "enhance:auto:create:error", {
        msg: `无法从 ${allGameResource[resourceId].name} 强化至 ${allGameResource[stopWhenGetResource].name}`,
      });
      return;
    }

    await prisma.enhanceRequire.create({
      data: {
        uuid: v4(),
        userUuid: userUuid,
        enhanceItemId: resourceId,
        protectedResourceId,

        repeatCount,
        stopWhenGetResource,

        startProtectedWhen: startProtectedWhen + '',

        status: "PENDING",

        resultDetail: "[]",

        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // 触发自动强化事件
    emitEventToUser(userUuid, "enhance:auto:create:success", {
      msg: "自动强化请求已创建",
    })
  })
}

export async function requestAutoEnhanceHistory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  // 获取用户的所有自动强化请求历史
  const history = await prisma.enhanceRequire.findMany({
    where: {
      userUuid,
      status: {
        in: [AutoEnhanceRequestStatus.FINISHED, AutoEnhanceRequestStatus.ERROR, AutoEnhanceRequestStatus.CANCELLED,  AutoEnhanceRequestStatus.SUCCESS],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let res: AutoEnhanceRequestResult[] = history.map((item) => {
    let eachResult: AutoEnhanceResult[] = safeJsonParse(item.resultDetail ?? "[]") as AutoEnhanceResult[];

    return {
      uuid: item.uuid,

      status: item.status as AutoEnhanceRequestStatus,

      targetRepeatCount: item.repeatCount,
      targetResourceId: item.stopWhenGetResource ?? undefined,

      enhanceItemId: item.enhanceItemId,

      repeatCount: item.currentRepeatCount,

      startAt: item.createdAt,
      endAt: item.finishedAt,

      eachResult,

      allGetItems: item.allGetItems ? safeJsonParse(item.allGetItems) : {},
      allUsedItems: item.allUsedItems ? safeJsonParse(item.allUsedItems) : {},
    };
  })

  emitEventToUser(userUuid, "enhance:history:success", res);
}

export async function requestCurrentAutoEnhance(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  // 获取用户的当前自动强化请求
  const item = await prisma.enhanceRequire.findFirst({
    where: {
      userUuid,
      status: {
        in: [AutoEnhanceRequestStatus.PENDING, AutoEnhanceRequestStatus.PROCESSING],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!item) {
    emitEventToUser(userUuid, "enhance:current:success", {res: null});
    return;
  }

  let eachResult: AutoEnhanceResult[] = safeJsonParse(item.resultDetail ?? "[]") as AutoEnhanceResult[];
  let res: AutoEnhanceRequestResult = {
    uuid: item.uuid,

    status: item.status as AutoEnhanceRequestStatus,

    enhanceItemId: item.enhanceItemId,

    targetRepeatCount: item.repeatCount,
    targetResourceId: item.stopWhenGetResource ?? undefined,

    repeatCount: item.currentRepeatCount,

    startAt: item.createdAt,
    endAt: item.finishedAt,

    eachResult,
    allGetItems: item.allGetItems ? safeJsonParse(item.allGetItems) : {},
    allUsedItems: item.allUsedItems ? safeJsonParse(item.allUsedItems) : {},
  };

  emitEventToUser(userUuid, "enhance:current:success", {res});
}

export async function requestStopAutoEnhance(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string }>
) {
  const userUuid = data.user.uuid;
  const { uuid } = data.data;

  // 查找并更新自动强化请求状态
  const item = await prisma.enhanceRequire.findFirst({
    where: {
      uuid,
      userUuid,
      status: {
        in: [AutoEnhanceRequestStatus.PENDING, AutoEnhanceRequestStatus.PROCESSING],
      },
    },
  });

  if (!item) {
    emitEventToUser(userUuid, "enhance:stop:error", { msg: "未找到对应的自动强化请求" });
    return;
  }

  await prisma.enhanceRequire.update({
    where: { uuid },
    data: {
      status: AutoEnhanceRequestStatus.CANCELLED,
      updatedAt: new Date(),
      finishedAt: new Date(), // 设置完成时间为当前时间
    },
  });

  emitEventToUser(userUuid, "enhance:stop:success");
}