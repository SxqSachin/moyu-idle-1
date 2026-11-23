<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-700 p-4 pt-2 px-2">
    <el-tabs v-model="activeTab" class="mb-2" 
    type="card"
    closable
    @edit="handleTabsEdit">
      <el-tab-pane :closable="false" name="public">
        <template #label>
          <span class="relative">
            世界频道
            <span v-if="unread.public" class="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </span>
        </template>
        <GameChatPanel
          ref="publicPanel"
          :visible="visible && activeTab === 'public'"
          :messages="publicMessages"
          @send="msg => sendPublic(msg)"
          @show-player-info="showPlayerInfo"
          @chat="openPrivateChat"
        />
      </el-tab-pane>
      <el-tab-pane :closable="false" name="ironcat">
        <template #label>
          <span class="relative">
            硬核喵频道
            <span v-if="unread.ironcat" class="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </span>
        </template>
        <GameChatPanel
          ref="ironcatPanel"
          :visible="visible && activeTab === 'ironcat'"
          :messages="ironcatMessages"
          @send="msg => sendIroncat(msg)"
          @show-player-info="showPlayerInfo"
          @chat="openIroncatChat"
        />
      </el-tab-pane>
      <el-tab-pane v-if="myGuild" :closable="false" name="guild">
        <template #label>
          <span class="relative">
            公会
            <span v-if="unread.guild" class="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </span>
        </template>
        <GameChatPanel
          ref="guildPanel"
          :visible="visible && activeTab === 'guild'"
          :messages="guildMessages"
          @send="msg => sendGuild(msg)"
          @show-player-info="showPlayerInfo"
          @chat="openGuildChat"
        />
      </el-tab-pane>
      <el-tab-pane
        v-for="nu in privateTabs"
        :key="nu.key"
        :label="`${nu.name.slice(0, 8)}`"
        :name="`private-${nu.key}`"
        lazy
      >
        <template #label>
          <span class="relative">
            {{ nu.name.slice(0, 8) }}
            <span v-if="unread[nu.key]" class="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </span>
        </template>

        <GameChatPanel
          :messages="privateMessages[nu.key] || []"
          :visible="visible && activeTab === `private-${nu.key}`"
          @send="msg => sendPrivate(nu.otherSide, msg)"
          @show-player-info="showPlayerInfo"
          @chat="openPrivateChat"
        />
      </el-tab-pane>
      <el-tab-pane
        v-for="nu in roomTabs"
        :key="nu.key"
        :label="`${nu.name}`"
        :name="`${nu.key}`"
        lazy
      >
        <template #label>
          <span class="relative">
            {{ nu.name.slice(0, 14) }}
            <span v-if="unread[nu.key]" class="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </span>
        </template>

        <GameChatPanel
          :messages="roomMessages[nu.key] || []"
          :visible="visible && activeTab === nu.key"
          @send="msg => sendRoomMsg(nu.roomId, msg)"
          @show-player-info="showPlayerInfo"
          @chat="openPrivateChat"
        />
      </el-tab-pane>
    </el-tabs>
    <!-- 玩家信息弹窗 -->
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true" :append-to-body="true"
      :close-on-click-modal="true" destroy-on-close>
      <template #header>
        <span>玩家信息</span>
      </template>
      <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue"
import { emitCreatePublicChatMsg, onNewPublicChatMsg, emitGetPublicChatList, onGetPublicChatListSuccess, onCreateChatMsgError,
  emitCreatePrivateChatMsg, emitGetPrivateChatList, onGetPrivateChatListSuccess, onCreatePrivateChatMsgError,
  onReceivePrivateChatMsg,
  emitGetAllPrivateChatList,
  onGetAllPrivateChatListSuccess,
  onGetRoomChatListSuccess,
  emitCreateRoomChatMsg,
  emitGetRoomChatList,
  onNewRoomChatMsg,
  onNewGuildChatMsg,
  emitCreateGuildChatMsg,
  emitGetGuildChatList,
  onGetGuildChatListError,
  onGetGuildChatListSuccess,
  emitCreateIronPublicChatMsg,
  onNewIronPublicChatMsg,
  onGetIronPublicChatListSuccess,
  emitGetIronPublicChatList,
  onCreateCommentError
} from "@/api/game/socket/chat"
import type { ChatMessage } from "~/shared/types/chat"
import { ElMessage, type TabPaneName } from "element-plus"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { emitGetCurrentBattleRoom, onGetCurrentBattleRoomSuccess, onJoinBattleRoomSuccess, onLeaveBattleRoomSuccess } from "~/api/game/socket/battleRoom"
import { useMyGuild } from "~/composables/game/useMyGuild"
import { useIronCat } from "~/composables/game/useIronCat"

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits<{
  (e: "new-message"): void
}>()

// 标签页
const activeTab = ref("public")

