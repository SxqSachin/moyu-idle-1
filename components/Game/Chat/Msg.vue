<template>
  <div v-if="msg.sender"
    :class="['flex items-start text-[14px] break-words leading-tight px-2 py-2 rounded hover:bg-gray-50 hover:dark:bg-gray-800 transition gap-1 md:gap-2', isSelf ? 'flex-row-reverse' : '']">
    <!-- Avatar -->
    <div class="flex-shrink-0 min-w-[56px] flex flex-row items-center justify-center">
      <GameUserAvatarAndName :uuid="msg.sender" :only-avatar="true" :avatar-size="56"></GameUserAvatarAndName>
    </div>

    <!-- Content column -->
    <div :class="['flex-1 flex flex-col', isSelf ? 'items-end text-right' : '']">
      <div :class="['flex items-center justify-start', isSelf ? 'flex-row-reverse' : '']">

        <template v-if="isMobile">
         <div class="flex flex-col gap-0" :class="{
          'items-end': isSelf,
          'items-start': !isSelf
         }">
            <!-- small prefix (emoji or title image) -->
            <div class="flex items-center">
              <template v-if="isImgPrefix && imgTitleSrc">
                <img :src="imgTitleSrc" alt="title" class="w-5 h-5 rounded-sm" />
              </template>
              <template v-else>
                <span v-if="prefix" class="text-sm">{{ prefix }}</span>
              </template>
              <template v-if="titleLabel">
                <span class="text-xs text-gray-400"> [{{ titleLabel }}] </span>
              </template>
            </div>
            <!-- name and guild/title -->
            <component :is="shouldRenderDropdown ? ElDropdown : 'span'" v-bind="dropdownProps" :ref="setDropdownRef"
              @command="onDropdownCommand" class="flex items-center">
              <div @click="handleNameClick" class="flex items-center gap-1">
                <div :class="['text-sm font-semibold hover:underline cursor-pointer', getNameClass(msg)]">{{ ironcat ?
                  '[硬核喵] ' : ''
                  }}</div>
                <div v-if="guildTitle" class="text-xs text-gray-400">[{{ guildTitle }}]</div>
                <div class="font-semibold" :class="getNameClass(msg)"> {{ msg.sender_name }} </div>
              </div>

              <template v-if="shouldRenderDropdown" #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail">查看详情</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid" command="addFriend">添加好友</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid" command="chat">发起私聊</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid && !isBlocked" divided
                    command="block">屏蔽该玩家</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid && isBlocked" divided
                    command="unblock">取消屏蔽</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </component>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-0">
            <!-- small prefix (emoji or title image) -->
            <div class="flex items-center">
              <template v-if="isImgPrefix && imgTitleSrc">
                <img :src="imgTitleSrc" alt="title" class="w-5 h-5 rounded-sm" />
              </template>
              <template v-else>
                <span v-if="prefix" class="text-sm">{{ prefix }}</span>
              </template>
              <template v-if="titleLabel">
                <span class="text-xs text-gray-400"> [{{ titleLabel }}] </span>
              </template>
            </div>
            <!-- name and guild/title -->
            <component :is="shouldRenderDropdown ? ElDropdown : 'span'" v-bind="dropdownProps" :ref="setDropdownRef"
              @command="onDropdownCommand" class="flex items-center">
              <div @click="handleNameClick" class="flex items-center gap-1">
                <div :class="['text-sm font-semibold hover:underline cursor-pointer', getNameClass(msg)]">{{ ironcat ?
                  '[硬核喵] ' : ''
                  }}</div>
                <div v-if="guildTitle" class="text-xs text-gray-400">[{{ guildTitle }}]</div>
                <div class="font-semibold" :class="getNameClass(msg)"> {{ msg.sender_name }} </div>
              </div>

              <template v-if="shouldRenderDropdown" #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail">查看详情</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid" command="addFriend">添加好友</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid" command="chat">发起私聊</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid && !isBlocked" divided
                    command="block">屏蔽该玩家</el-dropdown-item>
                  <el-dropdown-item v-if="msg.sender != selfUuid && isBlocked" divided
                    command="unblock">取消屏蔽</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </component>
          </div>
        </template>

        <!-- timestamp -->
        <div :class="['text-xs text-gray-400', isSelf ? 'mr-2' : 'ml-2']">{{ formatTime(msg.created_At) }}</div>
      </div>

      <!-- message content -->
      <div class="mt-1">
        <div :class="[
          'chat-bubble',
          isSelf ? 'chat-bubble-self' : 'chat-bubble-other',
          getContentClass(msg),
          ...bubbleClassList
        ]" :style="bubbleInlineStyle">
          <template v-for="(part, index) in parsedMsg" :key="index">
            <template v-if="typeof part === 'object'">
              <component :is="part.type" v-bind="part.props">
                <template v-if="part.children">
                  {{ part.children }}
                </template>
              </component>
            </template>
            <template v-else>
              <span class="msg-content" :style="msgContentStyle" v-html="part"></span>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { allTitles } from '~/shared/data/allTitle';
