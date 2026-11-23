import type { MsgQueuePayload } from '~/shared/types/msgQueue.js';
import { redisClient } from '../redis';
import { Emitter } from '@socket.io/redis-emitter';
import type { GameSocketUserInfo } from '~/shared/types/socket';
import pako from 'pako';
import { getBattleInfoFromRedis, getBattlePlayerUuidsFromRedis, getBattleRoomById } from './battle';
import { getInventoryInfoPreferCache } from './characterInventory';
import { getBuildingInfo } from './building';
import Pako from 'pako';
import type { FullBattleAction } from '~/shared/types/battle';
const pub = redisClient.duplicate();
pub.on("error", (err) => console.log("Redis Pub Client Error", err));
await pub.connect();

const emitter = new Emitter(pub);
class MessageBatcher {
  private static batch: MsgQueuePayload[] = [];
  private static batchTimer: NodeJS.Timeout | null = null;
  private static readonly BATCH_SIZE = 1;
  private static readonly BATCH_TIMEOUT = 100; // 100ms

  static addMessage(message: MsgQueuePayload) {
    this.batch.push(message);

    if (this.batch.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT);
    }
  }

  private static flushBatch() {
    if (this.batch.length === 0) return;

    const currentBatch = [...this.batch];
    this.batch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // 按battleUuid分组，减少Redis查询
    const battleGroups = new Map<string, MsgQueuePayload[]>();
    const nonBattleMessages: MsgQueuePayload[] = [];

    let nBattleMsgType: MsgQueuePayload['type'][] = ['give_battle_exp_reward', 'battle_info_detail', 'give_battle_resource_reward']

    for (const msg of currentBatch) {
      if ("battleUuid" in msg && !nBattleMsgType.includes(msg.type)) {
        const battleUuid = msg.battleUuid;
        if (!battleGroups.has(battleUuid)) {
          battleGroups.set(battleUuid, []);
        }
        battleGroups.get(battleUuid)!.push(msg);
      } else {
        nonBattleMessages.push(msg);
      }
    }

    // 处理非战斗消息
    nonBattleMessages.forEach((msg) => {
      publishBattleInfo(msg);
    });

    // 批量处理战斗消息
    const battleUuids = Array.from(battleGroups.keys());

    // 创建所有Redis查询的Promise
    const playerUuidPromises = battleUuids.map((battleUuid) => {
      let battleMsgPayload = battleGroups.get(battleUuid);

      for(const payload of battleMsgPayload ?? []) {
        if ('battleInfo' in payload) {
          return {
            battleUuid,
            playerUuids: payload.battleInfo.members.filter(u => u.isPlayer).map(u => u.uuid)
          }
        }
      }
      
      let c = getBattlePlayerUuidsFromRedis(battleUuid).then((playerUuids) => ({
        battleUuid,
        playerUuids,
      }));
      
      return c
    });

    // 等待所有Redis查询完成
    Promise.all(playerUuidPromises)
      .then((results) => {
        // 处理每个战斗的消息
        results.forEach(({ battleUuid, playerUuids }) => {
          const messages = battleGroups.get(battleUuid) || [];

          messages.forEach((msg) => {
            playerUuids.forEach((uuid) => {
              switch (msg.type) {
                case "on_turn_start":
                  emitEventToUser(uuid, "battle:turnStart:success", msg.info);
                  break;
                case "on_turn_end":
                  emitEventToUser(uuid, "battle:turnEnd:success", msg.info);
                  break;
                case "on_deal_damage":
                  emitEventToUser(uuid, "battle:dealDamage:success", msg.info);
                  break;
                case "on_heal":
                  emitEventToUser(uuid, "battle:heal:success", msg.info);
                  break;
                case "battle_float_text":
                  emitEventToUser(uuid, "battle:floatText:success", msg.info);
                  break;
                case "use_battle_item":
                  emitEventToUser(
                    uuid,
                    "battle:useBattleItem:success",
                    msg.info
                  );
                  break;
                case "on_add_state":
                  emitEventToUser(uuid, "battle:addState:success", msg.info);
                  break;
                case "on_loss_mp":
                  emitEventToUser(uuid, "battle:lossMp:success", msg.info);
                  break;
                case "on_restore_mp":
                  emitEventToUser(uuid, "battle:restoreMp:success", msg.info);
                  break;
                case "on_cast_skill":
                  emitEventToUser(uuid, "battle:castSkill:success", msg.info);
                  break;
                case "give_battle_exp_reward":
                  emitEventToUser(uuid, "battle:giveExpReward:success", msg.info);
                  break;
                default:
                  // 未知的战斗消息类型
                  console.warn(`Unknown battle message type: ${msg.type}`);
                  break;
              }
            });
          });
        });
      })
      .catch((err) => {
        console.error(
          "[MessageBatcher] Error processing battle messages:",
          err
        );
      });
  }
}





