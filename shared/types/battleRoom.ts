import type { AllBattleAreaID } from "./battle";
import type { Room } from "./room";
import type { BattleRoomOfferingStack } from "./battleRoomOffering";

/**
 * 基础战斗房间信息
 */
export interface BaseBattleRoom extends Room {
  battleUuid?: string; // 战斗唯一标识符
  type: "battle";
  repeatCount: number;
  currentRepeat: number;
  lastBattleAt?: number;

  phantomUuidList?: string[];

  ironcat?: boolean;

  disableDenseFogModeBecausePlayerLose?: boolean;

  totalBattleLevel?: number;

  denseFogModeConflictEncounter?: {
    battleUuid: string;
    enemyPlayerUuidList: string[];
    result: "WIN" | "LOSE" | "BATTLING";
    date: Date;
  }[];

  // 公开战利品
  publicBattleLoot?: boolean;

  beForceRestart?: boolean;

  offerings?: BattleRoomOfferingStack[];

  autoStartBattle?: boolean;
  autoRestart?: boolean;

  // 与此房间平均战斗等级脱节的玩家列表
  battleLevelDesyncPlayerUuidList?: string[];
}
export type AutoWorldBossBattleConf =
  | { type: "none" }
  | {
      type: "switch";
      config: {
        bossId: string;
      };
    };

/**
 * 普通战斗房间
 */
export interface NormalBattleRoom extends BaseBattleRoom {
  battleType?: "normal";
  area: AllBattleAreaID;
  difficulty?: number;
  denseFogMode?: boolean;
  autoRestartDenseFogMode?: boolean;
  // loot/gold slider: 0..10
  // 0 = 默认（不变），每向右1格：金币 * (1 - 0.1*step)，战利品掉落概率 * (1 + 0.05*step)
  lootGoldSlider?: number;

  autoWorldBossBattleConf?: AutoWorldBossBattleConf;
}

/**
 * 世界Boss战斗房间
 */
export interface WorldBossBattleRoom extends BaseBattleRoom {
  battleType: "worldBoss";
  worldBossId: string;
  worldBossVersion?: number;
  area?: AllBattleAreaID;
  afterWin?: AfterWinAction
}

export type AfterWinAction =
  | { type: 'wait' }
  | { type: 'startBattle'; config: CreateNormalBattleRoomInput };

export type BattleRoom = NormalBattleRoom | WorldBossBattleRoom;

export type CreateNormalBattleRoomInput = Pick<
  NormalBattleRoom,
  "name" | "area" | "isPublic" | "autoRestart" | "autoStartBattle" | "difficulty" | "denseFogMode" | "autoRestartDenseFogMode" | "phantomUuidList" | "publicBattleLoot" | "offerings" | "lootGoldSlider"
> & { battleType?: "normal" } & { autoWorldBossBattleConf?: AutoWorldBossBattleConf };

export type CreateWorldBossBattleRoomInput = Pick<
  WorldBossBattleRoom,
  "name" | "isPublic" | "publicBattleLoot" | "autoStartBattle" | 'autoRestart' | "worldBossId" | "worldBossVersion"
> & { battleType: "worldBoss" } & { afterWin?: AfterWinAction };

export type CreateBattleRoomInput = CreateNormalBattleRoomInput | CreateWorldBossBattleRoomInput;

export type UpdateNormalBattleRoomInput = Pick<
  NormalBattleRoom,
  "name" | "area" | "isPublic" | "autoRestart" | "autoStartBattle" | "difficulty" | "denseFogMode" | "autoRestartDenseFogMode" | "phantomUuidList" | "ownerId" | "publicBattleLoot" | "offerings" | "lootGoldSlider"
> & { battleType?: "normal" } & { autoWorldBossBattleConf?: AutoWorldBossBattleConf };

export type UpdateWorldBossBattleRoomInput = Pick<
  WorldBossBattleRoom,
  "name" | "isPublic" | "ownerId" | "publicBattleLoot" | "autoStartBattle" | 'autoRestart' | 'worldBossId' | 'worldBossVersion'
> & { battleType: "worldBoss" } & { afterWin?: AfterWinAction };

export type UpdateBattleRoomInput = UpdateNormalBattleRoomInput | UpdateWorldBossBattleRoomInput;

export type BattleRoomOffering = {};