import type { ChatMessage } from '~/shared/types/chat';
import { randomIntegerInFullCloseRange, safeJsonParse } from '~/shared/utils';

import titleVeteran from '~/assets/title/title:veteran.png';
import titleBetaCheater from '~/assets/title/title:betaCheater.png';
import titlecatnip_aristocrat from '~/assets/title/title:catnip_aristocrat.png';
import titleYouyouzale from '~/assets/title/title:youyouzale.png';
import titleMomono from '~/assets/title/title:momono.png';
import titleCjmydw from '~/assets/title/title:cjmydw.png';
import titleUltimateApexBlade from '~/assets/icons/resource:shinyIronSword+50.gif'

import { ElDropdown, ElImage, ElMessageBox, ElMessage } from 'element-plus';
import 'element-plus/theme-chalk/el-image.css';
import 'element-plus/theme-chalk/el-image-viewer.css';
import { emitSendFriendRequest } from '~/api/game/socket/friend';
import { useChatBlock } from '~/composables/useChatBlock';
import { avatarMap } from '~/utils/avatar';
import { chatBubbleMap } from '~/utils/chatBubble';
// 屏蔽状态
const { mergedSet, block, unblock } = useChatBlock()
const isBlocked = computed(() => mergedSet.value.has(props.msg.sender || ''))

const { user } = useUserSession()
const selfUuid = computed(() => user.value?.uuid || '')

const { isMobile } = useDevice()

const props = defineProps<{
  msg: ChatMessage
}>()

// 是否为当前用户自己的消息（用于右侧气泡样式）
const isSelf = computed(() => props.msg.sender === selfUuid.value)

const emit = defineEmits<{
  (e: 'show-info', playerUuid: string): void
  (e: 'chat', name: string, playerUuid: string): void
  (e: 'show-info', playerUuid: string): void
  (e: 'chat', name: string, playerUuid: string): void
  (e: 'show-item', itemId: string): void
  (e: 'join-room', roomId: string): void
  (e: 'show-player', playerUuid: string): void
}>()

const dropDownRef = ref()
function setDropdownRef(el: any) {
  dropDownRef.value = el
}

// 控制是否渲染 dropdown
const shouldRenderDropdown = ref(false)

const dropdownProps = computed(() => {
  if (!shouldRenderDropdown.value) return {}

  return {
    trigger: "click"
  }
})

function handleNameClick() {
  if (!props.msg.sender) return

  // 延迟渲染 dropdown，避免意外点击
  if (!shouldRenderDropdown.value) {
    shouldRenderDropdown.value = true
    // 等待 dropdown 渲染完成后再次触发点击
    nextTick(() => {
      if (dropDownRef.value) {
        // 尝试多种方式触发 dropdown
        try {
          dropDownRef.value.handleOpen()
        } catch (error) {
          console.error('Failed to trigger dropdown:', error)
        }
      }
    })
  }
}

const linkParsers = [
  {
    type: 'image',
    regex: /\[(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?)\]/gi,
    render: (match: string) => h(ElImage, {
      src: match,
      // alt: 'image',
      referrerPolicy: 'no-referrer',
      class: 'comment-img',
      fit: 'contain',
      previewTeleported: true,
      previewSrcList: [match],
    }),
  },
  {
    type: 'item',
    regex: /\[item:([^\]]+)\]/gi,
    render: (match: string) => h('span', {
      class: 'comment-item-link',
      onClick: () => emit('show-item', match),
    }, `查看物品: ${match}`),
  },
  {
    type: 'room',
    regex: /\[room:([^\]]+)\]/gi,
    render: (match: string) => h('span', {
      class: 'text-[13px] text-blue-400 dark:text-blue-400 cursor-pointer text-shadow-lg',
      onClick: () => {
        eventBus.emit('join-battle-room', {
          roomUuid: match
        })
      },
    }, `点击进入房间`),
  },
  {
    type: 'player',
    regex: /\[player:([^\]]+)\]/gi,
    render: (match: string) => h('span', {
      class: 'comment-player-link',
      onClick: () => emit('show-player', match),
    }, `查看玩家: ${match}`),
  },
];

