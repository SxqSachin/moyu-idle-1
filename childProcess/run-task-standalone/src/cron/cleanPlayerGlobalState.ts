import { prisma } from "../utils/prisma";
import { updateAllActionDuration, updateCharacterStatusInfo } from "../utils/game/character"
import { removeCharacterStatusFromOther, revertRemoveCharacterStatusFromOther } from "../utils/game/characterStatus";
import { convertJsonStrToPlayerState } from "~/shared/utils/game/userState";
import pLimit from 'p-limit';
import { emitEventToUser } from "../utils/game/msgQueue";
import { GameBroadcastKind, type UserGlobalStateUpdateMessage } from "~/shared/types/broadcast";
import { publishGameBroadcast } from "../utils/game/broadcastHub";

const INTERVAL = 1000 * 60 * 3; // 3分钟

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function removeSinglePlayerGlobalState(userUuid: string) {
  let actionDurationEffectResult: any | null = null;
  let statusResult: any | null = null;

  const userInfo = await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: { name: true, userGameState: true },
  });
  if (!userInfo) return;
  const now = new Date();

  const playerState = convertJsonStrToPlayerState(userInfo.userGameState);

  if (!playerState) {
    return;
  }

  let dirty = false;
  let needUpdateAllActionDuration = false;
  let needUpdateStatusEffect = false;

  for (const state of playerState.battle.stateWhenStartEachBattle ?? []) {
    if (!state.until || new Date(state.until) <= now) {
      // delete this state
      playerState.battle.stateWhenStartEachBattle =
        playerState.battle.stateWhenStartEachBattle?.filter(
          (s) => s.id !== state.id,
        );
      dirty = true;
      continue;
    }
  }

  if (playerState.global?.statusEffect) {
    for (const state of playerState.global.statusEffect ?? []) {
      if (!state.until || new Date(state.until) <= now) {
        playerState.global.statusEffect =
          playerState.global.statusEffect?.filter((s) => s.id !== state.id);
        dirty = true;
        needUpdateStatusEffect = true;

        // 同步删除角色状态中的对应状态
        await removeCharacterStatusFromOther(userUuid, state.id, prisma, {
          ignoreRefresh: true, // 这里先不刷新，等全部状态处理完后再刷新
        });
      }
    }
  }

  if (playerState.global?.actionEffect) {
    for (const state of playerState.global.actionEffect ?? []) {
      if (!state.until || new Date(state.until) <= now) {
        playerState.global.actionEffect =
          playerState.global.actionEffect?.filter(
            (s) => s.stateId !== state.stateId,
          );
        dirty = true;
        needUpdateAllActionDuration = true;
      }
    }
  }

  if (playerState.global?.otherEffect) {
    for (const state of playerState.global.otherEffect ?? []) {
      if (!state.until || new Date(state.until) <= now) {
        playerState.global.otherEffect = playerState.global.otherEffect?.filter(
          (s) => s.id !== state.id,
        );
        dirty = true;
      }
    }
  }

  if (dirty) {
    await prisma.user.update({
      where: { uuid: userUuid },
      data: {
        userGameState: JSON.stringify(playerState),
      },
    });

    await publishGameBroadcast<UserGlobalStateUpdateMessage>({
      kind: GameBroadcastKind.USER_GLOBAL_STATE_UPDATED,
      userUuid: userUuid,
    });
  }

  await revertRemoveCharacterStatusFromOther(userUuid, playerState);

  if (needUpdateAllActionDuration) {
    actionDurationEffectResult = await updateAllActionDuration(userUuid);
  }
  if (needUpdateStatusEffect) {
    statusResult = await updateCharacterStatusInfo(userUuid);
  }
  if (actionDurationEffectResult) {
    emitEventToUser(
      userUuid,
      "character:updateActionDuration:success",
      actionDurationEffectResult,
    );
  }
  if (statusResult) {
    emitEventToUser(userUuid, "dispatchCharacterStatusInfo", statusResult);
  }
}

async function run() {
  const now = new Date();
  try {
    const allUser = await prisma.user.findMany({
      select: { uuid: true, is_banned: false, }
    });
    console.log(`[cleanPlayerGlobalState] 开始清理玩家全局状态 共 ${allUser.length} 个玩家，当前时间: ${now.toISOString()} 并发=100`);

    let success = 0;
    let failed = 0;

    for (const user of allUser) {
      try {
        await removeSinglePlayerGlobalState(user.uuid);
        success++;
      } catch (error) {
        failed++;
        console.error(
          `[cleanPlayerGlobalState] 清理玩家全局状态失败 userUuid: ${user.uuid}`,
          error,
        );
      }
    }

    console.log(`[cleanPlayerGlobalState] 清理完成 成功:${success} 失败:${failed} 当前时间: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[cleanPlayerGlobalState] run 执行异常', error);
  }
}

async function mainLoop() {
  console.log('[cleanPlayerGlobalState] 服务启动');
  while (running) {
    await run();
    console.log(`[cleanPlayerGlobalState] 下次执行时间: ${new Date(Date.now() + INTERVAL).toISOString()}`);
    await new Promise(res => setTimeout(res, INTERVAL));
    if (!running) break;
  }
  console.log('[cleanPlayerGlobalState] 服务已停止');
}

await mainLoop();
process.exit(0);