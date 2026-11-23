import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as guildService from "~/server/utils/game/guild";
import { checkResourceRequirementInDB, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { CREATE_GUILD_RESOURCE_REQUIREMENT } from "~/shared/data/constant";
import { convertReseourceRequirementToItemModify } from "~/shared/utils/game/requirementCheck";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { sanitizeInput } from "~/shared/utils";

import { 
  addGuildTitle, 
  updateGuildTitle, 
  deleteGuildTitle, 
  getGuildTitles, 
  setGuildMemberTitle, 
} from "~/server/utils/game/guild";
import { GuildTitle } from "~/generated/prisma";
import { GuildRole } from "~/shared/types/guild";
import { prisma } from "~/server/utils/game/db";

// 创建公会
export async function handleCreateGuild(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ name: string; description?: string; type: string[] }>
) {
  const userUuid = data.user.uuid;
  let { name, description, type } = data.data;

  name = sanitizeInput(name)

  await withUniqueLock(`guild:create:${userUuid}`, async () => {
    // 检查是否存在同名的公会
    const existingGuild = await guildService.isGuildNameExist(name, []);
    if (existingGuild) {
      emitEventToUser(userUuid, "guild:create:fail", { message: "公会名称已存在" });
      return;
    }

    // 如果自己已经加入了公会，则不能创建
    let isInGuild = await guildService.getGuildMemberInfo(userUuid)
    if (!!isInGuild) {
      emitEventToUser(userUuid, "guild:create:fail", { message: "你已经加入了公会，不能创建新的公会" });
      return;
    }

    const checkRequirement = await checkResourceRequirementInDB(
      userUuid,
      CREATE_GUILD_RESOURCE_REQUIREMENT
    );

    if (!checkRequirement) {
      emitEventToUser(userUuid, "guild:create:fail", { message: "资源不足，无法创建公会" });
      return;
    }

    await decreaseItemCount(userUuid,
      convertReseourceRequirementToItemModify(CREATE_GUILD_RESOURCE_REQUIREMENT),
      {
        actionName: '创建公会',
        showModifyInfo: true,
        type: ModifyItemCountType.Other
      }
    )

    try {
      const guild = await guildService.createGuild({
        name,
        description,
        owner: userUuid,
        type: type
      });
      emitEventToUser(userUuid, "guild:create:success", { guild });
    } catch (e: any) {
      emitEventToUser(userUuid, "guild:create:fail", { message: e.message || "创建失败" });
    }
  })
}

export async function handleGetMyGuildMemberInfo(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{guildUuid: string}>
) {
  const userUuid = data.user.uuid;
  const guildUuid = data.data.guildUuid;
  try {
    const member = await prisma.guildMember.findFirst({
      where: {
        guildUuid: guildUuid,
        userUuid: userUuid
      }
    });

    if (!member) {
      emitEventToUser(userUuid, "guild:getMyGuildMemberInfo:fail", {message: "获取失败"});
    }

    emitEventToUser(userUuid, "guild:getMyGuildMemberInfo:success", { guildUuid, member });

  } catch (e: any) {
    emitEventToUser(userUuid, "guild:getMyGuildMemberInfo:fail", { message: "获取失败" });
  }
}

// 获取公会列表
export async function handleGetGuildList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const list = await guildService.listGuilds();
    emitEventToUser(userUuid, "guild:list", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:list:fail", { message: e.message || "获取失败" });
  }
}

// 申请加入公会
export async function handleRequestJoinGuild(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; message?: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, message } = data.data;
  try {
    await guildService.requestJoinGuild(userUuid, guildUuid, message);
    emitEventToUser(userUuid, "guild:join:request:success", { guildUuid });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:join:request:fail", { message: e.message || "申请失败" });
  }
}

