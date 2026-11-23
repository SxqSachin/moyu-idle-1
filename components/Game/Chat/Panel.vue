<!-- filepath: /components/Game/Chat/ChatPanel.vue -->
<template>
  <div class="flex flex-col h-96">
    <div ref="chatListRef" class="flex-1 overflow-y-auto overflow-x-hidden mb-2 min-h-40 max-h-80">
      <template v-if="messages.length">
        <GameUserBatchAvatarAndName :uuid-list="allSender">
          <div v-for="(msg, idx) in messages" :key="msg.id">
            <!-- <GameChatMsg :msg="msg" @click-name="uuid => $emit('show-player-info', uuid)" /> -->
            <template v-if="shouldShowHistoryDivider(idx)">
              <div class="flex items-center my-2">
                <div class="flex-1 border-t border-gray-200 dark:border-gray-600"></div>
                <span class="mx-3 text-xs text-gray-400 select-none">以上为历史消息</span>
                <div class="flex-1 border-t border-gray-200 dark:border-gray-600"></div>
              </div>
            </template>
            <GameChatMsg :msg="msg" @show-info="uuid => emit('show-player-info', uuid)"
              @chat="(name, uuid) => emit('chat', name, uuid)" />
          </div>
        </GameUserBatchAvatarAndName>
      </template>
      <template v-else>
        <div class="flex justify-center items-center text-gray-400 h-full">
          暂无消息内容
        </div>
      </template>
    </div>
    <div class="flex items-center space-x-4 mt-2">
      <el-input v-model="inputValue" size="large" placeholder="输入聊天内容" class="flex-1" @keyup.enter="send"
        maxlength="500" show-word-limit />
      <el-button type="primary" size="large" class="w-18" @click="send">发送</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from "vue"
import { useFTCurrentChatMsg } from "~/composables/game/useLocalChatMsg";
import type { ChatMessage } from "~/shared/types/chat";
import { clone } from "~/shared/utils";

const props = defineProps<{ 
  messages: ChatMessage[],
  visible: boolean
 }>()

const emit = defineEmits<{
  (e: "send", content: string): void
  (e: "show-player-info", uuid: string): void
  (e: "chat", name: string, uuid: string): void
}>()

const inputValue = ref<string>("")
const chatListRef = ref<HTMLElement | null>(null)

function isAtBottom(): boolean {
  if (!chatListRef.value) return true
  const el = chatListRef.value
  // 距离底部小于等于40px认为在底部
  return el.scrollHeight - el.scrollTop - el.clientHeight <= 40
}

const onSetChatContent = (e: EventBusSetChatContentEvents) => {
  if (!e.msg || !e.msg.trim()) return
  inputValue.value = e.msg
}
const onSendChatMsg = () => {
  inputValue.value = ""
  // optimistic: when send event occurs, also scroll to bottom so user sees the message input sent
  scrollToBottom()
}

const chatFTChatMsg = useFTCurrentChatMsg()

function send() {
  if (!inputValue.value?.trim()) return

  let ftChatMsg = clone(chatFTChatMsg.value)
  let content = inputValue.value;

  chatFTChatMsg.value = null
  inputValue.value = ""

  for(const roomMeta of ftChatMsg?.room ?? []) {
    content = content.replace(`{${roomMeta.textStub}}`, `[room:${roomMeta.roomId}]`)
  }

  emit("send", content)
  eventBus.emit("send-chat-msg", {})
  // Immediately scroll to bottom (optimistic) so user sees latest message area
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (!chatListRef.value) return
    try {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    } catch (e) {
      // no-op if DOM not ready
    }
  })
}


// Watch message count. Capture whether user was at bottom BEFORE the new message
// is rendered (flush: 'pre'), then after DOM update (nextTick) scroll if we
// were at bottom or this is the first load.
watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    const wasAtBottomBefore = isAtBottom()

    nextTick(() => {
      if (!chatListRef.value) return
      if (oldLen === 0) {
        // 2. 打开面板时，始终滚到底部
        chatListRef.value.scrollTop = chatListRef.value.scrollHeight
      } else if (wasAtBottomBefore) {
        // 如果发送/接收前在底部，接收到新消息后仍然自动滚动到底部
        chatListRef.value.scrollTop = chatListRef.value.scrollHeight
      }
      // 否则用户在翻历史，不自动滚动
    })
  },
  { flush: 'pre' }
)

watch(
  () => props.visible,
  (visible) => {
    if (visible && chatListRef.value) {
      // 组件变为可见时，如果需要滚动到底部就执行
      nextTick(() => {
        if (chatListRef.value) {
          chatListRef.value.scrollTop = chatListRef.value.scrollHeight
        }
      })
    }
  }
)

onMounted(() => {
  eventBus.on('set-chat-content', onSetChatContent)
  eventBus.on('send-chat-msg', onSendChatMsg)
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  })
})
onUnmounted(() => {
  eventBus.off('set-chat-content', onSetChatContent)
  eventBus.off('send-chat-msg', onSendChatMsg)
})

function shouldShowHistoryDivider(idx: number) {
  if (!props.messages[idx]) return false;
  // 当前消息是今天的，且前一条不是今天的（或是第一条）
  const isCurrentToday = isToday(props.messages[idx].created_At);
  const isPrevToday = idx > 0 ? isToday(props.messages[idx - 1].created_At) : false;
  return isCurrentToday && !isPrevToday;
}

function isToday(date: string | number | Date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

const allSender = computed(() => {
  const uuids = props.messages.map(m => m.sender).toSorted();
  return Array.from(new Set(uuids));
});
</script>