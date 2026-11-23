import { registerSocketEventListener } from "@/api/game/socket/socket"
import type { RewardInfo, UsedResourceInfo } from "~/shared/types/gameInventory"
import type { GameSocketData } from "~/shared/types/socket"

// 监听任务奖励下发
export const onDispatchTaskRewardInfo = registerSocketEventListener<RewardInfo>("dispatchTaskReward")

// 监听资源使用
export const onResourceUsed = registerSocketEventListener<UsedResourceInfo>("resourceUsed")