// 审核入会申请
export async function handleHandleJoinRequest(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; userUuid: string; approve: boolean }>
) {
  const handlerUuid = data.user.uuid;
  const { guildUuid, userUuid, approve } = data.data;
  
  let guild = await guildService.getGuildByUuid(guildUuid);

  if (!guild) {
    emitEventToUser(handlerUuid, "guild:join:handle:fail", { message: "公会不存在" });
    return
  }

  let guildMemberInfo = await prisma.guildMember.findFirst({
    where: {
      guildUuid: guildUuid,
      userUuid: handlerUuid
    }
  });
  
  if (!guildMemberInfo) {
    emitEventToUser(handlerUuid, "guild:join:handle:fail", { message: "你不在该公会中" });
    return;
  }

  if (guildMemberInfo.role !== GuildRole.LEADER && guildMemberInfo.role !== GuildRole.OFFICER) {
    emitEventToUser(handlerUuid, "guild:join:handle:fail", { message: "无权限操作" });
    return;
  }

  try {
    await guildService.handleJoinRequest(guildUuid, userUuid, approve, handlerUuid);
    emitEventToUser(handlerUuid, "guild:join:handle:success", { userUuid, approve });
    emitEventToUser(userUuid, "guild:join:result", { guildUuid, approve });
  } catch (e: any) {
    emitEventToUser(handlerUuid, "guild:join:handle:fail", { message: e.message || "操作失败" });
  }
}

// 获取公会成员列表
export async function handleGetGuildMembers(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;
  try {
    const members = await guildService.getGuildMembers(guildUuid);
    emitEventToUser(userUuid, "guild:members", { guildUuid, members });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:members:fail", { message: e.message || "获取失败" });
  }
}

// 编辑公会信息
export async function handleUpdateGuildInfo(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; name: string; description: string; type: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, ...updateData } = data.data;

  let guild = await guildService.getGuildByUuid(guildUuid);
  if (!guild || guild.owner !== userUuid) {
    emitEventToUser(userUuid, "guild:update:fail", { message: "无权限操作" });
    return;
  }

  // 检查除了本公会外，是否有名称冲突
  const existingGuild = await guildService.isGuildNameExist(updateData.name, [guildUuid]);

  if (existingGuild) {
    emitEventToUser(userUuid, "guild:update:fail", { message: "公会名称已存在" });
    return;
  }

  updateData.name = sanitizeInput(updateData.name)

  try {
    const guild = await guildService.updateGuildInfo(guildUuid, {
      name: updateData.name,
      description: updateData.description,
      type: !Array.isArray(updateData.type) ? updateData.type.split(",") : updateData.type
    });
    emitEventToUser(userUuid, "guild:update:success", { guild });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:update:fail", { message: e.message || "修改失败" });
  }
}

// 踢出成员
export async function handleKickMember(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; userUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, userUuid: targetUserUuid } = data.data;
  try {
    const guild = await guildService.getGuildByUuid(guildUuid);

    if (!guild) {
      emitEventToUser(userUuid, "guild:kick:fail", { message: "公会不存在" });
      return;
    }

    let guildMemberInfo = await prisma.guildMember.findFirst({
      where: {
        guildUuid: guildUuid,
        userUuid: userUuid
      }
    });
  
    if (!guildMemberInfo) {
      emitEventToUser(userUuid, "guild:kick:fail", { message: "你不在该公会中" });
      return;
    }

    if (guildMemberInfo.role !== GuildRole.LEADER && guildMemberInfo.role !== GuildRole.OFFICER) {
      emitEventToUser(userUuid, "guild:kick:fail", { message: "无权限操作" });
      return;
    }

    await guildService.kickMember(guildUuid, targetUserUuid);
    emitEventToUser(userUuid, "guild:kick:success", { userUuid: targetUserUuid });
    emitEventToUser(targetUserUuid, "guild:kicked", { guildUuid });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:kick:fail", { message: e.message || "操作失败" });
  }
}

// 解散公会
export async function handleDisbandGuild(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;

  let guild = await guildService.getGuildByUuid(guildUuid);
  if (!guild || guild.owner !== userUuid) {
    emitEventToUser(userUuid, "guild:disband:fail", { message: "无权限操作" });
    return;
  }

  try {
    await guildService.disbandGuild(guildUuid);
    emitEventToUser(userUuid, "guild:disband:success", { guildUuid });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:disband:fail", { message: e.message || "操作失败" });
  }
}

// 转让会长
export async function handleTransferGuildOwner(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; newOwnerUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, newOwnerUuid } = data.data;

  let guild = await guildService.getGuildByUuid(guildUuid);
  if (!guild || guild.owner !== userUuid) {
    emitEventToUser(userUuid, "guild:transfer:fail", { message: "无权限操作" });
    return;
  }

  try {
    await guildService.transferGuildOwner(guildUuid, newOwnerUuid);
    emitEventToUser(userUuid, "guild:transfer:success", { newOwnerUuid });
    emitEventToUser(newOwnerUuid, "guild:transfer:received", { guildUuid });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:transfer:fail", { message: e.message || "操作失败" });
  }
}

