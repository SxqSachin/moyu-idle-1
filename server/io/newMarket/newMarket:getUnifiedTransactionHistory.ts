import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from "..";
import { getUnifiedMarketHistoryByUser, } from "~/server/utils/game/newMarket";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ page?: number; pageSize?: number; type?: string; status?: string; resourceId?: string; resourceIds?: string[]; sortBy?: string; sortOrder?: string }>
) {
  try {
    const pageRaw = Number(data.data?.page);
    const pageSizeRaw = Number(data.data?.pageSize);
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 50;

    const type = (data.data?.type === "sell" || data.data?.type === "buy" || data.data?.type === "all")
      ? data.data.type
      : undefined;
    const status = (data.data?.status === "open" || data.data?.status === "closed" || data.data?.status === "all")
      ? data.data.status
      : undefined;
    const resourceId = typeof data.data?.resourceId === "string" ? data.data.resourceId.trim() : undefined;
    const resourceIds = Array.isArray(data.data?.resourceIds)
      ? data.data.resourceIds.filter((id) => typeof id === "string" && id.trim().length).map((id) => id.trim())
      : undefined;
    const sortBy = typeof data.data?.sortBy === "string" ? data.data.sortBy : undefined;
    const sortOrder = data.data?.sortOrder === "asc" ? "asc" : "desc";

    const result = await getUnifiedMarketHistoryByUser(data.user.uuid, {
      page,
      pageSize,
      type,
      status,
      resourceId,
      resourceIds,
      sortBy,
      sortOrder,
    });
    emitEventToUser(data.user, "newMarket:getUnifiedTransactionHistory:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "newMarket:getUnifiedTransactionHistory:error", { message: err.message });
  }
}