const parsedMsg = computed(() => {
  let content = props.msg.content;

  const parts: Array<string | VNode> = [];
  let remainingContent = content;

  linkParsers.forEach(({ regex, render }) => {
    let match;
    while ((match = regex.exec(remainingContent)) !== null) {
      const [fullMatch, captured] = match;
      const beforeMatch = remainingContent.slice(0, match.index);
      if (beforeMatch) parts.push(beforeMatch); // 添加匹配前的普通文本
      parts.push(render(captured)); // 添加解析后的组件
      remainingContent = remainingContent.slice(match.index + fullMatch.length);
    }
  });

  if (remainingContent) parts.push(remainingContent); // 添加剩余的普通文本

  return parts;
});

onUnmounted(() => {
  shouldRenderDropdown.value = false
})

const titleLabel = computed(() => {
  if (!props.msg.extra) {
    return ""
  }

  let title = props.msg.extra as keyof typeof allTitles

  return allTitles[title].name
})

const prefix = computed(() => {
  if (!props.msg.extra) {
    return ""
  }

  let title = props.msg.extra as keyof typeof allTitles

  switch (title) {
    case 'potato':
      return '🍟'
    case 'sponsor':
      return '🥳'
    case 'bugger_reporter':
      return '🕵️‍♂️'
    case 'idea_reporter':
      return '💡'
    case 'idea_reporter_a':
      return '💡💡'
    case 'idea_reporter_b':
      return '💡💡💡'
    case 'chaojiwangzong':
      return '🦈'
    case 'sunbeam_keeper':
      return '☀️'
    case 'veteran':
      return 'title:veteran';
    case 'betaCheater':
      return 'title:betaCheater';
    case 'cheater':
    case 'banned':
      return '🤡';
    case 'honest_cat':
      return '🪽';

    case 'catnip_aristocrat':
      return 'title:catnip_aristocrat'

    case 'enhance_expert_a':
      return '⬆️'
    case 'collection_expert_a':
      return '👋'
    case 'farming_animal_expert_a':
      return '🐄'
    case 'mysterious_expert_a':
      return "🧙‍♀️"
    case 'wish_upon_star':
      return "🌟"

    case 'hopeful_heart':
      return "❤️"
    case 'meow_prophet':
      return "🔮"
    case 'unlucky_legend':
      return "💢"
    case 'eternal_luck':
      return "🍀"

    case 't_warrior':
      return "️🛡️";
    case 't_mage':
      return "🪄";
    case 't_berserker':
      return "🪓";
    case 't_assassin':
      return "🥷";
    case 't_archer':
      return "🏹";

    case 't_xzuo':
      return "☁️"

    case 'communityEnvoy':
      return "🌟"

    case 'primeMentor':
      return "🤝"

    case 'worldBossKiller_tester':
      return '🧹'

    case 'hllbcl':
      return '🦊'

    case 't_youyouzale':
      return 'title:youyouzale'
    
    case 'momono_1':
      return 'title:momono'
    
    case 't_cjmydw':
      return 'title:cjmydw' 
    
    case 'enhance_master_axe_1':
      return '🪓'

    case 'catVillageOverseer_1':
      return '📖'

    case 'catVillageOverseer_2':
      return '️😊'


    case 'ultimateApexBlade':
      return 'title:ultimateApexBlade'
  }
  return ''
})

const extra2 = computed(() => {
  let ext2 = props.msg.extra2;

  if (!ext2) {
    return {}
  }

  if (typeof ext2 == 'string') {
    ext2 = safeJsonParse(ext2, {})
  }

  return ext2
})

const guildTitle = computed(() => {
  if (!extra2.value) {
    return "";
  }

  return extra2.value.guildTitle
})

const ironcat = computed(() => {
  if (!extra2.value) {
    return false
  }

  return extra2.value.ironcat
})

