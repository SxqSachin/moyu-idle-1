import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import type { ReqFarmPlots, ReqUnlockPlot, ReqPlantPlot, ReqHarvestPlot, ReqToggleAutoReplant, ReqCreatePlot, ReqShovelPlot } from "~/shared/types/farming";
import { emitEventToUser } from ".";
import {
  listPlots,
  unlockPlot,
  plantPlot,
  harvestPlot,
  toggleAutoReplant,
  createPlot,
  shovelPlot,
} from "../utils/game/farming";

export async function handleGetFarmPlots(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqFarmPlots>
) {
  const userUuid = data.user.uuid;
  try {
    const area = data.data?.area;
    const res = await listPlots(userUuid, area);
    emitEventToUser(userUuid, "farm:plots:success", { list: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plots:fail", { msg: e.message || "查询失败" });
  }
}

export async function handleUnlockFarmPlot(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqUnlockPlot>
) {
  const userUuid = data.user.uuid;
  try {
    const { plotIndex, area } = data.data || ({} as any);
    if (typeof plotIndex !== 'number' || plotIndex < 0) {
      emitEventToUser(userUuid, "farm:plot:unlock:fail", { msg: "plotIndex 非法" });
      return;
    }
    const res = await unlockPlot(userUuid, { plotIndex, area });
    emitEventToUser(userUuid, "farm:plot:unlock:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:unlock:fail", { msg: e.message || "解锁失败" });
  }
}

export async function handlePlantFarmPlot(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqPlantPlot>
) {
  const userUuid = data.user.uuid;
  try {
    const {
      plotIndex,
      seedId,
      area,
      fertilizers,
    } = data.data || ({} as any);
    if (typeof plotIndex !== "number" || plotIndex < 0) {
      emitEventToUser(userUuid, "farm:plot:plant:fail", {
        msg: "plotIndex 非法",
      });
      return;
    }
    if (!seedId) {
      emitEventToUser(userUuid, "farm:plot:plant:fail", { msg: "seedId 缺失" });
      return;
    }
    const res = await plantPlot(userUuid, {
      plotIndex,
      seedId,
      area,
      fertilizers,
    });
    emitEventToUser(userUuid, "farm:plot:plant:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:plant:fail", {
      msg: e.message || "播种失败",
    });
  }
}


export async function handleHarvestFarmPlot(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqHarvestPlot>
) {
  const userUuid = data.user.uuid;
  try {
    const { plotIndex } = data.data || ({} as any);
    if (typeof plotIndex !== 'number' || plotIndex < 0) {
      emitEventToUser(userUuid, "farm:plot:harvest:fail", { msg: "plotIndex 非法" });
      return;
    }
    const res = await harvestPlot(userUuid, plotIndex);
    emitEventToUser(userUuid, "farm:plot:harvest:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:harvest:fail", { msg: e.message || "收获失败" });
  }
}

export async function handleShovelFarmPlot(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqShovelPlot>
) {
  const userUuid = data.user.uuid;
  try {
    const { plotIndex } = data.data || ({} as any);
    if (typeof plotIndex !== 'number' || plotIndex < 0) {
      emitEventToUser(userUuid, "farm:plot:shovel:fail", { msg: "plotIndex 非法" });
      return;
    }
    const res = await shovelPlot(userUuid, plotIndex);
    emitEventToUser(userUuid, "farm:plot:shovel:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:shovel:fail", { msg: e.message || "清理作物失败" });
  }
}

export async function handleToggleAutoReplant(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqToggleAutoReplant>
) {
  const userUuid = data.user.uuid;

  if (data.data.value) {
    const kittyHomeServiceCenterLevel = await prisma.villageBuilding.findUnique({
      where: {
        type: 'kittyHomeServiceCenter',
        // status: 'NORMAL',
      },
      select: {
        level: true
      }
    })

    if ((kittyHomeServiceCenterLevel?.level ?? 0) < 2) {
      emitEventToUser(userUuid, "farm:plot:autoReplant:fail", { msg: "此功能尚未解锁" });
    }
  }

  try {
    const { plotIndex, value } = data.data || ({} as any);
    if (typeof plotIndex !== 'number' || plotIndex < 0 || typeof value !== 'boolean') {
      emitEventToUser(userUuid, "farm:plot:autoReplant:fail", { msg: "参数不合法" });
      return;
    }
    const res = await toggleAutoReplant(userUuid, plotIndex, value);
    emitEventToUser(userUuid, "farm:plot:autoReplant:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:autoReplant:fail", { msg: e.message || "设置失败" });
  }
}

export async function handleCreateFarmPlot(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqCreatePlot>
) {
  const userUuid = data.user.uuid;
  try {
    const area = data.data?.area;
    const res = await createPlot(userUuid, area);
    emitEventToUser(userUuid, "farm:plot:create:success", { plot: res });
  } catch (e: any) {
    emitEventToUser(userUuid, "farm:plot:create:fail", { msg: e.message || "新建失败" });
  }
}
