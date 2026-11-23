import type { GameUserCustomStyle } from "~/shared/types/style";
import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { allBattleStyle, allProfileStyle } from "~/shared/data/allStyle";

// 查询玩家自定义风格
export function emitGetUserCustomStyle(uuid?: string) {
  emitEventToServer("style:get", { uuid });
}
export const onGetUserCustomStyleSuccess = registerSocketEventListener<{ uuid: string, style: GameUserCustomStyle }>("style:get:success");
export const onGetUserCustomStyleFail = registerSocketEventListener<{ message: string }>("style:get:fail");

// 选择当前战斗风格
export function emitSetStyle(style: GameUserCustomStyle) {
  emitEventToServer("style:setAll", { style });
}
export const onSetStyleSuccess = registerSocketEventListener<{ style: GameUserCustomStyle }>("style:setAll:success");
export const onSetStyleFail = registerSocketEventListener<{ message: string }>("style:setAll:fail");

// 选择当前战斗风格
// export function emitSetBattleStyle(styleId: keyof typeof allBattleStyle) {
//   emitEventToServer("style:setBattle", { styleId });
// }
// export const onSetBattleStyleSuccess = registerSocketEventListener<{ styleId: string }>("style:setBattle:success");
// export const onSetBattleStyleFail = registerSocketEventListener<{ message: string }>("style:setBattle:fail");

// // 选择当前聊天风格
// export function emitSetChatStyle(styleId: string) {
//   emitEventToServer("style:setChat", { styleId });
// }
// export const onSetChatStyleSuccess = registerSocketEventListener<{ styleId: string }>("style:setChat:success");
// export const onSetChatStyleFail = registerSocketEventListener<{ message: string }>("style:setChat:fail");

// // 选择当前聊天名称风格
// export function emitSetChatNameStyle(styleId: string) {
//   emitEventToServer("style:setChatName", { styleId });
// }
// export const onSetChatNameStyleSuccess = registerSocketEventListener<{ styleId: string }>("style:setChatName:success");
// export const onSetChatNameStyleFail = registerSocketEventListener<{ message: string }>("style:setChatName:fail");

// export function emitSetProfileStyle(styleId: keyof typeof allProfileStyle) {
//   emitEventToServer("style:setProfile", { styleId });
// }
// export const onSetProfileStyleSuccess = registerSocketEventListener<{ styleId: string }>("style:setBattle:success");
// export const onSetProfileStyleFail = registerSocketEventListener<{ message: string }>("style:setBattle:fail");