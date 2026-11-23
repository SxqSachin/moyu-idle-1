import { GameGuild, GuildRole } from "~/shared/types/guild";
import { prisma } from "./db";
import { v4 } from "uuid";
import { describe } from "node:test";
import { sanitizeInput } from "~/shared/utils";
import { BASE_GUILD_MEMBER_COUNT } from "~/shared/data/constant";
import { isAllIronCatOrNot, isIronCat, isSameAccountPlayType } from "./account";
import { AccountPlayType } from "~/shared/types/account";
import { allGuildBuilding } from "~/shared/data/allGuildBuilding";

/**
 * 创建公会
 */
export async function createGuild(params: {
  name: string;
  description?: string;
  owner: string;
  type?: string[];
}): Promise<GameGuild> {
  const uuid = crypto.randomUUID();
  const guild = await prisma.guild.create({
    data: {
      uuid,
      name: params.name,
      description: params.description,
      owner: params.owner,
      type: params.type ? params.type.join(",") : undefined,
      ironcat: await isIronCat(params.owner)
    }
  });
  // 创建者自动成为会长
  await prisma.guildMember.create({
    data: {
      guildUuid: uuid,
      userUuid: params.owner,
      role: "LEADER",
    }
  });
  // 用户表可选：同步guild字段
  await prisma.user.update({
    where: { uuid: params.owner },
    data: { guild: uuid }
  });

  const gameGuild: GameGuild = {
    id: guild.id,
    uuid: guild.uuid,
    name: guild.name,
    description: guild.description ?? null,
    owner: guild.owner,
    create_date: guild.create_date,
    update_date: guild.update_date,
    is_open: guild.is_open,
    is_active: guild.is_active,
    is_deleted: guild.is_deleted,
    type: guild.type ? guild.type.split(",") : [],
    gold: 0, // 初始金币为0
    level: 1, // 初始等级为1
    experience: 0, // 初始经验为0,
    ironcat: !!guild.ironcat
  }

  return gameGuild
}

/**
 * 获取公会列表
 */
export async function listGuilds(): Promise<GameGuild[]> {
  const guilds = await prisma.guild.findMany({
    where: { is_deleted: false, is_active: true }
  });
  return guilds.map(guild => ({
    id: guild.id,
    uuid: guild.uuid,
    name: guild.name,
    description: guild.description ?? null,
    owner: guild.owner,
    create_date: guild.create_date,
    update_date: guild.update_date,
    is_open: guild.is_open,
    is_active: guild.is_active,
    is_deleted: guild.is_deleted,
    type: guild.type ? guild.type.split(",") : [],
    gold: guild.gold,
    level: guild.level,
    experience: guild.experience,
    ironcat: !!guild.ironcat
  }));
}

/**
 * 申请加入公会（发起申请，等待审核）
 */
export async function requestJoinGuild(userUuid: string, guildUuid: string, message?: string): Promise<void> {
  let guildInfo = await prisma.guild.findUnique({
    where: { uuid: guildUuid },
    select: { owner: true }
  });

  if (!guildInfo) {
    throw new Error("公会不存在，请刷新后重试");
  }

  let accountPlayTypeCheck = await isSameAccountPlayType(userUuid, guildInfo.owner)
  if (!accountPlayTypeCheck.isSame) {
    if (accountPlayTypeCheck.myAccountPlayType == AccountPlayType.IRON) {
      throw new Error("您无法加入非铁猫工会");
    }
    if (accountPlayTypeCheck.myAccountPlayType == AccountPlayType.NORMAL) {
      throw new Error("您无法加入铁猫工会");
    }
  }

  let currentGuildMemberCount = await prisma.guildMember.count({
    where: { guildUuid }
  });

  const guildMemberCount = await getGuildMaxMemberCount(guildUuid);
  if (currentGuildMemberCount >= guildMemberCount) {
    throw new Error("公会成员已满，无法加入");
  }

  await prisma.guildJoinRequest.upsert({
    where: { guildUuid_userUuid: { guildUuid, userUuid } },
    update: { message, status: "PENDING" },
    create: { guildUuid, userUuid, message, status: "PENDING" }
  });
}

/**
 * 审核入会申请
 */