const isImgPrefix = computed(() => {
  return prefix && prefix.value.includes(":")
})
const imgTitleSrc = computed(() => {
  const imgTitleMap: any = {
    'title:veteran': titleVeteran,
    'title:betaCheater': titleBetaCheater,
    'title:catnip_aristocrat': titlecatnip_aristocrat,
    'title:youyouzale': titleYouyouzale,
    'title:momono': titleMomono,
    'title:cjmydw': titleCjmydw,
    'title:ultimateApexBlade': titleUltimateApexBlade,
  }

  return imgTitleMap[prefix.value] ?? ''
})


function onDropdownCommand(command: string) {
  if (!props.msg.sender) return
  if (command === 'detail') {
    emit('show-info', props.msg.sender)
  } else if (command === 'chat') {
    emit('chat', props.msg.sender_name, props.msg.sender)
  } else if (command === 'addFriend') {
    emitSendFriendRequest(props.msg.sender_name)
  } else if (command === 'block') {
    const targetName = props.msg.sender_name
    const targetUuid = props.msg.sender
    const messageVNode = h('div', { style: 'white-space:pre-line; line-height:1.5;' }, [
      `确定要屏蔽玩家【${targetName}】吗？\n\n`,
      '屏蔽后：\n',
      '该玩家后续的公屏 / 铁猫公屏消息将不再对你显示。\n',
      '\n',
      '在“个人信息 -> 编辑资料 -> 屏蔽”页面中可取消屏蔽。'
    ])
    ElMessageBox.confirm(
      messageVNode,
      '确认屏蔽',
      {
        type: 'warning',
        confirmButtonText: '确认屏蔽',
        cancelButtonText: '取消',
        distinguishCancelAndClose: true,
        draggable: true,
        dangerouslyUseHTMLString: false,
      }
    ).then(() => {
      block(targetUuid)
      ElMessage.success('已发送屏蔽请求')
    }).catch(() => { })
  } else if (command === 'unblock') {
    unblock(props.msg.sender)
  }
}

function formatTime(time: string) {
  const d = new Date(time)
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  // const isToday =
  //   d.getFullYear() === now.getFullYear() &&
  //   d.getMonth() === now.getMonth() &&
  //   d.getDate() === now.getDate()
  // if (isToday) {
  //   return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  // } else {
  //   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  // }
}

// 渲染特效映射表
const effectMap: Record<string, {
  nameClass?: string,
  contentClass?: string,
  nameEffect?: any
}> = {
  forst: {
    nameClass: 'frost-gradient',
    contentClass: 'frost-content-effect',
  },

  ancestor: {
    nameClass: 'ancestor-gradient',
    contentClass: 'ancestor-content-effect',
  },

  star: {
    nameClass: 'star-gradient',
    contentClass: 'star-content-effect',
  },

  loadOfamusementPark: {
    nameClass: 'loadOfamusementPark-gradient',
    contentClass: 'loadOfamusementPark-content-effect',
  },

  yixiaosCuteHat: {
    nameClass: 'yixiaosCuteHat-gradient',
    contentClass: 'yixiaosCuteHat-content-effect',
  },

  // catnip_aristocrat: {
  //   nameClass: 'catnip-aristocrat-gradient',
  //   contentClass: 'catnip-aristocrat-content-effect',
  // }
  // 可继续扩展
}

// 推荐：将 nameClass 访问封装为方法，便于后续扩展
function getNameClass(msg?: ChatMessage) {
  let extraSFX = msg?.extraSFX || ''
  let titleSFX = msg?.extra || ''

  let sfxInfo = effectMap[titleSFX] ?? effectMap[extraSFX]

  if (!sfxInfo) return ''

  return sfxInfo?.nameClass ? sfxInfo.nameClass : ''
}
function getContentClass(msg: ChatMessage) {
  let extraSFX = msg?.extraSFX || ''
  let titleSFX = msg?.extra || ''

  let sfxInfo = effectMap[titleSFX] ?? effectMap[extraSFX]

  if (!sfxInfo) return ''

  return sfxInfo?.contentClass ? sfxInfo.contentClass : ''
}

// ===== Bubble border-image support =====
// Compute bubble class list and inline style from ChatMessage.bubbleStyle
const bubbleName = computed(() => extra2.value?.bubble)// (props.msg.bubbleStyle || '').trim())

const diyStyle = computed(() => extra2.value?.bubbleDiyStyle)