export function emitEventToUser<T>(userUuid: string, ev: string, data?: T): void;
export function emitEventToUser<T>(userInfo: GameSocketUserInfo, ev: string, data?: T): void;

export function emitEventToUser<T>(userInfo: GameSocketUserInfo | string, ev: string, data?: T): void {
  let userUuid = userInfo

  if (typeof userInfo != 'string') {
    userUuid = userInfo.uuid
  }

  const roomId = "room-" + userUuid
  
  if (!redisClient?.isOpen) {
    console.error("Redis client is not open")
    return;
  }

  redisClient.sIsMember("online-users", userUuid as string).then((isOnline) => {
    if (!isOnline) {
      return;
    }
    let d = {
      user: userInfo,
      data: data ?? null,
    };
    let s = JSON.stringify(d);

    let res = pako.deflate(s, {
      level: 6,
      memLevel: 6,
      // windowBits: 15,
      // strategy: Pako.constants.Z_HUFFMAN_ONLY,
    });
    // let res = pako.deflate(s, {
    //   level: 1,
    //   memLevel: 4,
    //   windowBits: 9,
    //   strategy: Pako.constants.Z_HUFFMAN_ONLY,
    // });

    try {
      emitter.to(roomId).emit(ev, res);
    } catch (err) {
      console.error('[emitEventToUser] emit error:', s);
    }
  });
}

/**
 * 推送消息到队列
 * @param {object} message - 消息对象，建议符合 MsgQueuePayload 类型
 */
export function pushMessageToQueue(message: MsgQueuePayload) {
  try {
    MessageBatcher.addMessage(message);
  } catch (err) {
    console.error('[msgQueue] pushMessageToQueue error:', err);
    throw err;
  }
}