export async function handleJoinRequest(
  guildUuid: string,
  userUuid: string,
  approve: boolean,
  handledBy: string
): Promise<void> {

  await prisma.$transaction(async (tx) => {
    // 检查公会是否存在
    const guild = await tx.guild.findUnique({
      where: { uuid: guildUuid }
    });
    if (!guild) {
      throw new Error("公会不存在");
    }

    // 检查用户是否已经是公会成员
    const alreadyMember = await tx.guildMember.findFirst({
      where: { guildUuid, userUuid }
    });
    if (alreadyMember) {
      await tx.guildJoinRequest.update({
        where: { guildUuid_userUuid: { guildUuid, userUuid } },
        data: {
          status: "APPROVED",
          handledBy,
          handledAt: new Date(),
        },
      });
      return
    }

    // 检查用户是否已经在其他公会中
    const existingMember = await tx.guildMember.findFirst({
      where: { 
        userUuid,
        guildUuid: { not: guildUuid } // 确保不是当前公会
      }
    });
    if (existingMember) {
      // todo 这里用了prisma而非tx
      await prisma.guildJoinRequest.update({
        where: {
          guildUuid_userUuid: { guildUuid, userUuid }
        },
        data: {
          status: "CLOSED",
          handledBy,
          handledAt: new Date(),
        },
      });
      throw new Error("用户已在其他公会中");
    }

    let currentGuildMemberCount = await tx.guildMember.count({
      where: { guildUuid },
    });

    const guildMemberCount = await getGuildMaxMemberCount(guildUuid);
    if (currentGuildMemberCount >= guildMemberCount) {
      throw new Error("公会成员已满，无法加入");
    }

    let accountPlayTypeCheck = await isSameAccountPlayType(guild.owner, userUuid);
    if (!accountPlayTypeCheck.isSame) {
      if (accountPlayTypeCheck.myAccountPlayType == AccountPlayType.IRON) {
        throw new Error("此玩家无法加入铁猫工会");
      }
      if (accountPlayTypeCheck.myAccountPlayType == AccountPlayType.NORMAL) {
        throw new Error("此玩家无法加入非铁猫工会");
      }
    }

    await tx.guildJoinRequest.update({
      where: { guildUuid_userUuid: { guildUuid, userUuid } },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        handledBy,
        handledAt: new Date(),
      },
    });
    if (approve) {
      // 添加成员
      await tx.guildMember.create({
        data: {
          guildUuid,
          userUuid,
          role: "MEMBER",
        },
      });
      // 用户表可选：同步guild字段
      await tx.user.update({
        where: { uuid: userUuid },
        data: { guild: guildUuid },
      });

      // 关闭其他请求
      await tx.guildJoinRequest.updateMany({
        where: {
          userUuid,
          guildUuid: { not: guildUuid },
          status: "PENDING",
        },
        data: {
          status: "CLOSED",
          handledAt: new Date(),
        },
      });
    }
  });
}

/**
 * 查询公会成员
 */
export async function getGuildMembers(guildUuid: string): Promise<{ uuid: string, title: string | null, role: string }[]> {
  return (await prisma.guildMember.findMany({
    where: { guildUuid },
    select: { userUuid: true, title: true, role: true, },
  })).map(m => ({
    uuid: m.userUuid,
    title: m.title,
    role: m.role
  }));
}

/**
 * 编辑公会信息
 */
export async function updateGuildInfo(
  guildUuid: string,
  data: Partial<Pick<GameGuild, 'name' | 'description' | 'type'>>
): Promise<GameGuild | null> {
  const guild = await prisma.guild.update({
    where: { uuid: guildUuid },
    data: {
      name: data.name,
      description: data.description,
      type: data.type ? data.type.join(",") : "", // 确保type是字符串
    }
  });

if (!guild) {
    return null
  }

  const gameGuild: GameGuild = {
    id: guild.id,
    uuid: guild.uuid,
    name: guild.name,
    description: guild.description ?? null,
    owner: guild.owner,
    create_date: guild.create_date,
    update_date: guild.update_date,
    is_open: guild.is_open,
    is_active: guild.is_active,
    is_deleted: guild.is_deleted,
    type: guild.type ? guild.type.split(",") : [],
    gold: guild.gold,
    level: guild.level,
    experience: guild.experience,
    ironcat: !!guild.ironcat
  };
  return gameGuild
}

/**
 * 踢出成员
 */
export async function kickMember(guildUuid: string, userUuid: string): Promise<void> {
  await prisma.guildMember.deleteMany({
    where: { guildUuid, userUuid }
  });
  // 用户表可选：同步guild字段
  await prisma.user.updateMany({
    where: { uuid: userUuid, guild: guildUuid },
    data: { guild: null, guildTitle: null }
  });
}

/**
 * 解散公会
 */