function sanitizeBubbleName(name: string) {
  return name
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
}

const bubbleClassList = computed(() => {
  const name = bubbleName.value
  if (name) {
    return ['bubble-border', `bubble-${sanitizeBubbleName(name)}`]
  }
  // 如果有 diyStyle，不添加额外类，让默认气泡应用渐变
  return [] as string[]
})

function resolveBubbleUrl(name: string) {
  return chatBubbleMap[name]
}

const bubbleInlineStyle = computed(() => {
  const name = bubbleName.value
  if (name) {
    return {
      borderImageSource: `url(${resolveBubbleUrl(name)})`,
    } as Record<string, string>
  }
  // 如果没有 bubble 样式，但有 diyStyle，则应用渐变到默认气泡
  const diy = diyStyle.value
  if (diy) {
    const bgGradient = diy.bgColor.length > 1
      ? `linear-gradient(to right, ${diy.bgColor.join(', ')})`
      : diy.bgColor[0] || '#f3f4f6'
    return {
      background: bgGradient,
    } as Record<string, string>
  }
  return {}
})

const msgContentStyle = computed(() => {
  const diy = diyStyle.value
  if (diy) {
    const style: Record<string, string> = {}
    if (diy.textColor && diy.textColor.length > 0) {
      const textGradient = diy.textColor.length > 1
        ? `linear-gradient(to right, ${diy.textColor.join(', ')})`
        : diy.textColor[0] || '#111827'
      style.background = textGradient
      style.backgroundClip = 'text'
      style.WebkitBackgroundClip = 'text'
      style.color = 'transparent'
    }
    if (diy.textShadow && diy.textShadow.length > 0) {
      style.textShadow = diy.textShadow.map(s => `0 0 ${s.blur}px ${s.color}`).join(', ')
    }
    return style
  }
  return {}
})
</script>

<style lang="scss" scoped>
.comment-img {
  display: inline-block;
  width: 120px;
  max-width: 120px;
  max-height: 200px;
  border-radius: 0.375rem;
  /* rounded-md */
  box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 3px;
}

/* Chat bubble styles */
.chat-bubble {
  display: inline-flex;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  line-height: 1.4;
  /* sensible wrapping inside bubble: preserve user newlines, allow breaks at words */
  /* white-space: pre-wrap; */
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  position: relative;
}

/* CSS variables are defined in a global style block below so they are
  truly global (scoped styles would restrict :root selectors). */