const BATTLE_CHANNEL = 'BATTLE_INFO_CHANNEL';
function publishBattleInfo(msg: MsgQueuePayload) {
  try {
    switch (msg.type) {
      case "give_battle_resource_reward":
        msg.playerUuid.forEach((uuid) => {
          emitEventToUser(uuid, "battle:giveResourceReward:success", msg.info);
        });
        break;
      case "give_battle_exp_reward":
        msg.playerUuid.forEach((uuid) => {
          emitEventToUser(uuid, "battle:giveExpReward:success", msg.info);
        });
        break;
      case "battle_info_detail":
        msg.playerUuid.forEach((uuid) => {
          emitEventToUser(uuid, "battle:battleInfoDetail:success", msg.info);
        });
        break;
      // case "battle_float_text":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:floatText:success", msg.info);
      //     });
      //   });
      //   break;

      // case "use_battle_item":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:useBattleItem:success", msg.info);
      //     });
      //   });
      //   break;

      // case "on_add_state":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:addState:success", msg.info);
      //     });
      //   });
      //   break;

      // case "on_deal_damage":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:dealDamage:success", msg.info);
      //     });
      //   });
      //   break;

      // case "on_heal":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:heal:success", msg.info);
      //     });
      //   });
      //   break;
      // case "on_loss_mp":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:lossMp:success", msg.info);
      //     });
      //   });
      //   break;
      // case "on_restore_mp":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:restoreMp:success", msg.info);
      //     });
      //   });
      //   break;
      // case "on_cast_skill":
      //   getBattlePlayerUuidsFromRedis(msg.battleUuid).then((playerUuids) => {
      //     playerUuids.forEach((uuid) => {
      //       emitEventToUser(uuid, "battle:castSkill:success", msg.info);
      //     });
      //   });
      //   break;

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
      case "status_info":
        emitEventToUser(msg.userUuid, "dispatchCharacterStatusInfo", msg.info)
        break;
      case "status_upgrade":
        emitEventToUser(msg.userUuid, "dispatchCharacterStatusInfo", msg.info)
        break;
      case "inventory_updated":
        getInventoryInfoPreferCache(msg.userUuid).then(inventoryInfo => {
          emitEventToUser(msg.userUuid, "inventoryUpdated", inventoryInfo)
        })
        break;
      case "inventory_modify":
        emitEventToUser(msg.userUuid, "inventoryModify", msg.info)
        break;
      case "building_info":
        getBuildingInfo(msg.userUuid).then(info => {
          emitEventToUser(msg.userUuid, "dispatchCharacterBuildingInfo", info)
        })
        break;
      case "quest_update":
        emitEventToUser(msg.userUuid, "quest:updated", msg.info);
        break;
      case "dispatch_resource_increase":
        emitEventToUser(msg.userUuid, "inventory:increase:success", msg.info);
        break;
      case "battle_start":
        emitEventToUser(msg.userUuid, "battleRoom:startBattle:success", msg.battleRoom);
        break;
      case "dispatch_kitty_task_queue":
        emitEventToUser(msg.userUuid, "kitty:getAllTask:success", {
          kittyUuid: msg.kittyUuid,
          taskQueue: msg.taskQueue,
        });
        break;

      case "dispatch_battle_info_to_client":
        // 通知房间所有成员最新战斗信息（全量）
        getBattleRoomById(msg.roomUuid).then(room => {
          if (room) {
            // @ts-ignore
            const nMsg: FullBattleAction = {
              // targetUnitUuidList: msg.thisRoundAction?.targetUnitUuidList ?? [],
              sourceUnitUuid: msg.thisRoundAction?.sourceUnitUuid ?? '',
            }
            for (const userId of room.memberIds) {
              emitEventToUser(userId, "battle:fullInfo:success", {
                battleInfo: msg.battleInfo,
                // thisRoundAction: msg.thisRoundAction,
              });
            }
          }
        });
        break;

      case "dispatch_battle_end":
        getBattleRoomById(msg.roomUuid).then(battleRoom => {
          if (!battleRoom) {
            // 房间不存在，通知所有相关成员（如有成员列表可用）
            // 这里无法获取成员，只能跳过或记录日志
            return;
          }

          for (const userId of battleRoom.memberIds) {
            emitEventToUser(userId, "battle:end:success");
          }
        });
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

      case "dispatch_latest_battle_info":
        let battleRoom = msg.battleRoom
        if (!battleRoom) {
          // 房间不存在，通知所有相关成员（如有成员列表可用）
          // 这里无法获取成员，只能跳过或记录日志
          break;
        }

        if (!battleRoom.battleUuid) {
          for (const userId of battleRoom.memberIds) {
            emitEventToUser(userId, "battle:update:error", { message: "房间未开始战斗" });
          }
          break;
        }

        const battleInfo = msg.latestBattleInfo
        if (!battleInfo) {
          for (const userId of battleRoom.memberIds) {
            emitEventToUser(userId, "battle:update:error", { message: "未找到战斗信息" });
          }
          break;
        }

        for (const userId of battleRoom.memberIds) {
          emitEventToUser(userId, "battle:update:success", battleInfo);
        }
        break;

      default:
        // await pub.publish(BATTLE_CHANNEL, JSON.stringify(msg));
    }
  } catch (err) {
    console.error('[battlePubSub] publishBattleInfo error:', err);
  }
}