const {user} = useUserSession()

const ironcat = useIronCat()

const selfUuid = computed(() => {
  // @ts-expect-error
  return user.value.uuid;
})

// 公聊
const publicMessages = ref<ChatMessage[]>([])

// 私聊
const privateTabs = ref<{name: string, otherSide: string, key: string}[]>([])
const privateMessages = reactive<Record<string, ChatMessage[]>>({})

const roomTabs = ref<{name: string, roomId: string, key: string}[]>([])
const roomMessages = reactive<Record<string, ChatMessage[]>>({})

const guildMessages = reactive<ChatMessage[]>([])
const ironcatMessages = ref<ChatMessage[]>([])

const unread = reactive<{ [key: string]: boolean }>({
  public: false, // 世界频道
  // 私聊key: boolean
})

// 玩家信息弹窗
const playerInfoDialogVisible = ref(false)
const currentSelectPlayerUuid = ref<string | null>(null)
function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid || null
  playerInfoDialogVisible.value = true
}

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let offce: FuncAction
let off4: FuncAction
let off5: FuncAction
let off6: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction
let off10: FuncAction
let off11: FuncAction
let off12: FuncAction
let off13: FuncAction
let off14: FuncAction
let off15: FuncAction

const generatePrivateChatKey = (from: string, to: string) => {
  return [from, to].sort().join(":")
}
const getPrivateChatKey = (chat: ChatMessage) => {
  return generatePrivateChatKey(chat.sender, chat.receiver_id ?? "");
}

watch(activeTab, (tab) => {
  if (tab === "public") {
    unread.public = false
  } else if (tab === "ironcat") {
    unread.ironcat = false
  } else if (tab.startsWith("private-")) {
    const key = tab.replace("private-", "")
    unread[key] = false
  } else if (tab.startsWith("room-")) {
    const key = tab
    unread[key] = false
  } else if (tab.startsWith("guild")) {
    const key = tab
    unread.guild = false
  }
})

function sendPublic(msg: string) {
  if (!msg.trim()) return
  emitCreatePublicChatMsg(msg)
}

function sendIroncat(msg: string) {
  if (!msg.trim()) return
  emitCreateIronPublicChatMsg(msg)
}

function openIroncatChat() {
  activeTab.value = `ironcat`
}

let myGuild = useMyGuild()
function sendGuild(msg: string) {
  if (!msg.trim()) return
  if (!myGuild.value) return

  emitCreateGuildChatMsg(myGuild.value.uuid, msg)
}

function openGuildChat() {
  activeTab.value = `guild`
}

function remoteOpenPrivateChat({name, uuid}: {name: string, uuid: string}) {
  openPrivateChat(name, uuid)
}
// 私聊逻辑
function openPrivateChat(name: string, uuid: string) {
  let key = generatePrivateChatKey(selfUuid.value, uuid)
  if (!privateTabs.value.find(item => item.key == key)) {
    privateTabs.value.push({name, otherSide:uuid, key})
    emitGetPrivateChatList(uuid)
  }
  activeTab.value = `private-${key}`
}

function sendPrivate(to: string, msg: string) {
  if (!msg.trim()) return
  emitCreatePrivateChatMsg(to, msg)
}


function openRoomChat(name: string, uuid: string) {
  let key = `room-${uuid}`
  if (!roomTabs.value.find(item => item.roomId == uuid)) {
    roomTabs.value.push({name: '[房间]' + name, roomId:uuid, key})
    emitGetRoomChatList(uuid)
  }
}
function sendRoomMsg(roomId: string, msg: string) {
  if (!msg.trim()) return
  emitCreateRoomChatMsg(roomId, msg)
}

const handleTabsEdit = (
  name: TabPaneName | undefined,
  action: 'remove' | 'add'
) => {
  if (action != 'remove') {
    return
  }

  name = '' + name
  if (name.startsWith("private-")) {
    const key = name.replace("private-", "")
    // 移除tab
    privateTabs.value = privateTabs.value.filter(item => item.key !== key)
    // 可选：移除消息和未读状态
    delete privateMessages[key]
    delete unread[key]
    // 自动切换到世界频道
    activeTab.value = "public"
  }
}

watch(() => myGuild.value, (newGuild) => {
  if (newGuild) {
    emitGetGuildChatList(newGuild.uuid)
  // } else {
  //   guildMessages.length = 0
  }
}, { immediate: true })