.chat-bubble-other {
  background: var(--chat-bubble-other-bg, #f3f4f6);
  color: var(--chat-bubble-other-text, #111827);
  border-radius: 4px 12px 12px 12px;
}

.chat-bubble-self {
  background: var(--chat-bubble-self-bg, #2563eb);
  color: var(--chat-bubble-self-text, #ffffff);
  border-radius: 12px 12px 4px 12px;
}

.chat-bubble .msg-content {
  max-width: 32em;
  word-break: break-word;
  white-space: pre-wrap;
  display: block;
}

/* tails */
// .chat-bubble-other::after,
// .chat-bubble-self::after {
//   content: '';
//   position: absolute;
//   bottom: 0.2rem;
//   width: 12px;
//   height: 12px;
//   transform: rotate(45deg);
//   z-index: 0;
// }
// .chat-bubble-other::after {
//   left: -5px;
//   top: 4px;
//   background: var(--chat-bubble-other-bg, #f3f4f6);
// }
// .chat-bubble-self::after {
//   right: -5px;
//   background: var(--chat-bubble-self-bg, #2563eb);
// }

/* border-image bubble: base class */
.bubble-border {
  background: transparent !important;
  border-style: solid;
  border-color: transparent;
  // border-image-slice: var(--bubble-slice, 24 fill);
  // border-image-width: var(--bubble-border-width, 12px);
  border-image-repeat: stretch;
  // padding: var(--bubble-padding, 0.5rem 0.75rem);
  // border-radius: var(--bubble-radius, 12px);
}

/* Hide default tails when using border-image bubble */
.bubble-border.chat-bubble-other::after,
.bubble-border.chat-bubble-self::after {
  display: none;
}

.bubble-cute_cat_1 {
  border-width: 0;
  border-image-slice: 246 246 236 256 fill;
  border-image-width: 48px 48px 48px 48px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: repeat repeat;

  position: relative;

  .msg-content {
    color: white;
    text-shadow: 1 0px #9dd9ff, 0 1 4px #e0f7fa;
  }

  &.chat-bubble-other {

    padding-right: 16px;
    padding-left: 16px;
  }

  &.chat-bubble-self {
    padding: 16px 20px 12px 20px;
  }
}

.bubble-cute_cat_2 {
  border-width: 12px;
  border-image-slice: 120 122 122 122 fill;
  border-image-width: 32px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: repeat repeat;

  position: relative;

  .msg-content {
    color: #76441b;
    text-shadow: 0 0px 2px #f6bcb3, 0 0px 0px #f6bbb2;
  }

  &.chat-bubble-other {
    padding: 8px;
  }

  &.chat-bubble-self {
    padding: 8px;
  }
}

.bubble-kitty_1 {
  border-width: 0;
  border-image-slice: 128 128 128 128 fill;
  border-image-width: 32px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: repeat repeat;

  position: relative;

  .msg-content {
    color: #8550a0;
    text-shadow: 0 0px 2px #fbc6c5, 0 0px 2px #b296da;
  }

  &.chat-bubble-self,
  &.chat-bubble-other {
    padding: 20px 16px 16px 16px;
  }
}

.bubble-ninja_cat_1 {
  border-width: 0;
  border-image-slice: 106 106 88 106 fill;
  border-image-width: 28px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: repeat round;

  position: relative;

  .msg-content {
    color: #3b2d42;
    text-shadow: 0 0px 3px #c1b3d0, 0 0px 2px #8f649c;
  }

  &.chat-bubble-self,
  &.chat-bubble-other {
    padding: 20px 16px 12px 16px;
  }
}

.bubble-dark_mag_1 {
  border-width: 0;
  border-image-slice: 112 112 112 112 fill;
  border-image-width: 24px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: round round;

  position: relative;

  .msg-content {
    color: #acf6bf;
    text-shadow: 0 0px 3px #c1b3d0, 0 0px 2px #8f649c;
  }

  &.chat-bubble-self,
  &.chat-bubble-other {
    padding: 16px 18px 18px 18px;
  }

  .comment-img {
    padding: 6px;
  }
}

.bubble-star_1 {
  border-width: 0;
  border-image-slice: 104 104 104 104 fill;
  border-image-width: 30px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: round round;

  position: relative;

  .msg-content {
    color: #fdfdf6;
    text-shadow: 0 0px 3px #fdfdf7, 0 0px 2px #8f649c;
  }

  &.chat-bubble-self,
  &.chat-bubble-other {
    padding: 14px 16px 14px 16px;
  }

  .comment-img {
    padding: 6px;
  }
}

.bubble-moon_1 {
  border-width: 0;
  border-image-slice: 92 92 92 92 fill;
  border-image-width: 46px;
  border-image-outset: 0px 0px 0px 0px;
  border-image-repeat: round round;

  position: relative;

  .msg-content {
    color: #ebdb9c;
    text-shadow: 0 0px 3px #93b7bc, 0 0px 2px #b884b9;
  }

  &.chat-bubble-self,
  &.chat-bubble-other {
    padding: 16px 24px 16px 24px;
  }

  .comment-img {
    padding: 10px;
  }
}

.comment-img img {
  border-radius: 8px;
}
</style>

<style>
.effect-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.frost-gradient {
  background: linear-gradient(90deg, #b3dbf4 0%, #99dce5 75%, #e8f6ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;

  overflow: hidden;
}

/* 简单的内容特效：轻微冰蓝色发光和淡淡抖动 */
.frost-content-effect {
  text-shadow: 0 0 8px #9dd9ff, 0 0 12px #e0f7fa;
}

/* 星辉王冠渐变 */
.star-gradient {
  background: linear-gradient(90deg, #ffe066 0%, #ffd700 40%, #fffbe7 160%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
  position: relative;
  z-index: 1;
}

/* 星辉内容发光 */
.star-content-effect {
  text-shadow: 0 0 8px #ffe066, 0 0 12px #fffbe721;
  color: #dea31f;
}

/* 星星王冠特效 */
.star-crown {
  display: flex;
  gap: 0.18em;
  align-items: flex-end;
}

.star-crown-star {
  color: #ffe066;
  text-shadow: 0 0 6px #fffbe7, 0 0 12px #ffd700;
  font-size: 1em;
  opacity: 0.62;
  /* 降低透明度 */
  animation: star-crown-twinkle 1.8s infinite;
  will-change: filter, opacity, transform;
}

.star-crown-overlay {
  position: absolute;
  left: 50%;
  top: 0;
  /* 稍微上移，避免遮挡名字 */
  transform: translateX(-50%);
  opacity: 0.38;
  width: 2.2em;
  height: 1.2em;
  pointer-events: none;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.star-crown-star1 {
  font-size: 1.1em;
  animation-delay: 0s;
  transform: translateY(0.1em) scale(1.1);
}

.star-crown-star2 {
  font-size: 1.3em;
  animation-delay: 0.5s;
  transform: translateY(-0.1em) scale(1.2);
}

.star-crown-star3 {
  font-size: 1.1em;
  animation-delay: 1s;
  transform: translateY(0.1em) scale(1.1);
}

@keyframes star-crown-twinkle {
  0% {
    opacity: 0.92;
    filter: brightness(1);
  }

  20% {
    opacity: 1;
    filter: brightness(1.2);
  }

  40% {
    opacity: 0.85;
    filter: brightness(0.95);
  }

  60% {
    opacity: 1;
    filter: brightness(1.25);
  }

  100% {
    opacity: 0.92;
    filter: brightness(1);
  }
}

.loadOfamusementPark-gradient {
  background: linear-gradient(90deg,
      #ff5252 0%,
      /* 鲜红 */
      #ff9800 16%,
      /* 橙 */
      #ffe600 33%,
      /* 黄 */
      #43ea7f 50%,
      /* 绿 */
      #40a9ff 66%,
      /* 蓝 */
      #a259ff 83%,
      /* 紫 */
      #ff5252 100%
      /* 回到红 */
    );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
  position: relative;
  z-index: 1;
}

.loadOfamusementPark-content-effect {
  color: #222;
  text-shadow:
    0 0 6px rgba(255, 200, 80, 0.18),
    /* 柔和金色光晕 */
    0 0 2px #fff;
}

.dark .loadOfamusementPark-content-effect {
  color: #eee;
  text-shadow:
    0 0 6px rgba(255, 200, 80, 0.22),
    0 0 2px #222;
}

.ancestor-gradient {
  background: linear-gradient(90deg, #d1b3ff 4%, #b39ddb 60%, #ede7f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
  position: relative;
  z-index: 1;
}

.ancestor-content-effect {
  text-shadow: 0 0 8px #d1b3ff, 0 0 12px #ede7f6;
  color: #a084ca;
}

.dark .ancestor-content-effect {
  text-shadow: 0 0 4px #812fff, 0 0 12px #ac74ff;
  color: #a084ca;
}

.yixiaosCuteHat-gradient {
  background: linear-gradient(90deg, #ffd700 0%, #ffb3b3 30%, #ff80bf 60%, #ffd37d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
  position: relative;
  z-index: 1;
  /* 让金色更立体，首尾更清晰 */

  /* text-shadow: 0 0 12px #ffd700cc; */
}

/* @keyframes yixiao-glow {
  0% { filter: drop-shadow(0 0 6px #ffd70088) brightness(1); }
  50% { filter: drop-shadow(0 0 16px #ffb3b388) brightness(1.15); }
  100% { filter: drop-shadow(0 0 6px #ffd70088) brightness(1); }
} */

.yixiaosCuteHat-content-effect {
  text-shadow: 0 0 12px #ffd700cc;
  color: #ff6699;
  /* font-style: italic; */
  font-weight: bold;
  /* letter-spacing: 0.5px; */
  position: relative;
}
</style>

<!-- Global CSS variables for chat bubbles (non-scoped so variables apply globally) -->
<style lang="scss">
:root {
  --chat-bubble-other-bg: #e9e9e9;
  --chat-bubble-other-text: #111827;
  --chat-bubble-self-bg: #557dd4;
  --chat-bubble-self-text: #ffffff;
}

/* Dark mode overrides: adjust as your theme needs */
body.dark,
.dark {
  --chat-bubble-other-bg: #1f2937;
  /* gray-800 */
  --chat-bubble-other-text: #d1d5db;
  /* gray-300 */
  --chat-bubble-self-bg: #5972c4;
  /* blue-800 */
  --chat-bubble-self-text: #ffffff;
}
</style>