import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { RankingList } from "~/shared/types/rankingList";
import type { GetLeaderboardParams, LeaderboardResponse } from "~/shared/types/weeklyPlayerStats";

// 请求排行榜
export function emitRequestRankingList() {
    emitEventToServer("requestRankingList")
}
// 监听排行榜下发
export const onDispatchRankingList = registerSocketEventListener<RankingList[]>("rankingList")


// 请求排行榜
export function emitRequestIronRankingList() {
    emitEventToServer("requestIronRankingList")
}
export const onDispatchIronRankingList = registerSocketEventListener<RankingList[]>("ironRankingList")


export function emitRequestCheaterList() {
    emitEventToServer("cheaterList")
}
export const onDispatchCheaterList = registerSocketEventListener<any>("cheaterList:success")

// 请求排行榜
export function emitRequestWeeklyRankingList(param: GetLeaderboardParams) {
    emitEventToServer("requestWeeklyRankingList", param)
}
// 监听排行榜下发
export const onDispatchWeeklyRankingList = registerSocketEventListener<LeaderboardResponse>("weeklyRankingList")

// 请求排行榜
export function emitRequestWeeklyIronRankingList(param: GetLeaderboardParams) {
    emitEventToServer("requestWeeklyIronRankingList", param)
}
// 监听排行榜下发
export const onDispatchWeeklyIronRankingList = registerSocketEventListener<LeaderboardResponse>("weeklyIronRankingList")