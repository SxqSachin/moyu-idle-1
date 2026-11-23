import type { UserReferral } from "~/generated/prisma";
import type { ItemCountInfo } from "./gameInventory";

export type InviteRewardSetting = {
  uuid: string;
  userUuid: string;
  reward: ItemCountInfo;
  isActive: boolean;
  lastUpdatedAt: Date;
  nextEditableAt: Date;
};

export type InviteRewardSettingResponse = {
  setting: InviteRewardSetting | null;
};

export type ReferrerInfo = {
  total: number;

  /** 总推荐数量 */
  matchStage1Count: number;
  matchStage2Count: number;

  /** 已领取一阶段奖励数量 */
  claimedStage1Count: number;
  /** 已领取二阶段奖励数量 */
  claimedStage2Count: number;
  
  /** 待领取一阶段奖励数量 */
  unclaimedStage1Count: number;
  /** 待领取二阶段奖励数量 */
  unclaimedStage2Count: number;

  referredUserInfo: {
    uuid: string,
    createDate: Date,
    latestOnlineDate: Date,
    confirmed: boolean
  }[];

  info?: UserReferral[]
}