export async function disbandGuild(guildUuid: string): Promise<void> {
  await prisma.guild.update({
    where: { uuid: guildUuid },
    data: { is_deleted: true }
  });
  await prisma.guildMember.deleteMany({
    where: { guildUuid }
  });
  await prisma.user.updateMany({
    where: { guild: guildUuid },
    data: { guild: null, guildTitle: null }
  });
}

/**
 * 转让会长
 */
export async function transferGuildOwner(guildUuid: string, newOwnerUuid: string): Promise<void> {
  // 1. 更新guild表owner
  await prisma.guild.update({
    where: { uuid: guildUuid },
    data: { owner: newOwnerUuid }
  });
  // 2. guildMember表角色变更
  await prisma.guildMember.updateMany({
    where: { guildUuid },
    data: { role: "MEMBER" }
  });
  await prisma.guildMember.updateMany({
    where: { guildUuid, userUuid: newOwnerUuid },
    data: { role: "LEADER" }
  });
}

/**
 * 查询用户所在公会
 */
export async function getGuildByUserUuid(userUuid: string): Promise<GameGuild | null> {
  const member = await prisma.guildMember.findFirst({
    where: { userUuid }
  });
  if (!member) return null;
  const guild = await prisma.guild.findUnique({ where: { uuid: member.guildUuid } });
  if (!guild) {
    return null
  }

  const gameGuild: GameGuild = {
    id: guild.id,
    uuid: guild.uuid,
    name: guild.name,
    description: guild.description ?? null,
    owner: guild.owner,
    create_date: guild.create_date,
    update_date: guild.update_date,
    is_open: guild.is_open,
    is_active: guild.is_active,
    is_deleted: guild.is_deleted,
    type: guild.type ? guild.type.split(",") : [],
    gold: guild.gold,
    level: guild.level,
    experience: guild.experience,
    ironcat: !!guild.ironcat
  };
  return gameGuild
}

/**
 * 查询公会基本信息
 */
export async function getGuildByUuid(guildUuid: string): Promise<GameGuild | null> {
  const guild = await prisma.guild.findUnique({ where: { uuid: guildUuid } });
  if (!guild) {
    return null
  }

  const gameGuild: GameGuild = {
    id: guild.id,
    uuid: guild.uuid,
    name: guild.name,
    description: guild.description ?? null,
    owner: guild.owner,
    create_date: guild.create_date,
    update_date: guild.update_date,
    is_open: guild.is_open,
    is_active: guild.is_active,
    is_deleted: guild.is_deleted,
    type: guild.type ? guild.type.split(",") : [],
    gold: guild.gold,
    level: guild.level,
    experience: guild.experience,
    ironcat: !!guild.ironcat
  };
  return gameGuild
}

/**
 * 查询公会的入会申请列表
 */
export async function listGuildJoinRequests(guildUuid: string) {
  return (await prisma.guildJoinRequest.findMany({
    where: { 
      guildUuid,
      status: 'PENDING'
    },
  })).map(request => ({
    userUuid: request.userUuid,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt
  }));
}

/**
 * 查询用户的入会申请
 */
export async function getUserJoinRequests(userUuid: string): Promise<
  { guildUuid: string; message: string | null; status: string; createdAt: Date }[]
> {
  let res = await prisma.guildJoinRequest.findMany({
    where: { 
      userUuid,
      status: 'PENDING'
    },
    select: {
        guildUuid: true,
        message: true,
        status: true,
        createdAt: true
    }
  });

  return res
}

export async function isGuildNameExist(name: string, whiteListGuildUuid: string[]): Promise<boolean> {
  if (!whiteListGuildUuid.length) {
    whiteListGuildUuid = []
  }
  const guildCount = await prisma.guild.count({
    where: { 
      name,
      is_deleted: false,
      is_active: true,
      is_open: true,
      NOT: {
        uuid: { in: whiteListGuildUuid }
      }
    }
  });
  return guildCount > 0;
}

export async function getGuildMemberInfo(userUuid: string): Promise<{
  guildUuid: string;
  role: string;
  title: string | null;
} | null> {
  const member = await prisma.guildMember.findFirst({
    where: { userUuid }
  });
  if (!member) return null;
  return {
    guildUuid: member.guildUuid,
    role: member.role,
    title: member.title
  };
}

export async function isUserInGuild(userUuid: string, guildUuid: string): Promise<boolean> {
  const member = await prisma.guildMember.findUnique({
    where: {
      guildUuid_userUuid: { guildUuid, userUuid }
    }
  });
  return !!member;
}

