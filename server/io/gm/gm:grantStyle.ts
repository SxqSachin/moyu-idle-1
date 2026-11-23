import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { addBattleStyle, addProfileStyle, addChatBubbleStyle, addAvatarBorderStyle } from "~/server/utils/game/style";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetName: string; styleType: 'battle' | 'profile' | 'chatBubble' | 'avatarBorder'; styleId: string }>
) {
  const userUuid = data.user.uuid;
  const { targetName, styleType, styleId } = data.data;

  // 校验请求者是否为GM
  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) {
    emitEventToUser(data.user, "gm:grantStyle:fail", { message: "无权限" });
    return;
  }

  // 查找目标用户
  const targetUser = await prisma.user.findFirst({ where: { name: targetName } });
  if (!targetUser) {
    emitEventToUser(data.user, "gm:grantStyle:fail", { message: "目标用户不存在" });
    return;
  }

  const targetUuid = targetUser.uuid;

  try {
    switch (styleType) {
      case 'battle':
        await addBattleStyle(targetUuid, styleId as any);
        break;
      case 'profile':
        await addProfileStyle(targetUuid, styleId as any);
        break;
      case 'chatBubble':
        await addChatBubbleStyle(targetUuid, styleId as any);
        break;
      case 'avatarBorder':
        await addAvatarBorderStyle(targetUuid, styleId as any);
        break;
      default:
        throw new Error('不支持的样式类型');
    }

    // 通知GM操作成功
    emitEventToUser(data.user, "gm:grantStyle:success", { targetUuid, styleType, styleId });

    emitEventToUser(targetUser.uuid, "gm:grantStyle:apply", { styleType, styleId });

    // 可同时通知目标用户其样式被解锁
  } catch (e: any) {
    emitEventToUser(data.user, "gm:grantStyle:fail", { message: e?.message ?? String(e) });
  }
}
