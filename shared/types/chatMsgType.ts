export type FTChatMsgType =
  | "text"
  | "room"
  | "item"
  | "player"
  | "system"
  | "custom"; // 可扩展

export interface FTChatMsgMetaRoom {
  type: "room";
  roomId: string;
  roomName: string;
  textStub: string;
  area?: string;
}

export interface FTChatMsgMetaItem {
  type: "item";
  itemId: string;
  itemName: string;
  textStub: string;
  count?: number;
}

export interface FTChatMsgMetaPlayer {
  type: "player";
  playerId: string;
  playerName: string;
  textStub: string;
  avatar?: string;
}

export interface FTChatMsgMetaCustom {
  type: "custom";
  [key: string]: any;
}

export type ChatMsgMetaUnit =
  | FTChatMsgMetaRoom
  | FTChatMsgMetaItem
  | FTChatMsgMetaPlayer
  | FTChatMsgMetaCustom;

// 支持一个消息包含多种类型数据，每种类型可为多个
export interface FTChatMessageMeta {
  room?: FTChatMsgMetaRoom[];
  item?: FTChatMsgMetaItem[];
  player?: FTChatMsgMetaPlayer[];
  custom?: FTChatMsgMetaCustom[];
  [key: string]: ChatMsgMetaUnit[] | undefined;
}