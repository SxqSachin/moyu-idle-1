import type { PlayerState } from "~/shared/types/characterInfo";
import { safeJsonParse } from "..";

export function convertJsonStrToPlayerState(jsonStr: string | null | undefined): PlayerState {
  const def = {
    battle: {
      stateWhenStartEachBattle: [],
    },
    global: {
      statusEffect: [],
      actionDurationEffect: [],
      otherEffect: [],
    },
  };
  if (!jsonStr) {
    return def;
  }

  try {
    let playerState: PlayerState = safeJsonParse(jsonStr, null);

    if (!playerState) {
      return def;
    }

    let res: PlayerState = {
      battle: {
        stateWhenStartEachBattle: [],
      },
      global: {
        statusEffect: [],
        actionEffect: [],
        otherEffect: [],
      }
    };

    if (playerState.battle.stateWhenStartEachBattle && Array.isArray(playerState.battle.stateWhenStartEachBattle)) {
        res.battle.stateWhenStartEachBattle = playerState.battle.stateWhenStartEachBattle
    }

    if (playerState.global) {
      if (playerState.global.otherEffect && Array.isArray(playerState.global.otherEffect)) {
        res.global!.otherEffect = playerState.global.otherEffect
      }

      if (playerState.global.actionEffect && Array.isArray(playerState.global.actionEffect)) {
        res.global!.actionEffect = playerState.global.actionEffect
      }

      if (playerState.global.statusEffect && Array.isArray(playerState.global.statusEffect)) {
        res.global!.statusEffect = playerState.global.statusEffect
      }
    }

    return res
  } catch (error) {
    console.error("Failed to parse player state JSON:", error);
    return def;
  }
}