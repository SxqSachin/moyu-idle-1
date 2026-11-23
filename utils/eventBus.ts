
import mitt from 'mitt';
import type { FTChatMessageMeta } from '~/shared/types/chatMsgType';
import type { AlchemyAtlasEntry } from '~/shared/types/gameAlchemy';

export type EventBusSetChatContentEvents = {
  msg: string, meta: FTChatMessageMeta
}

export type EventBusJoinBattleRoomEvent = {
  roomUuid: string
}

export const eventBus = mitt<{
  'open-private-chat': { name: string; uuid: string };
  'set-chat-content': EventBusSetChatContentEvents;
  'open-chat-panel': { };
  'show-in-market': { itemId: string };
  'join-battle-room': EventBusJoinBattleRoomEvent;
  'send-chat-msg': {}

  'enhance-item': { itemId: string }
  'dismantle-item': { itemId: string }

  'use-alchemy-recipe': { recipe: AlchemyAtlasEntry }
}>();