// 公聊逻辑
onMounted(async () => {
  await waitUtilConnected()

  emitGetPublicChatList()
  emitGetAllPrivateChatList()
  emitGetCurrentBattleRoom()
  emitGetIronPublicChatList()

  eventBus.on('open-private-chat', remoteOpenPrivateChat)

  off1 = onGetPublicChatListSuccess(list => {
    publicMessages.value = list.list
  })
  off2 = onNewPublicChatMsg(msg => {
    publicMessages.value.push(msg)

    if (activeTab.value !== "public") {
      unread.public = true
    }

    emits("new-message")
  })
  off3 = onCreateChatMsgError(msg => {
    ElMessage.error(msg)
  })

  offce = onCreateCommentError(msg => {
    ElMessage.error(msg)
  })

  off6 = onReceivePrivateChatMsg(({msg}) => {
    let receiverId = msg.receiver_id
    if (receiverId) {
      let key = getPrivateChatKey(msg)
      if (!privateMessages[key]) {
        privateMessages[key] = [] 
      }
      privateMessages[key].push(msg) 

      if (!privateTabs.value.find(item => item.key == key)) {
        if (msg.receiver_id == selfUuid.value) {
          privateTabs.value.push({name: msg.sender_name, otherSide: msg.sender, key})
          emitGetPrivateChatList(msg.sender)
        }
      }

      if (activeTab.value !== `private-${key}`) {
        unread[key] = true
      }

      emits("new-message")
    }
  })
  off4 = onGetPrivateChatListSuccess(({list}) => {
    if (list.length) {
      let key = getPrivateChatKey(list[0])
      privateMessages[key] = list
    }
  })
  off5 = onCreatePrivateChatMsgError(({ message }) => {
    ElMessage.error(message)
  })

  off7 = onGetAllPrivateChatListSuccess(({list}) => {
    for(let msg of list) {
      let key = getPrivateChatKey(msg)
      if (!privateMessages[key]) {
        privateMessages[key] = [] 
      }
      privateMessages[key].push(msg) 

      if (!privateTabs.value.find(item => item.key == key)) {
        if (msg.receiver_id == selfUuid.value) {
          privateTabs.value.push({name: msg.sender_name, otherSide: msg.sender, key})
        }
      }
    }
  })

  off12 = onNewRoomChatMsg(({msg}) => {
    let roomId = msg.receiver_id?.replace("room:", "")
    if (!roomId) return

    let key = `room-${roomId}`
    if (!roomMessages[key]) {
      roomMessages[key] = []
    }
    roomMessages[key].push(msg)

    if (!roomTabs.value.find(item => item.key == key)) {
      roomTabs.value.push({name: `[房间]${msg.receiver_name}`, roomId, key})
    }

    if (activeTab.value !== key) {
      unread[key] = true
    }

    emits("new-message")
  })

  off8 = onGetRoomChatListSuccess(({list}) => {
    // 处理房间聊天消息
    for (let msg of list) {
      let roomId = msg.receiver_id?.replace("room:", "")

      if (!roomId) continue

      let key = `room-${roomId}`

      if (!roomMessages[key]) {
        roomMessages[key] = []
      }

      // 根据msg.id做一下去重
      if (roomMessages[key].some(m => m.id === msg.id)) {
        continue
      }

      roomMessages[key].push(msg)

      if (!roomTabs.value.find(item => item.key == key)) {
        roomTabs.value.push({name: `房间 ${msg.receiver_name}`, roomId, key})
      }
    }
  })

  off9 = onJoinBattleRoomSuccess((room) => {
    openRoomChat(room.name, room.uuid)
  })
  off10 = onLeaveBattleRoomSuccess(({roomId}) => {
    roomTabs.value = roomTabs.value.filter(item => item.roomId !== roomId)
    delete roomMessages[`room-${roomId}`]
  })
  off11 = onGetCurrentBattleRoomSuccess(room => {
    if (room) {
      emitGetRoomChatList(room.uuid)
      openRoomChat(room.name, room.uuid)
    }
  })

  off12 = onNewGuildChatMsg(({msg}) => {
    guildMessages.push(msg)

    if (activeTab.value !== "guild") {
      unread.guild = true
    }

    emits("new-message")
  })

  off13 = onGetGuildChatListSuccess(({list}) => {
    // 使用 splice 方法一次性替换，避免触发多次 watch
    guildMessages.splice(0, guildMessages.length, ...list)
  })

  off14 = onNewIronPublicChatMsg((msg) => {
    ironcatMessages.value.push(msg)

    if (activeTab.value !== "ironcat") {
      unread.ironcat = true
    }

    emits("new-message")
  });

  off15 = onGetIronPublicChatListSuccess(({list}) => {
    ironcatMessages.value = list
  })
})

onUnmounted(() => {
  off1?.()
  off2?.()
  off3?.()
  off4?.()
  off5?.()
  off6?.()
  off7?.()
  off8?.()
  off9?.()
  off10?.()
  off11?.()
  off12?.()
  off13?.()
  off14?.()
  off15?.()

  offce?.()

  eventBus.off('open-private-chat', remoteOpenPrivateChat)
})

// 你需要将 openPrivateChat 方法暴露给好友列表组件，或通过全局事件/状态管理调用
</script>