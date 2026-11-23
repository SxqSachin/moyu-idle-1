// 独立类型，便于扩展和类型安全

import { KittyExpeditionTeamState, type KittyExpeditionTeamInGame } from "~/shared/types/kittyExpedition";
import type { KittyExpeditionTeam } from "~/generated/prisma";
import { v4 } from "uuid";
import { safeJsonParse } from "~/shared/utils";
import { BASE_KITTY_EXPEDITION_MEMBER } from "~/shared/data/constant";
import { prisma } from "../prisma";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { increaseItemCount, invalidateInventoryCache } from "./characterInventory";

const toKittyExpeditionTeamInGame = (team: KittyExpeditionTeam): KittyExpeditionTeamInGame => {
    return {
        uuid: team.uuid,
        owner: team.owner,
        name: team.name,
        
        guildUuid: team.guildUuid ?? null,


        kittyUuids: safeJsonParse(team.kittyUuids, []),
        state: team.state as KittyExpeditionTeamState,
        expeditionAreaId: team.expeditionAreaId ?? "" as any,
        turn: team.turn ?? 0,
        lastRewardAt: team.lastRewardAt,
        startTime: team.startTime,
        endTime: team.endTime,
        reward: safeJsonParse(team.reward, {}),
        extra: team.extra,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,

        del: team.del
    };
};

// 创建探险队
export async function createKittyExpeditionTeam(kittyUuids: string[], owner: string, name: string, expeditionAreaId: string, opt?: {
  guildUuid?: string | null
}): Promise<KittyExpeditionTeamInGame> {
  if (!kittyUuids.length) {
    throw new Error("探险队必须包含至少一只猫咪");
  }
  if (kittyUuids.length > BASE_KITTY_EXPEDITION_MEMBER) {
    throw new Error(`探险队成员不能超过 ${BASE_KITTY_EXPEDITION_MEMBER} 只猫咪`);
  }
  if (!owner) {
    throw new Error("探险队必须有一个所有者");
  }
  if (!name || name.length < 1 || name.length > 20) {
    throw new Error("探险队名称必须在1到20个字符之间");
  }
  if (!expeditionAreaId) {
    throw new Error("探险队必须指定一个探险区域");
  }

  // 检查kitty是否已经处于其他探险队中
  for (const kittyUuid of kittyUuids) {
    const existingTeam = await prisma.kittyExpeditionTeam.findFirst({
      where: {
        kittyUuids: {
          contains: kittyUuid,
        },
        del: false
      }
    });

    if (existingTeam) {
      throw new Error(`有小猫咪已经在其他探险队中`);
    }
  }

  let data = await prisma.kittyExpeditionTeam.create({
    data: {
        uuid: v4(),
        owner,
        name,

        guildUuid: opt?.guildUuid ?? null,

        kittyUuids: JSON.stringify(kittyUuids),
        state: KittyExpeditionTeamState.IDLE,
        expeditionAreaId,
        turn: 0,
        startTime: null,
        endTime: null,
        reward: JSON.stringify({}),
        extra: null,
        createdAt: new Date(),
        updatedAt: new Date(),

        del: false
    }
  });

  return toKittyExpeditionTeamInGame(data)
}