export async function leaveGuild(userUuid: string, guildUuid: string): Promise<void> {
  // 检查该成员是否属于此公会
  const member = await prisma.guildMember.findUnique({
    where: {
      guildUuid_userUuid: { guildUuid, userUuid }
    }
  });

  if (!member) {
    throw new Error("你不在该公会中");
  }
  // 不能让会长直接离开（可选，防止无主公会）
  if (member.role === "LEADER") {
    throw new Error("会长不能直接离开公会，请先转让会长或解散公会");
  }

  // 删除成员
  await prisma.guildMember.delete({
    where: {
      guildUuid_userUuid: { guildUuid, userUuid }
    }
  });

  // 清理用户表中的 guild 字段
  await prisma.user.updateMany({
    where: { uuid: userUuid, guild: guildUuid },
    data: { guild: null }
  });
}

/**
 * 添加一种新的头衔
 */
export async function addGuildTitle(actionUserUuid: string, guildUuid: string, title: string, role: GuildRole, description?: string) {

  if (title.length <= 0) {
    throw new Error("头衔名称不能为空");
  }

  if (title.length > 12) {
    throw new Error("头衔名称不能超过12个字");
  }

  title = sanitizeInput(title)
  description = sanitizeInput(description || "");

  await prisma.$transaction(async (tx) => {
    let guild = await tx.guild.findUnique({
      where: { uuid: guildUuid }
    });

    if (!guild) {
      throw new Error("公会不存在");
    }

    let actionUserInGuild = await tx.guildMember.findFirst({
      where: { guildUuid, userUuid: actionUserUuid }
    });

    if (!actionUserInGuild) {
      throw new Error("你不在该公会中");
    }

    console.log(actionUserInGuild)

    if (actionUserInGuild.role != GuildRole.LEADER) {
      throw new Error("只有会长才能新增头衔");
    }

    // 检查重名
    const existingTitle = await tx.guildTitle.findFirst({
      where: { guildUuid, title }
    });

    if (existingTitle) {
      throw new Error("头衔名称已存在");
    }

    // 创建新的头衔
    await tx.guildTitle.create({
      data: {
        uuid: v4(),
        guildUuid,
        title,
        role,
        description,
        permissions: JSON.stringify([]) // 初始权限为空数组
      }
    });
  })
}

/**
 * 修改一种现有头衔
 */
export async function updateGuildTitle(actionUserUuid: string, guildUuid: string, titleUuid: string, title: string, role: GuildRole, description?: string) {
  if (title.length <= 0) {
    throw new Error("头衔名称不能为空");
  }

  if (title.length > 12) {
    throw new Error("头衔名称不能超过12个字");
  }

  title = sanitizeInput(title)
  description = sanitizeInput(description || "");

  await prisma.$transaction(async (tx) => {
    let guild = await tx.guild.findUnique({
      where: { uuid: guildUuid }
    });

    if (!guild) {
      throw new Error("公会不存在");
    }

    let actionUserInGuild = await tx.guildMember.findFirst({
      where: { guildUuid, userUuid: actionUserUuid }
    });

    if (!actionUserInGuild) {
      throw new Error("你不在该公会中");
    }
    if (actionUserInGuild.role != GuildRole.LEADER) {
      throw new Error("只有会长才能修改头衔");
    }

    let currentTitle = await tx.guildTitle.findFirst({
      where: { uuid: titleUuid, guildUuid }
    });

    if (!currentTitle) {
      throw new Error("头衔不存在或不属于该公会");
    }

    // 检查是否有重复的头衔名称
    const existingTitle = await tx.guildTitle.findFirst({
      where: { 
        uuid: { not: titleUuid }, // 排除当前头衔
        guildUuid,
        title
      }
    })

    if (existingTitle) {
      throw new Error("头衔名称已存在");
    }

    // 更新头衔
    await tx.guildTitle.update({
      where: { uuid: titleUuid, guildUuid },
      data: {
        title,
        role,
        description,
      }
    });

    let allMemberWithTitle = await tx.guildMember.findMany({
      select: {
        userUuid: true
      },
      where: { guildUuid, title: currentTitle.title }
    });

    let userUuidList = allMemberWithTitle.map(m => m.userUuid);

    // 更新所有成员的头衔
    await tx.guildMember.updateMany({
      where: { guildUuid, userUuid: { in: userUuidList } },
      data: { 
        title,
        role
      }
    });

    await tx.user.updateMany({
      where: {
        guild: guildUuid,
        uuid: { in: userUuidList },
      },
      data: {
        guildTitle: title // 同步到用户表
      }
    })
  });
}

/**
 * 删除一种现有头衔
 */
