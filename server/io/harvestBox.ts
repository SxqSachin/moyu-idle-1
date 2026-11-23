import type { Socket, DefaultEventsMap } from "socket.io";
import { emitEventToUser } from ".";
import type { GameSocketData } from "~/shared/types/socket";
import type {
  ReqHarvestBoxList,
  ReqHarvestBoxClaim,
  ReqHarvestBoxClaimItem,
  HarvestBoxListItemDTO,
  HarvestBoxItemDTO,
} from "~/shared/types/harvestBox";
import { listHarvestBoxes, claimHarvestBox, claimHarvestBoxItem, toDTO } from "../utils/game/harvestBox";
import { claimAllHarvestBoxes, dispatchHarvestBoxListToUser } from "../utils/game/harvestBox";

export async function handleHarvestBoxList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqHarvestBoxList>
) {
  const userUuid = data.user.uuid;
  try {
    const raw = (data.data || {}) as any;
    const includeClaimed = typeof raw.includeClaimed === "boolean" ? raw.includeClaimed : false;
    let take: number | undefined = 5; // 首页默认仅取前5条
    if (raw.take !== undefined) {
      const n = Number(raw.take);
      if (Number.isFinite(n)) {
        take = Math.max(1, Math.min(100, Math.floor(n)));
      }
    }
    const beforeId = raw.beforeId && Number.isFinite(raw.beforeId) ? Number(raw.beforeId) : undefined;
    const list = await listHarvestBoxes({ userUuid, includeClaimed, take, beforeId });
    emitEventToUser(userUuid, "harvestBox:list:success", { list: toDTO(list), hasMore: list.hasMore, nextCursor: list.nextCursor });
  } catch (e: any) {
    emitEventToUser(userUuid, "harvestBox:list:fail", { msg: e?.message || "查询失败" });
  }
}

export async function handleHarvestBoxClaim(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqHarvestBoxClaim>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`harvestBox:claim:${userUuid}`, async () => {
    try {
      const { boxId } = (data.data || {}) as any;
      if (!Number.isFinite(boxId) || typeof boxId !== "number" || boxId <= 0) {
        emitEventToUser(userUuid, "harvestBox:claim:fail", { msg: "参数不合法" });
        return;
      }
      const res = await claimHarvestBox(boxId, userUuid);
      emitEventToUser(userUuid, "harvestBox:claim:success", res);
    } catch (e: any) {
      emitEventToUser(userUuid, "harvestBox:claim:fail", { msg: e?.message || "领取失败" });
    }
  });
}

export async function handleHarvestBoxClaimItem(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ReqHarvestBoxClaimItem>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`harvestBox:claim:${userUuid}`, async () => {
    try {
      const { itemId } = (data.data || {}) as any;
      if (!Number.isFinite(itemId) || typeof itemId !== "number" || itemId <= 0) {
        emitEventToUser(userUuid, "harvestBox:claimItem:fail", { msg: "参数不合法" });
        return;
      }
      const res = await claimHarvestBoxItem(itemId, userUuid);
      emitEventToUser(userUuid, "harvestBox:claimItem:success", res);
    } catch (e: any) {
      emitEventToUser(userUuid, "harvestBox:claimItem:fail", { msg: e?.message || "领取失败" });
    }
  })
}

export async function handleHarvestBoxClaimAll(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`harvestBox:claim:${userUuid}`, async () => {
    try {
      const res = await claimAllHarvestBoxes(userUuid)
      emitEventToUser(userUuid, "harvestBox:claimAll:success", res);
      await dispatchHarvestBoxListToUser(userUuid)
    } catch (e: any) {
      emitEventToUser(userUuid, "harvestBox:claimAll:fail", { msg: e?.message || "领取失败" });
    }
  })
}
