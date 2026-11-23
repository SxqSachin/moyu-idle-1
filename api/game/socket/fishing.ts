import { emitEventToServer, registerSocketEventListener } from "./socket";
import type {
  FishingSessionDTO,
  ActiveSession,
  NearbyPlayer,
  CaughtFishDTO,
  BatchSellCaughtFishSuccessPayload,
  FishingBaitAreaDTO,
  NearbyBaitAreaDTO,
} from '~/shared/types/fishing'
import type { AllFishSpeciesID } from "~/shared/data/allFishSpecies";
import type { AllFishingBaitId } from "~/shared/data/allFishBaitInfo";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

export interface StartFishingSuccessPayload {
  session: FishingSessionDTO
  active: ActiveSession
  nearbyPlayers: NearbyPlayer[]
}

export interface MyActiveSessionPayload {
  active: ActiveSession | null
  session: FishingSessionDTO | null
  nearbyPlayers: NearbyPlayer[]
}

// 客户端发起开始垂钓请求
export function emitStartFishing(payload: {
  pointX: number;
  pointY: number;
  pondId?: string | null;
  characterUuid?: string | null;
  toolConfig?: Record<string, unknown> | null;
  baitConfig?: {[key in AllFishingBaitId]?: number} | null,
  baiting?: boolean;
  baitArea?: {
    baitId?: string;
    qty?: number;
    // radius?: number;
    // durationSec?: number;
  };
}) {
  // 简单参数校验
  if (!Number.isFinite(payload.pointX) || !Number.isFinite(payload.pointY)) {
    throw new Error("pointX/pointY must be numbers");
  }

  emitEventToServer("fishing:start", payload);
}

// 监听开始垂钓成功/失败
export const onStartFishingSuccess = registerSocketEventListener<StartFishingSuccessPayload>("fishing:start:success");
export const onStartFishingFail = registerSocketEventListener<{ message: string }>("fishing:start:fail");

// 获取附近玩家
export function emitGetNearbyFishingPlayers(payload: { pointX: number; pointY: number; }) {
  if (!Number.isFinite(payload.pointX) || !Number.isFinite(payload.pointY)) {
    throw new Error("pointX/pointY must be numbers")
  }
  emitEventToServer("fishing:nearby:get", payload)
}

export const onNearbyFishingPlayers = registerSocketEventListener<{ players: NearbyPlayer[] }>("fishing:nearby:get:success");
export const onNearbyFishingPlayersFail = registerSocketEventListener<{ message: string }>("fishing:nearby:get:fail");

// 获取自己是否处于活跃钓鱼状态
export function emitGetMyActiveSession() {
  emitEventToServer('fishing:myActive:get')
}

export const onGetMyActiveSession = registerSocketEventListener<MyActiveSessionPayload>('fishing:myActive:get:success')
export const onGetMyActiveSessionFail = registerSocketEventListener<{ message: string }>('fishing:myActive:get:fail')

// 结束当前活跃钓鱼会话
export function emitEndFishing() {
  emitEventToServer('fishing:end')
}

export const onEndFishingSuccess = registerSocketEventListener<{ sessionId: number }>('fishing:end:success')
export const onEndFishingFail = registerSocketEventListener<{ message: string }>('fishing:end:fail')

// 请求某个会话的捕获记录（socket 懒加载，用于弹窗 hover 时调用）
export function emitGetCatches(payload: { sessionId: string }) {
  if (!payload || !payload.sessionId) throw new Error('sessionId required')
  emitEventToServer('fishing:catches:get', payload)
}

export const onGetCatchesSuccess = registerSocketEventListener<{sessionId: string, data: CaughtFishDTO[]}>('fishing:catches:get:success')
export const onGetCatchesFail = registerSocketEventListener<{ message: string }>('fishing:catches:get:fail')

// 获取当前用户的历史及当前钓鱼会话列表
export function emitGetMySessions() {
  emitEventToServer('fishing:sessions:get')
}

export const onGetMySessionsSuccess = registerSocketEventListener<{ data: FishingSessionDTO[] }>('fishing:sessions:get:success')
export const onGetMySessionsFail = registerSocketEventListener<{ message: string }>('fishing:sessions:get:fail')

