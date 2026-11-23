import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from ".";
import { claimStage1Rewards, claimStage2Rewards, confirmReferredRelationshipAndGrantReward, getInviteRewardSetting, getUserReferralInfo, setInviteRewardSetting, updateReferrerState } from "../utils/game/referrer";
import { prisma } from "../utils/game/db";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { InviteRewardSettingResponse } from "~/shared/types/referrer";
import { withUniqueLock } from "~/server/utils/lock";

export async function confirmReferredRelationship(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  const referral = await prisma.userReferral.findUnique({
      where: { referredUuid: userUuid },
  });

  if (!referral) {
      throw new Error("未找到邀请关系");
  }

  if (referral.confirmedByReferred) {
      return; // 已确认直接返回，幂等
  }

  const referrerUuid = referral.referrerUuid;
  if (!referrerUuid) {
      throw new Error("邀请人不存在");
  }

  await withUniqueLock(`referrer:confirm:${referral.referrerUuid}`, async () => {
    try {
      await confirmReferredRelationshipAndGrantReward(userUuid);
      emitEventToUser(data.user, "referrer:confirmReferredRelationship:success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "确认失败";
      emitEventToUser(data.user, "referrer:confirmReferredRelationship:fail", { message });
    }
  });
}

export async function getConfirmReferredRelationshipInfo(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  try {
    const referral = await prisma.userReferral.findUnique({
      where: {
        referredUuid: userUuid,
      },
      select: {
        confirmedByReferred: true,
        confirmedAt: true,
      }
    });

    const confirmed = referral ? referral.confirmedByReferred : false;

    emitEventToUser(data.user, "referrer:getConfirmReferredRelationshipInfo:success", { confirmed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    emitEventToUser(data.user, "referrer:getConfirmReferredRelationshipInfo:fail", { message });
  }
}

export async function getReferrerInfo(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuid?: string}>
) {
  const userUuid = data.user.uuid;

  try {
    await updateReferrerState(userUuid);
    const info = await getUserReferralInfo(userUuid);

    emitEventToUser(data.user, "referrer:info:success", { info });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    emitEventToUser(data.user, "referrer:info:fail", { message });
  }
}

export async function handleSetInviteRewardSetting(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ reward: ItemCountInfo }>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`referrer:${userUuid}:inviteRewardSetting`, async () => {
    try {
      if (!data.data?.reward) {
        emitEventToUser(data.user, "referrer:setInviteRewardSetting:fail", { message: "参数缺失" });
        return;
      }
      const setting = await setInviteRewardSetting(userUuid, data.data.reward);
      emitEventToUser(data.user, "referrer:setInviteRewardSetting:success", { setting });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存失败";
      emitEventToUser(data.user, "referrer:setInviteRewardSetting:fail", { message });
    }
  });
}

export async function handleGetInviteRewardSetting(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ userUuid?: string }>
) {
  const requester = data.user.uuid;
  const targetUuid = data.data?.userUuid ?? requester;
  try {
    const setting = await getInviteRewardSetting(targetUuid);
    const payload: InviteRewardSettingResponse = { setting };
    emitEventToUser(requester, "referrer:getInviteRewardSetting:success", payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    emitEventToUser(requester, "referrer:getInviteRewardSetting:fail", { message });
  }
}

export async function getMyInviter(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  try {
    const self = await prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { referredBy: true }
    });

    if (!self|| !self.referredBy) {
      emitEventToUser(data.user, "referrer:myInviter:success", { inviter: null });
      return;
    }

    const inviter = await prisma.user.findUnique({
      where: { uuid: self.referredBy },
      select: { uuid: true, name: true, create_date: true }
    });

    if (!inviter) {
      emitEventToUser(data.user, "referrer:myInviter:success", { inviter: null });
      return;
    }

    emitEventToUser(data.user, "referrer:myInviter:success", { inviter: { uuid: inviter.uuid, name: inviter.name, createDate: inviter.create_date } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    emitEventToUser(data.user, "referrer:myInviter:fail", { message });
  }
}

export async function handleClaimedStage1Reward(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock(`referrer:${userUuid}:claim`, async () => {
    try {
      await claimStage1Rewards(userUuid);
      emitEventToUser(data.user, "referrer:claimedStage1Reward:success");

      await updateReferrerState(userUuid);
      const info = await getUserReferralInfo(userUuid);
      emitEventToUser(data.user, "referrer:info:success", { info });
    } catch (e) {
      const message = e instanceof Error ? e.message : "领取失败";
      emitEventToUser(data.user, "referrer:claimedStage1Reward:fail", { message });
    }
  })
}

export async function handleClaimedStage2Reward(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock(`referrer:${userUuid}:claim`, async () => {
    try {
      await claimStage2Rewards(userUuid);
      emitEventToUser(data.user, "referrer:claimedStage2Reward:success");

      await updateReferrerState(userUuid);
      const info = await getUserReferralInfo(userUuid);
      emitEventToUser(data.user, "referrer:info:success", { info });
    } catch (e) {
      const message = e instanceof Error ? e.message : "领取失败";
      emitEventToUser(data.user, "referrer:claimedStage2Reward:fail", { message });
    }
  })
}

export async function deleteReferredRelationship(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;

  try {
    // Check if the relationship is already confirmed
    const referral = await prisma.userReferral.findUnique({
      where: {
        referredUuid: userUuid,
      },
      select: {
        confirmedAt: true,
        confirmedByReferred: true,
      }
    });

    if (!referral) {
      emitEventToUser(data.user, "referrer:deleteReferredRelationship:fail", { message: "你当前不存在可删除的邀请关系" });
      return;
    }

    if (referral.confirmedByReferred) {
      const lockMs = 15 * 24 * 60 * 60 * 1000;
      const confirmedAt = referral.confirmedAt?.getTime();
      const notExpired = confirmedAt ? confirmedAt + lockMs > Date.now() : true;
      if (notExpired) {
        emitEventToUser(data.user, "referrer:deleteReferredRelationship:fail", { message: "邀请关系确认后15天内无法解除" });
        return;
      }
    }

    // Delete the UserReferral record
    await prisma.userReferral.delete({
      where: {
        referredUuid: userUuid,
      }
    });

    // Clear the referredBy field in User table
    await prisma.user.update({
      where: {
        uuid: userUuid,
      },
      data: {
        referredBy: null,
      }
    });

    emitEventToUser(data.user, "referrer:deleteReferredRelationship:success");
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    emitEventToUser(data.user, "referrer:deleteReferredRelationship:fail", { message });
  }
}