// 获取公会入会申请列表
export async function handleGetGuildJoinRequests(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;
  try {
    const requests = await guildService.listGuildJoinRequests(guildUuid);
    emitEventToUser(userUuid, "guild:join:requests", { guildUuid, requests });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:join:requests:fail", { message: e.message || "获取失败" });
  }
}

// 获取用户的入会申请
export async function handleGetUserJoinRequests(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const requests = await guildService.getUserJoinRequests(userUuid);
    emitEventToUser(userUuid, "guild:join:myrequests", { requests });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:join:myrequests:fail", { message: e.message || "获取失败" });
  }
}

export async function handleGetMyGuild (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const guild = await guildService.getGuildByUserUuid(data.user.uuid)
    emitEventToUser(userUuid, "guild:getMyGuild:success", { guild });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:getMyGuild:fail", { message: e.message || "获取失败" });
  }
}

export async function handleGetOtherGuildInfo (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  try {
    const guild = await guildService.getGuildByUuid(data.data.guildUuid)
    emitEventToUser(userUuid, "guild:getOtherGuild:success", { guild });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:geOtheryGuild:fail", { message: e.message || "获取失败" });
  }
}

export async function handleLeaveGuild (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;

  const { guildUuid } = data.data;

  try {
    await guildService.leaveGuild(userUuid, guildUuid);
    emitEventToUser(userUuid, "guild:leave:success", { guildUuid });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:leavel:fail", { message: e.message || "离开公会失败" });
  }
}

// 添加头衔
export async function handleAddGuildTitle(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; title: string; role: GuildRole; description?: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, title, role, description } = data.data;
  try {
    await addGuildTitle(userUuid, guildUuid, title, role, description);
    emitEventToUser(userUuid, "guild:title:add:success", { guildUuid, title });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:title:add:fail", { message: e.message || "添加失败" });
  }
}

// 修改头衔
export async function handleUpdateGuildTitle(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; titleUuid: string; title: string; role: GuildRole; description?: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, titleUuid, title, role, description } = data.data;
  await withUniqueLock(`guild:title:update:${guildUuid}`, async () => {
    try {
      await updateGuildTitle(userUuid, guildUuid, titleUuid, title, role, description);
      emitEventToUser(userUuid, "guild:title:update:success", { guildUuid, titleUuid });
    } catch (e: any) {
      emitEventToUser(userUuid, "guild:title:update:fail", { message: e.message || "修改失败" });
    }
  })
}

// 删除头衔
export async function handleDeleteGuildTitle(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; titleUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, titleUuid } = data.data;
  await withUniqueLock(`guild:title:update:${guildUuid}`, async () => {
    try {
      await deleteGuildTitle(userUuid, guildUuid, titleUuid);
      emitEventToUser(userUuid, "guild:title:delete:success", { guildUuid, titleUuid });
    } catch (e: any) {
      emitEventToUser(userUuid, "guild:title:delete:fail", { message: e.message || "删除失败" });
    }
  })
}

// 获取公会所有头衔
export async function handleGetGuildTitles(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;
  try {
    const titles = await getGuildTitles(guildUuid);
    emitEventToUser(userUuid, "guild:title:list:success", { guildUuid, titles });
  } catch (e: any) {
    emitEventToUser(userUuid, "guild:title:list:fail", { message: e.message || "获取失败" });
  }
}

// 为玩家修改头衔
export async function handleSetGuildMemberTitle(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; userUuid: string; titleUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, userUuid: targetUserUuid, titleUuid } = data.data;
  await withUniqueLock(`guild:title:update:${guildUuid}:${targetUserUuid}`, async () => {
    try {
      await setGuildMemberTitle(userUuid, guildUuid, targetUserUuid, titleUuid);
      emitEventToUser(userUuid, "guild:title:set:success", { guildUuid, userUuid: targetUserUuid, titleUuid });
    } catch (e: any) {
      emitEventToUser(userUuid, "guild:title:set:fail", { message: e.message || "设置失败" });
    }
  })
}