// 获取附近 bait areas 以及自己创建的 bait areas
export function emitGetBaitAreas(payload: { pointX: number; pointY: number }) {
  if (!Number.isFinite(payload.pointX) || !Number.isFinite(payload.pointY)) throw new Error('pointX/pointY must be numbers')
  emitEventToServer('fishing:baitAreas:get', payload)
}

export const onGetBaitAreasSuccess = registerSocketEventListener<{ nearby: NearbyBaitAreaDTO[]; mine: FishingBaitAreaDTO[] }>('fishing:baitAreas:get:success')
export const onGetBaitAreasFail = registerSocketEventListener<{ message: string }>('fishing:baitAreas:get:fail')

// 获取当前用户自己创建的 bait areas（专用接口，初始化用）
export function emitGetMyBaitAreas() {
  emitEventToServer('fishing:myBaitAreas:get')
}

export const onGetMyBaitAreasSuccess = registerSocketEventListener<{ mine: FishingBaitAreaDTO[] }>('fishing:myBaitAreas:get:success')
export const onGetMyBaitAreasFail = registerSocketEventListener<{ message: string }>('fishing:myBaitAreas:get:fail')

// 获取当前用户的鱼获（asResource=false）
export function emitGetMyCatches() {
  emitEventToServer('fishing:myCatches:get')
}

export const onGetMyCatchesSuccess = registerSocketEventListener<{ data: CaughtFishDTO[] }>('fishing:myCatches:get:success')
export const onGetMyCatchesFail = registerSocketEventListener<{ message: string }>('fishing:myCatches:get:fail')

// 获取排行榜数据（按 fishId 分组，返回每组 max length / max weight）
export function emitGetLeaderboard() {
  emitEventToServer('fishing:leaderboard:get')
}

export const onGetLeaderboardSuccess = registerSocketEventListener<{ data: Array<{ fishId: AllFishSpeciesID; maxLength?: CaughtFishDTO | null; maxWeight?: CaughtFishDTO | null }> }>('fishing:leaderboard:get:success')
export const onGetLeaderboardFail = registerSocketEventListener<{ message: string }>('fishing:leaderboard:get:fail')

// 发送临时地图消息（一次性广播，不持久化）
export function emitSendShout(payload: { text: string }) {
  if (!payload || typeof payload.text !== 'string') throw new Error('text required')
  emitEventToServer('fishing:shout:send', payload)
}

export const onSendShoutSuccess = registerSocketEventListener<{ expiresAt: number }>('fishing:shout:send:success')
export const onSendShoutFail = registerSocketEventListener<{ message: string }>('fishing:shout:send:fail')

// 服务器向客户端广播的临时消息（所有客户端收到，前端决定是否在当前视图中渲染）
export const onShoutReceived = registerSocketEventListener<{ userUuid: string; text: string; pointX: number; pointY: number; expiresAt: number }>('fishing:shout:received')

// 出售鱼获（客户端调用）
export function emitSellCaughtFish(payload: { caughtFishId: number }) {
  if (!payload || !Number.isInteger(payload.caughtFishId)) throw new Error('caughtFishId required')
  emitEventToServer('fishing:sell', payload)
}

export const onSellCaughtFishSuccess = registerSocketEventListener<{ caughtFishId: number; received: ItemCountInfo }>('fishing:sell:success')
export const onSellCaughtFishFail = registerSocketEventListener<{ message: string }>('fishing:sell:fail')

// 批量出售鱼获（客户端调用）
export function emitSellCaughtFishBatch(payload: { caughtFishIds: number[] }) {
  if (!payload || !Array.isArray(payload.caughtFishIds)) throw new Error('caughtFishIds required')
  const normalized = payload.caughtFishIds.filter((id) => Number.isInteger(id) && id > 0)
  if (normalized.length === 0) throw new Error('caughtFishIds required')
  emitEventToServer('fishing:sell:batch', { caughtFishIds: normalized })
}

export const onSellCaughtFishBatchSuccess = registerSocketEventListener<BatchSellCaughtFishSuccessPayload>('fishing:sell:batch:success')
export const onSellCaughtFishBatchFail = registerSocketEventListener<{ message: string }>('fishing:sell:batch:fail')
