import { useScheduler } from "#scheduler";
import { emitEventToUser } from "../io";
import { dispatchInventoryUpdatedEventToClient } from "../utils/game/characterInventory";
import { dispatchCharacterBuildingInfoToClient } from "../utils/game/building";
import { dispatchCharacterStatusInfo, dispatchCharacterStatusLevelUpgrade } from "../utils/game/characterStatus";
import { popMessageFromQueue } from "../utils/msgQueue";
import { dispatchBattleEndEventToRoomByRoomId, dispatchFullBattleInfoToRoom, dispatchLatestBattleInfoToRoom, getBattleRoomById } from "../utils/game/battle";
import { createClient } from 'redis';
import { MsgQueuePayload } from "~/shared/types/msgQueue";

const BATTLE_CHANNEL = 'BATTLE_INFO_CHANNEL';

const runtimeConfig = useRuntimeConfig()

export default defineNitroPlugin(async () => {
  startScheduler();
});

function startScheduler() {
    subscribeBattleInfo((msg) => {
        switch (msg.type) {
            case "use_resource":
                emitEventToUser(msg.userUuid, "resourceUsed", msg.info);
                break;
            case "need_reset_current_action_progress":
                emitEventToUser(msg.userUuid, "needResetCurrentActionProgress");
                break;
            case "dispatch_task_queue_to_client":
                emitEventToUser(msg.userUuid, "dispatchTaskQueueToClient", msg.info);
                break;
            case "task_updated":
                emitEventToUser(msg.userUuid, "taskUpdated", msg.firstTask);
                break;
            case "task_done":
                emitEventToUser(msg.userUuid, "taskDone", msg.info);
                break;
            // case "task_reward":
                // emitEventToUser(msg.userUuid, "taskReward", msg.info);
                // break;
            case "inventory_updated":
                dispatchInventoryUpdatedEventToClient(msg.userUuid);
                break;
            case "building_info":
                dispatchCharacterBuildingInfoToClient(msg.userUuid);
                break;
            case "status_info":
                dispatchCharacterStatusInfo(msg.userUuid, msg.info);
                break;
            case "status_upgrade":
                dispatchCharacterStatusLevelUpgrade(msg.userUuid, msg.info);
                break;
            case "quest_update":
                emitEventToUser(msg.userUuid, "quest:updated", msg.info);
                break;
            case "dispatch_resource_increase":
                emitEventToUser(msg.userUuid, "inventory:increase:success", msg.info);
                break;

            case "dispatch_battle_info_to_client":
                // 通知房间所有成员最新战斗信息（全量）
                getBattleRoomById(msg.roomUuid).then(room => {
                    if (room) {
                        dispatchFullBattleInfoToRoom(room, msg.battleInfo);
                    }
                });
                break;
            case "dispatch_battle_end":
                // 通知房间所有成员战斗结束
                dispatchBattleEndEventToRoomByRoomId(msg.roomUuid);
                break;
            case "notify_all_room_members_to_update_room":
                getBattleRoomById(msg.roomUuid).then(room => {
                    if (room) {
                        for (const userId of room.memberIds) {
                            emitEventToUser(userId, "battleRoom:update", room);
                        }
                    }
                });
                break;
            case "battle_start":
                emitEventToUser(msg.userUuid, "battleRoom:startBattle:success", msg.battleRoom);
                break;
            case "dispatch_latest_battle_info":
                dispatchLatestBattleInfoToRoom(msg.battleRoom);
                break;

            case "dispatch_kitty_task_queue":
              emitEventToUser(msg.userUuid, "kitty:getAllTask:success", {
                kittyUuid: msg.kittyUuid,
                taskQueue: msg.taskQueue,
              });
              break;

            default:
                console.warn("[MsgQueue] subs Unknown message type:", msg);
        }
    });
}

// 建议单独创建订阅客户端
export async function subscribeBattleInfo(onBattle: (msg: MsgQueuePayload ) => void) {
    return;
  const subClient = createClient();
  await subClient.connect();

  await subClient.subscribe(BATTLE_CHANNEL, (message) => {
    try {
      const data = JSON.parse(message);
      onBattle(data); // 并发分发消息
    } catch {
      // ignore parse error
    }
  });
}