export async function deleteGuildTitle(actionUserUuid: string, guildUuid: string, titleUuid: string) {
  await prisma.$transaction(async (tx) => {
    let guild = await tx.guild.findUnique({
      where: { uuid: guildUuid }
    });

    if (!guild) {
      throw new Error("公会不存在");
    }

    let actionUserInGuild = await tx.guildMember.findFirst({
      where: { guildUuid, userUuid: actionUserUuid }
    });

    if (!actionUserInGuild) {
      throw new Error("你不在该公会中");
    }
    if (actionUserInGuild.role != GuildRole.LEADER) {
      throw new Error("只有会长才能删除头衔");
    }

    // 获取现有头衔
    const currentTitle = await tx.guildTitle.findFirst({
      where: { uuid: titleUuid, guildUuid }
    });

    if (!currentTitle) {
      throw new Error("头衔不存在或不属于该公会");
    }
    // 删除头衔
    await tx.guildTitle.delete({
      where: { uuid: titleUuid, guildUuid }
    });

    if (currentTitle.role == GuildRole.LEADER) {
      // 删除拥有此头衔的成员的头衔信息
      await tx.guildMember.updateMany({
        where: { guildUuid, title: currentTitle.title },
        data: { title: null, role: GuildRole.LEADER } // 重置为会长
      });
    } else {
      await tx.guildMember.updateMany({
        where: { guildUuid, title: currentTitle.title },
        data: { title: null, role: GuildRole.MEMBER } // 重置为普通成员
      });
    }

    await tx.user.updateMany({
      where: {
        guild: guildUuid,
        guildTitle: currentTitle.title
      }, 
      data: {
        guildTitle: null
      }
    })
  })
}

/**
 * 获取公会所有头衔
 */
export async function getGuildTitles(guildUuid: string) {
  const list = await prisma.guildTitle.findMany({
    where: { guildUuid }
  });
  // 解析权限为数组
  return list.map(t => ({
    uuid: t.uuid,
    title: t.title,
    role: t.role,
    description: t.description
  }));
}

/**
 * 为玩家修改头衔
 */
export async function setGuildMemberTitle(actionUserUuid: string, guildUuid: string, userUuid: string, titleUuid: string) {
  await prisma.$transaction(async (tx) => {
    let guild = await tx.guild.findUnique({
      where: { uuid: guildUuid }
    });

    if (!guild) {
      throw new Error("公会不存在");
    }

    let actionUserInGuild = await tx.guildMember.findFirst({
      where: { guildUuid, userUuid: actionUserUuid }
    });

    if (!actionUserInGuild) {
      throw new Error("你不在该公会中");
    }
    // if (actionUserInGuild.role != GuildRole.LEADER) {
    //   throw new Error("只有会长才能修改头衔");
    // }

    // 检查头衔是否存在
    const title = await tx.guildTitle.findFirst({
      where: { uuid: titleUuid, guildUuid }
    });

    if (!title) {
      throw new Error("头衔不存在或不属于该公会");
    }

    if (title.role == GuildRole.LEADER && userUuid != guild.owner) {
      throw new Error("无法设置会长头衔给其他成员");
    }

    if (title.role != GuildRole.LEADER && userUuid == guild.owner) {
      throw new Error("会长只能拥有会长头衔");
    }

    if (actionUserInGuild.role != GuildRole.LEADER && actionUserInGuild.role != GuildRole.OFFICER) {
      throw new Error("只有会长猫猫和组长猫猫可以修改头衔");
    }

    if (actionUserInGuild.role == GuildRole.OFFICER && title.role != GuildRole.MEMBER) {
      throw new Error("组长猫猫只能修改成员猫猫的头衔");
    }

    // 更新成员的头衔
    await tx.guildMember.update({
      where: { guildUuid_userUuid: { guildUuid, userUuid } },
      data: {
        title: title.title,
        role: title.role // 同时更新角色
      }
    });

    await tx.user.update({
      where: { uuid: userUuid },
      data: { guildTitle: title.title } // 同步到用户表
    });
  })
}

export async function getGuildMaxMemberCount(guildUuid: string): Promise<number> {
  const base = BASE_GUILD_MEMBER_COUNT;
  // 查询公会建筑
  const buildings = await prisma.guildBuilding.findMany({
    where: { guildUuid }
  });

  let extra = 0;
  for (let b of buildings) {
    if (b.type == "bigCozyDen") {

      const buildEffect = allGuildBuilding.bigCozyDen.effect(b.level);

      extra += buildEffect.maxGuildMemberIncrease;
    }
  }

  return base + extra;
}