import type { allBattleAreas } from "../data/allBattleInfo";
import type { ItemCountInfo } from "./gameInventory";

export type KittyExpeditionTeamEditForm = {
  name: string;
  kittyUuids: string[];
  expeditionAreaId: string;
}

export enum KittyExpeditionTeamState {
  IDLE = "IDLE",
  ON_THE_WAY = "ON_THE_WAY",
  EXPEDITION = "EXPEDITION",
  RETURNING = "RETURNING",
  FINISHED = "FINISHED",
}

export type KittyExpeditionTeamReward = {
    [userUuid: string]: ItemCountInfo
}
export type KittyExpeditionTeamInGame = {
  uuid: string;
  owner: string;
  name: string;

  guildUuid?: string | null;


  kittyUuids: string[]; // JSON字符串
  state: KittyExpeditionTeamState;

  expeditionAreaId: keyof typeof allBattleAreas;

  turn: number;

  lastRewardAt?: Date | null;

  startTime?: Date | null;
  endTime?: Date | null;

  reward: KittyExpeditionTeamReward

  extra?: string | null;

  createdAt: Date;
  updatedAt: Date;

  del: boolean;
};