export async function getAllKittyExpeditionTeams(): Promise<KittyExpeditionTeamInGame[]> {
  let data = await prisma.kittyExpeditionTeam.findMany({
    where: {
      del: false
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return data.map(toKittyExpeditionTeamInGame);
}

export async function getAllKittyExpeditionTeamUuids(): Promise<string[]> {
  let data = await prisma.kittyExpeditionTeam.findMany({
    select: {
      uuid: true
    },
    where: {
      del: false,
      state: {
        notIn: [KittyExpeditionTeamState.IDLE, KittyExpeditionTeamState.FINISHED]
      } 
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return data.map(team => team.uuid);
}

export async function getAllKittyExpeditionTeamsInGuild(guildUuid: string): Promise<KittyExpeditionTeamInGame[]> {
  let data = await prisma.kittyExpeditionTeam.findMany({
    where: {
      del: false,
      guildUuid
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return data.map(toKittyExpeditionTeamInGame);
}

export async function getKittyExpeditionTeam(uuid: string): Promise<KittyExpeditionTeamInGame | null> {
  let data = await prisma.kittyExpeditionTeam.findUnique({
    where: {
        uuid,
    }
  });

  if (!data) {
    return null
  }
  return toKittyExpeditionTeamInGame(data);
}

export async function getKittyExpeditionTeamByKittyUuid(kittyUuid: string): Promise<KittyExpeditionTeamInGame | null> {
  let data = await prisma.kittyExpeditionTeam.findFirst({
    where: {
      kittyUuids: {
        contains: kittyUuid,
      },
      del: false
    }
  });

  if (!data) {
    return null
  }

  return toKittyExpeditionTeamInGame(data);
}

export async function joinKittyExpeditionTeam(
  teamUuid: string,
  kittyUuid: string,
): Promise<KittyExpeditionTeamInGame> {
  let tx = prisma;
  let team = await tx.kittyExpeditionTeam.findUnique({
    where: { uuid: teamUuid },
  });

  if (!team || team.del) {
    throw new Error("探险队不存在或已删除");
  }

  if (team.state !== KittyExpeditionTeamState.IDLE) {
    throw new Error("探险队状态不正确，无法加入");
  }

  let kittyUuids = safeJsonParse<string[]>(team.kittyUuids, []);
  if (kittyUuids.includes(kittyUuid)) {
    throw new Error("该猫咪已经在探险队中");
  }

  if (kittyUuids.length >= BASE_KITTY_EXPEDITION_MEMBER) {
    throw new Error("探险队成员已满");
  }

  // 检查kitty是否已经处于其他探险队中
  const existingTeam = await tx.kittyExpeditionTeam.findFirst({
    where: {
      kittyUuids: {
        contains: kittyUuid,
      },
      del: false,
    },
  });
  if (existingTeam) {
    throw new Error("该猫咪已经在其他探险队中");
  }

  kittyUuids.push(kittyUuid);

  let updatedTeam = await tx.kittyExpeditionTeam.update({
    where: { uuid: teamUuid },
    data: {
      kittyUuids: JSON.stringify(kittyUuids),
      updatedAt: new Date(),
    },
  });

  return toKittyExpeditionTeamInGame(updatedTeam);
}

export async function leaveKittyExpeditionTeam(
  teamUuid: string,
  kittyUuid: string,
): Promise<KittyExpeditionTeamInGame> {
  const tx = prisma;
  let team = await tx.kittyExpeditionTeam.findUnique({
    where: { uuid: teamUuid },
  });

  if (!team || team.del) {
    throw new Error("探险队不存在或已删除");
  }

  if (team.state !== KittyExpeditionTeamState.IDLE) {
    throw new Error("探险队状态不正确，无法离开");
  }

  let kittyUuids = safeJsonParse<string[]>(team.kittyUuids, []);
  if (!kittyUuids.includes(kittyUuid)) {
    throw new Error("该猫咪不在探险队中");
  }

  kittyUuids = kittyUuids.filter((uuid) => uuid !== kittyUuid);

  let updatedTeam = await tx.kittyExpeditionTeam.update({
    where: { uuid: teamUuid },
    data: {
      kittyUuids: JSON.stringify(kittyUuids),
      updatedAt: new Date(),
    },
  });

  return toKittyExpeditionTeamInGame(updatedTeam);
}

export async function beginExpeditionTeam(
  uuid: string,
): Promise<KittyExpeditionTeamInGame> {
  let team = await prisma.kittyExpeditionTeam.findUnique({
    where: { uuid },
  });

  if (!team || team.del) {
    throw new Error("探险队不存在或已删除");
  }

  if (team.state !== KittyExpeditionTeamState.IDLE) {
    throw new Error("探险队状态不正确，无法开始探险");
  }

  if (!team.expeditionAreaId) {
    throw new Error("探险队没有指定探险区域");
  }

  let kitties = team.kittyUuids
    ? safeJsonParse<string[]>(team.kittyUuids, [])
    : [];

  if (!kitties.length) {
    throw new Error("探险队必须包含至少一只猫咪");
  }

  return prisma.$transaction(async (tx) => {
    let updatedTeam = await tx.kittyExpeditionTeam.update({
      where: { uuid },
      data: {
        state: KittyExpeditionTeamState.ON_THE_WAY,
        startTime: new Date(),
        endTime: null,
        turn: 0,
        updatedAt: new Date(),
      },
    });

    let allKittyPromise: Promise<any>[] = [];
    for (const kittyUuid of kitties) {
      allKittyPromise.push(
        tx.kitty.update({
          where: { uuid: kittyUuid },
          data: {
            isInExpedition: true,
            expeditionUuid: updatedTeam.uuid,
          },
        }),
      );
    }

    await Promise.all(allKittyPromise).catch((e) => {
      throw new Error("远行队出发失败，更新猫咪状态失败: " + e.message);
    });

    return toKittyExpeditionTeamInGame(updatedTeam);
  });
}

// 删除探险队
export async function deleteKittyExpeditionTeam(uuid: string) {
  let res = await prisma.kittyExpeditionTeam.update({
    where: { uuid },
    data: {
      del: true,
    }
  });

  return true
}

export async function updateKittyExpeditionTeamStateToExpedition(
  uuid: string,
): Promise<KittyExpeditionTeamInGame> {
  let data = await prisma.kittyExpeditionTeam.update({
    where: { uuid },
    data: {
      state: KittyExpeditionTeamState.EXPEDITION,
      updatedAt: new Date()
    }
  });
  return toKittyExpeditionTeamInGame(data);
}

export async function updateKittyExpeditionTeamStateToFinishedAndGiveReward(
  uuid: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    let data = await tx.kittyExpeditionTeam.update({
      where: { uuid },
      data: {
        state: KittyExpeditionTeamState.FINISHED,
        updatedAt: new Date()
      }
    });

    let infoInGame = toKittyExpeditionTeamInGame(data);

    for(const userUuid of Object.keys(infoInGame.reward)) {
      let reward = infoInGame.reward[userUuid];
      if (!reward) continue;

      await increaseItemCount(userUuid, reward, {
        actionName: "猫咪探险奖励",
        showModifyInfo: true,
        type: ModifyItemCountType.Kitty
      }, tx)
      await invalidateInventoryCache(userUuid);
    }

    for(const kittyUuid of infoInGame.kittyUuids) {
      await tx.kitty.update({
        where: { uuid: kittyUuid },
        data: {
          isInExpedition: false,
          expeditionUuid: null,
        }
      });
    }
  })
}

export async function refreshKittyExpeditionTeamLastRewardAt(
  uuid: string,
): Promise<KittyExpeditionTeamInGame> {
  let data = await prisma.kittyExpeditionTeam.update({
    where: { uuid },
    data: {
      lastRewardAt: new Date(),
      updatedAt: new Date()
    }
  });
  return toKittyExpeditionTeamInGame(data);
}