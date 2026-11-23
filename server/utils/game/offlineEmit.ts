import { emitEventToUser } from "~/server/io";

interface OfflineAggregatedPayload {
  inventory?: Record<string, { count: number }>;
  buildingInfoChanged?: boolean;
  statusUpgradeList?: any[];
  taskQueue?: any[];
}

/**
 * 统一的离线聚合事件发送适配层：
 *  - inventory: 合并为单条 inventoryModify
 *  - buildingInfoChanged: 一次 buildingInfo
 *  - statusUpgradeList: 逐条 statusUpgrade（保持客户端原语义）
 *  - taskQueue: 最终一次性 dispatchTaskQueueToClient
 */
export async function emitOfflineAggregated(userUuid: string, payload: OfflineAggregatedPayload) {
  const { inventory, buildingInfoChanged, statusUpgradeList, taskQueue } = payload;
  if (inventory && Object.keys(inventory).length) {
    emitEventToUser(userUuid, 'inventoryModify', inventory);
  }
  if (buildingInfoChanged) {
    emitEventToUser(userUuid, 'buildingInfo');
  }
  if (statusUpgradeList && statusUpgradeList.length) {
    for (const st of statusUpgradeList) emitEventToUser(userUuid, 'statusUpgrade', st);
  }
  if (taskQueue) {
    emitEventToUser(userUuid, 'dispatchTaskQueueToClient', taskQueue);
  }
}
