import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import {
  getUserCustomStyle,
  addBattleStyle,
  setCurrentBattleStyle,
  setUserCustomStyle,
  setCurrentProfileStyle
} from "~/server/utils/game/style";
import { emitEventToUser } from ".";
import { allBattleStyle, allProfileStyle } from "~/shared/data/allStyle";
import { GameUserCustomStyle } from "~/shared/types/style";

/**
 * 查询玩家自定义风格
 */
export async function style_get(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuid?: string}>
) {
  const userUuid = data.data.uuid ?? data.user.uuid;
  try {
    const style = await getUserCustomStyle(userUuid);
    emitEventToUser(data.user, "style:get:success", { uuid: userUuid, style });
  } catch (e: any) {
    emitEventToUser(data.user, "style:get:fail", { message: e.message });
  }
}

export async function style_setAll(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{style: GameUserCustomStyle}>
) {
  const userUuid = data.user.uuid;
  const requestStyle = data.data.style
  try {
    await setUserCustomStyle(userUuid, requestStyle);

    const style = await getUserCustomStyle(userUuid);

    emitEventToUser(userUuid, "style:setAll:success", {style});
  } catch (e: any) {
    emitEventToUser(userUuid, "style:setAll:fail", { message: e.message });
  }
}

/**
 * 添加战斗风格
 */
// export async function style_addBattle(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ styleId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { styleId } = data.data;
//   try {
//     await addBattleStyle(userUuid, styleId);
//     emitEventToUser(userUuid, "style:addBattle:success", { styleId });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:addBattle:fail", { message: e.message });
//   }
// }

/**
 * 选择当前战斗风格
 */
export async function style_setBattle(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ styleId: keyof typeof allBattleStyle }>
) {
  const userUuid = data.user.uuid;
  const { styleId } = data.data;
  try {
    await setCurrentBattleStyle(userUuid, styleId);
    emitEventToUser(userUuid, "style:setBattle:success", { styleId });
  } catch (e: any) {
    emitEventToUser(userUuid, "style:setBattle:fail", { message: e.message });
  }
}

export async function style_setProfile(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ styleId: keyof typeof allProfileStyle}>
) {

  const userUuid = data.user.uuid;
  const { styleId } = data.data;
  try {
    await setCurrentProfileStyle(userUuid, styleId);
    emitEventToUser(userUuid, "style:setProfile:success", { styleId });
  } catch (e: any) {
    emitEventToUser(userUuid, "style:setProfile:fail", { message: e.message });
  }
}

/**
 * 添加聊天风格
 */
// export async function style_addChat(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ styleId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { styleId } = data.data;
//   try {
//     await addChatStyle(userUuid, styleId);
//     emitEventToUser(userUuid, "style:addChat:success", { styleId });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:addChat:fail", { message: e.message });
//   }
// }

/**
 * 选择当前聊天风格
 */
// export async function style_setChat(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ styleId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { styleId } = data.data;
//   try {
//     await setCurrentChatStyle(userUuid, styleId);
//     emitEventToUser(userUuid, "style:setChat:success", { styleId });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:setChat:fail", { message: e.message });
//   }
// }


/**
 * 完整设置玩家自定义风格（全部字段覆盖）
 */
// export async function style_setAll(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ style: GameUserCustomStyle}>
// ) {
//   const userUuid = data.user.uuid;
//   const { style } = data.data;
//   try {
//     await setUserCustomStyle(userUuid, style);
//     emitEventToUser(userUuid, "style:setAll:success", { style });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:setAll:fail", { message: e.message });
//   }
// }
/**
 * 添加聊天名称风格
 */
// export async function style_addChatName(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ styleId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { styleId } = data.data;
//   try {
//     await addChatNameStyle(userUuid, styleId);
//     emitEventToUser(userUuid, "style:addChatName:success", { styleId });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:addChatName:fail", { message: e.message });
//   }
// }

/**
 * 选择当前聊天名称风格
 */
// export async function style_setChatName(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ styleId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { styleId } = data.data;
//   try {
//     await setCurrentChatNameStyle(userUuid, styleId);
//     emitEventToUser(userUuid, "style:setChatName:success", { styleId });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "style:setChatName:fail", { message: e.message });
//   }
// }