<template>
  <GameGlobalSocketEventListener></GameGlobalSocketEventListener>
  <div v-if="gameInited" :class="{
    'moyu-mobile': isMobile,
  }">

  <!-- Socket disconnected banner: fixed to viewport top so it is always visible -->
    <div v-if="socketDisconnected" class="socket-disconnected-banner" aria-live="polite">
      <el-alert title="已断开游戏链接(可能是网络波动或者是游戏更新)" type="warning" close-text="刷新" @close.stop="reloadGame" />
    </div>


    <el-container class="overflow-x-hidden">
      <!-- 美化的顶部导航栏 -->
      <el-header class="moyu__header shadow-lg h-16! w-full">
        <el-page-header class="pt-2" icon="">
          <template #title>
            <div class="hidden md:flex items-center" @click="onLeftMenuSelect('homepage')">
              <div class="relative">
                <img src="/static/images/logo.png" style="width: 40px" alt="" class="rounded-full shadow-md">
              </div>
            </div>
            <div class="block md:hidden">
              <el-button @click="showMenuDrawer = true">
                <el-icon>
                  <Icon name="material-symbols:menu" class="text-gray-400 text-2xl" />
                </el-icon>
              </el-button>
            </div>
          </template>
          <template #content>
            <div class="flex items-center ml-2">
              <span class="text-large font-bold mr-3 whitespace-nowrap text-gray-400 bg-clip-text cursor-pointer" @click="onLeftMenuSelect('homepage')">
                🐱 猫猫放置
              </span>
            </div>
          </template>
          <template #extra>
            <div class="flex items-center space-x-3">
              <!-- 美化的黑夜模式按钮 -->
              <el-button circle class="theme-toggle-btn" @click="toggleDark" :title="isDark ? '切换为日间模式' : '切换为夜间模式'"
                :class="isDark ? 'dark-mode-btn' : 'light-mode-btn'">
                <Icon :name="isDark ? 'material-symbols:light-mode-outline' : 'material-symbols:dark-mode-outline'"
                  class="transition-transform duration-300 hover:scale-110" />
              </el-button>

              <!-- 美化的用户下拉菜单 -->
              <el-dropdown placement="bottom" v-if="user" class="user-dropdown">
                <div class="inline-flex items-center space-x-2 cursor-pointer pt-0.5 duration-300">
                  <GamePlayerProfileAvatarAndName :profile="profile" :avatarSize="44"></GamePlayerProfileAvatarAndName>
                  <Icon name="material-symbols:keyboard-arrow-down"
                    class="text-gray-500 transition-transform duration-200 group-hover:rotate-180" />
                </div>
                <template #dropdown>
                  <el-dropdown-menu class="cute-dropdown-menu">
                    <el-dropdown-item @click="updateRouteTab('selfProfile')" class="cute-dropdown-item">
                      <Icon name="material-symbols:person" class="mr-2" />
                      个人信息
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!user.isIronCat && !user.emailVerified" @click="updateRouteTab('bindEmail')"
                      class="cute-dropdown-item">
                      <Icon name="material-symbols:attach-email-outline-rounded" class="mr-2" />
                      绑定邮箱
                    </el-dropdown-item>
                    <el-dropdown-item @click="updateRouteTab('resetPassword')" class="cute-dropdown-item">
                      <Icon name="material-symbols:lock-reset" class="mr-2" />
                      重置密码
                    </el-dropdown-item>
                    <el-dropdown-item @click="updateRouteTab('switchAccount')" class="cute-dropdown-item">
                      <Icon name="mdi:account-switch" class="mr-2" />
                      切换账号
                    </el-dropdown-item>
                    <el-dropdown-item @click="logout" class="cute-dropdown-item text-red-500">
                      <Icon name="material-symbols:logout" class="mr-2" />
                      退出登录
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-page-header>
      </el-header>

      <el-container class="moyu-idle__body-section flex">
        <!-- 美化的侧边栏 -->
        <el-aside class="hidden md:block aside cute-sidebar" :width="'120px'"
          style="overflow-x: hidden;">
            <el-menu ref="leftMenuRef" :default-active="currentSelectMenuIndex" class="h-full moyu-idle__menu overflow-y-auto cute-menu overflow-x-hidden"
            :style="{
              '--el-menu-base-level-padding': isMobile ? '8px' : '12px',
              '--el-menu-item-height': isMobile ? '32px' : '28px',
              '--el-menu-sub-item-height': '28px',
              '--el-menu-level-padding': '-8px',
              '--el-menu-bg-color': 'transparent',
            }" :collapse-transition="false" @select="onLeftMenuSelect"
            :default-openeds="['myhome', 'village']"
            >

            <template v-for="(mi, idx) in menuItems" :key="mi.key || idx">
              <el-divider v-if="mi.type === 'divider'" class="my-2! cute-divider"></el-divider>

              <el-sub-menu v-if="mi.type === 'submenu' && (!mi.visible || mi.visible())" :index="mi.index || ''" class="cute-menu-item">
                <template #title>
                  <el-icon>
                    <Icon :name="mi.icon || ''" class="size-5!" mode="css"></Icon>
                  </el-icon>
                  <span class="menu-text">{{ mi.title }}</span>
                </template>

                <el-menu-item v-for="child in visibleChildren(mi)" :key="child.index" :index="child.index || ''" class="cute-menu-item" @click="child.onClick ? child.onClick($event) : null">
                  <el-icon class="menu-icon">
                    <Icon :name="child.icon || ''" class="size-5" mode="css"></Icon>
                    <template v-if="child.badge && pendingRequests.length">
                      <span class="absolute -top-1.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-xs text-white"></span>
                    </template>
                  </el-icon>
                  <template #title>
                    <span class="menu-text">{{ child.title }}</span>
                  </template>
                </el-menu-item>
              </el-sub-menu>

              <el-menu-item v-else-if="mi.type === 'item' && (!mi.visible || mi.visible())" :index="mi.index || ''" class="cute-menu-item" @click="mi.onClick ? mi.onClick($event) : null" :class="mi.class">
                <el-icon class="menu-icon">
                  <Icon :name="mi.icon || ''" class="size-5" mode="css"></Icon>
                  <template v-if="mi.badge && pendingRequests.length">
                    <span class="absolute -top-1.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-xs text-white"></span>
                  </template>
                </el-icon>
                <template #title>
                  <span class="menu-text">{{ mi.title }}</span>
                </template>
              </el-menu-item>
            </template>

            <!-- 动作菜单 已集成进 menuItems -->
          </el-menu>
        </el-aside>

        <el-container class="overflow-auto moyu-idle__content cute-content">
          <el-main class="p-2! md:p-2! md:pl-4! md:p-4! cute-main">

            <div class="content-wrapper">
              <GameLayoutHomePage v-if="currentSelectMenuIndex == 'homepage'"></GameLayoutHomePage>

              <el-card v-if="currentSelectMenuIndex == 'inventory'">
                <GameInventory @show-in-market="onInventoryItemNeedShowInMarket"></GameInventory>
              </el-card>

              <div v-if="currentSelectMenuIndex == 'friend'" class="p-0!">
                <GameFriendPanel></GameFriendPanel>
              </div>

              <div v-if="currentSelectMenuIndex == 'character'" class="p-0!">
                <GameCharacterStatusFull></GameCharacterStatusFull>
              </div>

              <div v-if="currentSelectMenuIndex == 'tavern'" class="p-0!">
                <GameTavern></GameTavern>
              </div>

              <div v-if="currentSelectMenuIndex == 'auction'" class="p-0!">
                <GameAuction></GameAuction>
              </div>

              <div v-if="currentSelectMenuIndex == 'cattery'" class="p-0!">
                <GameCattery></GameCattery>
              </div>

              <div v-if="currentSelectMenuIndex == 'quest'" class="p-0!">
                <div>
                  <LazyGameQuest></LazyGameQuest>
                </div>
              </div>

              <div v-if="currentSelectMenuIndex == 'shop'" class="p-0!">
                <GameShopFull></GameShopFull>
              </div>

              <div v-if="currentSelectMenuIndex == 'fishing'" class="p-0!">
                <GameFishing></GameFishing>
              </div>

              <div v-if="currentSelectMenuIndex == 'gameguide'" class="p-0!">
                <GameGuide></GameGuide>
              </div>

              <div v-if="currentSelectMenuIndex == 'updateLog'" class="p-0!">
                <GameUpdateLog></GameUpdateLog>
              </div>

              <div v-if="currentSelectMenuIndex == 'village'" class="p-0!">
                <GameVillage></GameVillage>
              </div>

              <!-- <div v-if="currentSelectMenuIndex == 'curio'" class="p-0!">
                <GameCurio></GameCurio>
              </div> -->

              <div v-if="currentSelectMenuIndex == 'market'" class="p-0!">
                <el-card body-class="p-3! md:p-4! test">
                  <GameNewMarket :selected-resource-id="marketShowResourceId"></GameNewMarket>
                </el-card>
              </div>

              <div v-if="currentSelectMenuIndex == 'building'" class="p-0!">
                <GameBuildingInfo></GameBuildingInfo>
              </div>

              <div v-if="currentSelectMenuIndex == 'playerShop'" class="p-0!">
                <GamePlayerShopFull></GamePlayerShopFull>
              </div>


              <template v-if="currentSelectMenuIndex == 'selfProfile'">
                <GamePlayerProfile></GamePlayerProfile>
              </template>

              <template v-if="currentSelectMenuIndex == 'bindEmail'">
                <GamePlayerProfileBindEmail></GamePlayerProfileBindEmail>
              </template>

              <template v-if="currentSelectMenuIndex == 'switchAccount'">
                <GamePlayerProfileSwitchAccount />
              </template>


              <template v-if="currentSelectMenuIndex == 'rankingList'">
                <GameRankingListFull></GameRankingListFull>
              </template>

              <template v-if="currentSelectMenuIndex == 'cheaterList'">
                <GameRankingListCheaterList></GameRankingListCheaterList>
              </template>

              <template v-if="currentSelectMenuIndex == 'resetPassword'">
                <GamePlayerResetPassword></GamePlayerResetPassword>
              </template>

              <template v-if="currentSelectMenuIndex == 'enhance'">
                <GameEnhance :init-select-resource-id="enhanceItemId"></GameEnhance>
              </template>

              <template v-if="currentSelectMenuIndex == 'dismantle'">
                <GameDismantle :init-select-resource-id="dismantleItemId"></GameDismantle>
              </template>

              <template v-if="currentSelectMenuIndex == 'battle'">
                <GameBattleFull></GameBattleFull>
              </template>
              <template v-if="currentSelectMenuIndex == 'expedition'">
                <GameBattleKittyExpedition></GameBattleKittyExpedition>
              </template>

              <template v-if="currentSelectMenuIndex == 'sponsor'">
                <GameSponsor></GameSponsor>
              </template>


              <template v-if="currentSelectMenuIndex == 'guild'">
                <GameGuild></GameGuild>
              </template>


              <template v-if="currentSelectMenuIndex == 'instructions'">
                <GameInstructions></GameInstructions>
              </template>

              <template v-if="currentSelectMenuIndex == 'dictionary'">
                <GameDictionary></GameDictionary>
              </template>

              <template v-for="(mainActionInfo, index) in allGameActionMainType" :key="mainActionInfo.id">
                <template v-if="!customRenderedActionIdSet.has(mainActionInfo.id)">
                  <GameLayoutGameActionPanel v-if="currentSelectedMainAction?.id == mainActionInfo.id"
                    :action-main-type="mainActionInfo.id"></GameLayoutGameActionPanel>
                </template>
              </template>

              <!-- 自定义渲染的功能面板（如：炼金、采集） -->
              <template v-for="item in customRenderedActionMenus" :key="item.id">
                <component v-if="currentSelectMenuIndex == item.index" :is="item.component"></component>
              </template>

              <template v-if="currentSelectMenuIndex == 'farmingPlant'">
                <GameFarming></GameFarming>
              </template>

              <template v-if="currentSelectMenuIndex == 'gm' && isGM">
                <LazyGameGM></LazyGameGM>
              </template>

            </div>
          </el-main>

          <transition>
            <button v-show="!chatPanelVisible"
              class="cute-chat-button fixed! z-50 bottom-6 right-6 md:bottom-8 md:right-8" @click="openChatPanel"
              aria-label="打开聊天">
              <div class="absolute inset-0 rounded-full bg-blue-400 opacity-100"></div>
              <Icon name="material-symbols:chat" mode="css" class="text-xl"></Icon>
              <span v-if="chatHasUnread"
                class="absolute top-3 right-3 w-3 h-3 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-xs text-white"></span>
              <!-- 可爱的装饰圈 -->
            </button>
          </transition>

          <!-- 底部悬浮聊天面板 -->
          <transition name="slide-up">
            <div v-show="chatPanelVisible"
              class="chat-panel cute-chat-panel shadow-2xl rounded-lg fixed z-50 bottom-0 flex justify-center pointer-events-none">
              <div class="pointer-events-auto w-full" :class="isMobile ? 'rounded-t-lg' : 'rounded-t-xl'">
                <div
                  class="flex justify-end bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-t-lg">
                  <el-button size="small" class="w-full h-8 border-x-0! border-t-0! rounded-none! cute-close-btn"
                    @click="chatPanelVisible = false">
                    <Icon name="material-symbols:stat-minus-1-rounded" mode="css"></Icon>
                    <span class="ml-1 text-xs">收起聊天</span>
                  </el-button>
                </div>
                <GameChat :visible="chatPanelVisible" ref="chatRef" @new-message="onChatNewMessage" />
              </div>
            </div>
          </transition>



          <!-- <el-footer></el-footer> -->
        </el-container>
      </el-container>

    </el-container>

      <el-drawer
        v-model="showMenuDrawer"
        direction="ltr"
        size="100%"
        body-class="mt-0! pt-0!"
      >
      <template #title>
        <span class="text-xl text-center font-bold whitespace-nowrap bg-clip-text">
          🐱 猫猫放置
        </span>
      </template>
        <div class="w-full">
          <template v-for="section in mobileMenuSections" :key="section.key">
            <div class="mb-4">
              <div class="text-lg font-semibold mb-2">{{ section.title }}</div>
              <div class="grid grid-cols-5 gap-3 text-gray-600 dark:text-gray-300">
                <button v-for="item in section.items" :key="item.index" @click="mobileMenuItemClick(item)"
                  class="flex flex-col items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <el-icon class="text-2xl!">
                    <Icon :name="item.icon || ''" mode="css" />
                  </el-icon>
                  <span class="text-base mt-1 whitespace-nowrap ">{{ item.title }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </el-drawer>

    <el-dialog v-model="visitorDialogShow" title="🎮 游客账号须知" width="400" align-center class="cute-dialog">
      <div class="cute-dialog-content">
        <div class="text-center mb-4">
          <div class="text-6xl mb-2">🐱</div>
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-200">
            您当前正在使用游客账号进行游玩
          </h2>
        </div>

        <div class="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 p-4 rounded-lg mb-4">
          <div class="text-sm text-gray-600 dark:text-gray-300 mb-2">
            在下次登录时，请使用以下账号密码进行登录：
          </div>
          <div class="space-y-2">
            <div class="flex items-center">
              <span class="text-sm font-bold text-pink-600 w-12">账号:</span>
              <span class="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm">{{ (user as any).name
                }}</span>
            </div>
            <div class="flex items-center">
              <span class="text-sm font-bold text-purple-600 w-12">密码:</span>
              <span class="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm">{{ (user as any).visitorPwd
                }}</span>
            </div>
          </div>
        </div>

        <el-divider class="my-4!">
          <span class="text-xs text-gray-500">或者</span>
        </el-divider>

        <el-button type="primary" class="mt-2 w-full cute-button" @click="visitorResetPassword">
          🔒 立即重置密码
        </el-button>
      </div>
    </el-dialog>

    <GameGlobalLastLoginPassDialog></GameGlobalLastLoginPassDialog>
    <!-- 新手引导（全屏页面，仅新玩家显示） -->
    <GameOnboardingPage />
  </div>
  <div v-else class="w-screen h-screen flex items-center justify-center text-white"
    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    加载中
  </div>

  <!-- 顶部状态栏 -->
</template>

<script setup lang="ts">
import type { MenuItemRegistered } from 'element-plus';
import { ref, onMounted, onUnmounted, shallowRef, markRaw, computed, nextTick } from 'vue'
import { watchPendingMenu } from '~/composables/useGlobalMenu'
import { emitGetProfile, onGetProfileSuccess } from '~/api/game/socket/profile';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
import { useGlobalVisitorPassword } from '~/composables/game/useGlobalVisitorPassword';
import { usePlayerProfile } from '~/composables/game/usePlayerProfile';
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { clone, waitUtil } from '~/shared/utils';

const buildingInfo = useCharacterBuildingInfo()

const hasCattery = computed(() => {
  return unref(buildingInfo).baseCattery?.status == 'BUILT' || unref(buildingInfo).baseCattery2?.status == 'BUILT'
})
const hasTavern = computed(() => {
  return unref(buildingInfo).tavern?.status == 'BUILT'
})

const visitorDialogShow = ref(false)

import { allGameActionMainType } from '~/shared/data/allGameActions';
import { NOTIFY_KET_20250606ShopModify, } from '~/shared/data/constant';
import type { GameMainActionInfo } from '~/shared/types/gameAction';
import type { GameSocketUserInfo } from '~/shared/types/socket';
import type { AllGameResourceID } from '~/shared/types/gameResource';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const gameInited = useGameInited();

const friendRequest = useFriendRequest();
const pendingRequests = computed(() => friendRequest.value.filter(r => r.status === 'PENDING'))

const socketDisconnected = useSocketDisconnected()

const currentSelectMenuIndex = ref("homepage")
const currentSelectedMainAction = ref<GameMainActionInfo>()

const { isMobile } = useDevice()
const chatPanelVisible = ref(false)
const chatHasUnread = ref(false)
const ironCat = useIronCat()

const showMenuDrawer = ref(false)

const chatRef = ref()
function openChatPanel() {
  chatPanelVisible.value = true
  chatHasUnread.value = false
}

function joinBattleRoom(e: EventBusJoinBattleRoomEvent) {
  onLeftMenuSelect('battle')
  emitJoinBattleRoom(e.roomUuid);
}

onMounted(() => {
  // 监听聊天组件新消息事件
  eventBus.on('open-private-chat', openChatPanel)
  eventBus.on('open-chat-panel', openChatPanel)
  eventBus.on('join-battle-room', joinBattleRoom)
})
onUnmounted(() => {
  // 取消监听聊天组件新消息事件
  eventBus.off('open-private-chat', openChatPanel)
  eventBus.off('open-chat-panel', openChatPanel)
  eventBus.off('join-battle-room', joinBattleRoom)
})

// 使用全局 pendingMenu：当 gameInited 完成后再消费（若需要）
watchPendingMenu((menu) => {
  onLeftMenuSelect(menu)
}, () => gameInited.value)

watch(chatPanelVisible, (visible) => {
  if (visible && chatRef.value?.scrollToBottom) {
    // 等待面板动画完成后再滚动
    setTimeout(() => {
      chatRef.value.scrollToBottom(true)
    }, 30)
  }
})


const marketShowResourceId = computed<AllGameResourceID | undefined>(() => {
  const q = route.query.marketResource
  return Array.isArray(q) ? (q[0] as AllGameResourceID) : (q as AllGameResourceID | undefined)
})
const onInventoryItemNeedShowInMarket = (p: {itemId: AllGameResourceID}) => {
  openMarketWithResource(p.itemId)
}

const openMarketWithResource = (itemId: AllGameResourceID) => {
  router.replace({
    query: {
      ...route.query,
      tab: 'market',
      marketResource: itemId,
    },
  })
}

eventBus.on('show-in-market', (e) => {
  openMarketWithResource(e.itemId)
})

const dismantleItemId = ref<AllGameResourceID>()
const enhanceItemId = ref<AllGameResourceID>()

eventBus.on('enhance-item', (e) => {
  updateRouteTab('enhance')
  enhanceItemId.value = e.itemId
  setTimeout(() => {
    enhanceItemId.value = undefined
  }, 300)
})

eventBus.on('dismantle-item', (e) => {
  updateRouteTab('dismantle')
  dismantleItemId.value = e.itemId
  setTimeout(() => {
    dismantleItemId.value = undefined
  }, 300)
})

// 监听聊天组件新消息事件
function onChatNewMessage() {
  if (!chatPanelVisible.value) {
    chatHasUnread.value = true
  }
}

// reference to the left el-menu component
const leftMenuRef = ref<any>(null)

type MenuChild = {
  index: string;
  icon: string;
  title: string;
  visible?: () => boolean | undefined;
  onClick?: (arg?: any) => void;
  badge?: boolean;
  class?: string;
}

type MenuItem = {
  type: 'item' | 'submenu' | 'divider';
  index?: string;
  icon?: string;
  title?: string;
  children?: MenuChild[];
  visible?: () => boolean | undefined;
  onClick?: (arg?: any) => void;
  badge?: boolean;
  class?: string;
  key?: string;
}

/* menuItems moved further down to integrate dynamic action items */

const { user, clear, fetch: refreshSession } = useUserSession()

const profile = usePlayerProfile()

const onLeftMenuSelect = (selectMenuIndex: string, a?: any) => {

  if (selectMenuIndex == 'report') {
    window.open('https://wj.qq.com/s2/22648177/5999/', '_blank')

    return
  }

  if (selectMenuIndex == 'wiki') {
    window.open('http://wiki.moyu-idle.com', '_blank')

    return
  }

  updateRouteTab(selectMenuIndex)
}


const onGameActionMainTypeClick = (selectMenuIndex: MenuItemRegistered, gameMainActionInfo: GameMainActionInfo) => {
  currentSelectedMainAction.value = gameMainActionInfo
  updateRouteTab(selectMenuIndex.index)
}

// menuItems placed after customRenderedActionIdSet so it can reference it and use onGameActionMainTypeClick
const menuItems = computed<MenuItem[]>(() => {
  const base: MenuItem[] = [
    { type: 'item', index: 'homepage', icon: 'material-symbols:family-home-outline-rounded', title: '主页' },
    { type: 'divider' },
    { type: 'item', index: 'character', icon: 'material-symbols:emoji-people-rounded', title: '角色' },
    { type: 'item', index: 'friend', icon: 'material-symbols:groups-2', title: '好友', badge: true },
    { type: 'item', index: 'quest', icon: 'material-symbols:format-list-bulleted', title: '任务' },
    { type: 'divider' },
    {
      type: 'submenu',
      index: 'myhome',
      icon: 'game-icons:house',
      title: '家园',
      children: [
        { index: 'inventory', icon: 'material-symbols:warehouse-outline-rounded', title: '仓库' },
        { index: 'farmingPlant', icon: 'game-icons:plant-watering', title: '种植' },
        { index: 'fishing', icon: 'game-icons:fishing-boat', title: '垂钓' },
        { index: 'cattery', icon: 'game-icons:cat', title: '猫舍', visible: () => hasCattery.value, class: 'special-item' },
        { index: 'tavern', icon: 'game-icons:tavern-sign', title: '酒馆', visible: () => hasTavern.value, class: 'special-item' },
        { index: 'building', icon: 'material-symbols:home-work-outline-rounded', title: '建造' },
      ],
    },
    {
      type: 'submenu',
      index: 'village',
      icon: 'game-icons:village',
      title: '小镇',
      children: [
        { index: 'village', icon: 'material-symbols:playground-2-outline-rounded', title: '镇中心' },
        { index: 'shop', icon: 'material-symbols:shopping-basket-outline', title: '商店' },
        { index: 'market', icon: 'game-icons:shop', title: '市场' },
        { index: 'auction', icon: 'mingcute:auction-line', title: '拍卖' },
        { index: 'playerShop', icon: 'mdi:storefront-outline', title: '商业街', visible: () => !ironCat.value },
      ],
    },
    { type: 'item', index: 'guild', icon: 'material-symbols:camping-outline-rounded', title: '公会' },
    { type: 'divider' },
    { type: 'item', index: 'battle', icon: 'game-icons:crossed-swords', title: '战斗', class: 'battle-item' },
    { type: 'item', index: 'expedition', icon: 'game-icons:mountain-road', title: '猫咪探险', class: 'battle-item' },
    { type: 'divider' },
    { type: 'item', index: 'enhance', icon: 'game-icons:upgrade', title: '强化' },
    { type: 'item', index: 'dismantle', icon: 'game-icons:abstract-031', title: '分解' },
    { type: 'item', index: 'mysterious', icon: 'game-icons:paw-print', title: '炼金' },
    { type: 'divider' },
    ...(() => {
      const actionItems: MenuItem[] = Object.values(allGameActionMainType).map((mainActionInfo: GameMainActionInfo, index: number) => ({
        type: 'item',
        index: `action-${index}`,
        icon: mainActionInfo.icon,
        title: mainActionInfo.name,
        visible: () => !customRenderedActionIdSet.value.has(mainActionInfo.id),
        onClick: (menu?: any) => onGameActionMainTypeClick(menu as MenuItemRegistered, mainActionInfo),
        class: 'action-item',
        key: `action-${mainActionInfo.id}`,
      }))

      return actionItems;
    })(),
    { type: 'item', index: 'rankingList', icon: 'solar:ranking-linear', title: '排行榜' },
    { type: 'item', index: 'cheaterList', icon: 'game-icons:clown', title: '菜市口', visible: () => !ironCat.value },
    { type: 'divider' },
    { type: 'item', index: 'gameguide', icon: 'material-symbols:book-ribbon-outline-rounded', title: '游戏指南' },
    { type: 'item', index: 'dictionary', icon: 'material-symbols:dictionary-rounded', title: '词典' },
    { type: 'item', index: 'wiki', icon: 'material-symbols:globe', title: 'Wiki' },
    { type: 'item', index: 'instructions', icon: 'material-symbols:bookmark-star-outline-rounded', title: '村民守则' },
    { type: 'item', index: 'updateLog', icon: 'material-symbols:edit-document-outline-rounded', title: '更新日志' },
    { type: 'item', index: 'report', icon: 'material-symbols:support-agent-rounded', title: '意见反馈', onClick: () => { window.open('https://wj.qq.com/s2/22648177/5999/', '_blank'); } },
    { type: 'item', index: 'gm', icon: 'material-symbols:support-agent-rounded', title: 'GM', visible: () => isGM.value, class: 'gm-item' },
    { type: 'item', index: 'sponsor', icon: 'material-icon-theme:github-sponsors', title: '赞助作者', class: 'sponsor-item' },
  ]

  return base
})

const allowedMenuIndexSet = computed(() => {
  const set = new Set<string>([
    // 顶部用户菜单专用页面（无左侧菜单项）
    'selfProfile',
    'bindEmail',
    'resetPassword',
    'switchAccount',
  ])

  const isVisible = (item: { visible?: () => boolean | undefined }) => {
    try {
      return !item.visible || item.visible()
    } catch (e) {
      return false
    }
  }

  for (const mi of menuItems.value) {
    if (mi.type === 'item' && mi.index && isVisible(mi)) set.add(mi.index)
    if (mi.children && isVisible(mi)) {
      for (const c of mi.children) {
        if (c.index && isVisible(c)) set.add(c.index)
      }
    }
  }
  return set
})

const visibleChildren = (mi: MenuItem) => {
  return (mi.children || []).filter(c => !c.visible || c.visible())
}

const findItemByIndex = (idx?: string) => {
  if (!idx) return undefined
  for (const mi of menuItems.value) {
    if (mi.index === idx) return mi as any
    if (mi.children) {
      const c = mi.children.find(ch => ch.index === idx)
      if (c) return c as any
    }
  }
  return undefined
}

const mobileMenuSections = computed(() => {
  // flatten all visible menu items (top-level items and submenu children)
  const flattened: any[] = []

  for (const mi of menuItems.value) {
    if (mi.type === 'item') {
      if (!mi.visible || mi.visible()) flattened.push(mi)
    } else if (mi.type === 'submenu') {
      for (const c of mi.children || []) {
        if (!c.visible || c.visible()) {
          // ensure child shape matches top-level items for mobile rendering
          flattened.push({
            index: c.index,
            icon: c.icon,
            title: c.title,
            onClick: c.onClick,
            class: c.class,
            badge: c.badge,
          })
        }
      }
    }
  }

  console.log(menuItems.value, flattened)


  const mainKeys = ['homepage', 'character', 'friend', 'quest', 'guild']
  const main = mainKeys.map(k => flattened.find(i => i.index === k)).filter(Boolean)

  const myhomeItems = flattened.filter(i => {
    return (['inventory', 'farmingPlant', 'fishing', 'cattery', 'tavern', 'building'].includes(i.index))
  })

  const townItems = flattened.filter(i => {
    return (['village', 'shop', 'market', 'auction', 'playerShop'].includes(i.index))
  })

  const battleItems = flattened.filter(i => {
    return (['battle', 'expedition'].includes(i.index))
  })

  const actionItems = flattened.filter(i => i.class === 'action-item')

  const featuresKeys = ['enhance', 'dismantle', 'mysterious']
  const features = featuresKeys.map(k => flattened.find(i => i.index === k)).filter(Boolean)

  // collect everything already included in groups
  const included = new Set<string>([
    ...main.map((i: any) => i.index),
    ...myhomeItems.map((i: any) => i.index),
    ...townItems.map((i: any) => i.index),
    ...battleItems.map((i: any) => i.index),
    ...actionItems.map((i: any) => i.index),
    ...features.map((i: any) => i.index),
  ])

  console.log(battleItems)

  const others = flattened.filter(i => !included.has(i.index))

  const sections: any[] = [
    { key: 'main', title: '首页', items: main },
    { key: 'home', title: '家园', items: myhomeItems },
    { key: 'town', title: '小镇', items: townItems },
    { key: 'battle', title: '战斗', items: battleItems },
    { key: 'features', title: '功能', items: features },
    { key: 'actions', title: '动作', items: actionItems },
  ]

  if (others.length) sections.push({ key: 'others', title: '其他', items: others })

  return sections
})

const mobileMenuItemClick = (item: any) => {
  showMenuDrawer.value = false
  // if item has onClick (e.g. action items), call it with a synthetic menu param
  if (item.onClick) {
    try {
      item.onClick({ index: item.index })
      return
    } catch (e) {
      // fallback
    }
  }
  if (item.index) onLeftMenuSelect(item.index)
}

onMounted(async () => {
  let userInfo = unref((user?.value)) as GameSocketUserInfo
  if (userInfo?.isVisitor && !userInfo.firstResetPassword) {
    visitorDialogShow.value = true
  }
  await waitUtilConnected()

  await waitUtil(() => gameInited.value);

  onGetProfileSuccess((data) => {
    if (data) {
      profile.value = data;
    }
  });
  emitGetProfile();

  const fpPromise = FingerprintJS.load()
  fpPromise
    .then(fp => fp.get())
    .then(result => {
      $fetch("/api/game/user/online", {
        method: "POST",
        body: {
          fp: result.visitorId,
        }
      })

      // 每15分钟发送一次心跳
      setInterval(() => {
        $fetch("/api/game/user/online", {
          method: "POST",
          body: {
            fp: result.visitorId,
          }
        })
      }, 1000 * 60 * 15)
    })

  ironCat.value = !!user.value?.isIronCat
})

const visitorResetPassword = () => {
  const visitorPassword = useGlobalVisitorPassword()
  visitorPassword.value = (unref(user) as any).visitorPwd

  visitorDialogShow.value = false
  updateRouteTab("resetPassword")
}

const logout = async () => {
    ElMessageBox.confirm(
        '确定退出登录吗?',
        '退出登录',
        {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
        }
    ).then(async () => {
      await clear()
      await refreshSession()

      location.reload()
    })
}

// 20250606ShopModify
const show20250606ShopModify = ref(false)
$fetch("/api/game/tmp_notification/get_notification_info", {
  method: "POST",
  body: {
    notificationId: NOTIFY_KET_20250606ShopModify,
  }
}).then(res => {
    show20250606ShopModify.value = !res?.is_unread
})

const shop20250606ShopModifyDialogVisible = ref(false)
const onClick20250606ShopModifyButton = () => {
  shop20250606ShopModifyDialogVisible.value = true
}
const onClose20250606ShopModifyAlert = () => {
  $fetch("/api/game/tmp_notification/mark_notification_as_read", {
    method: "POST",
    body: {
      notificationId: NOTIFY_KET_20250606ShopModify,
    }
  })
}

const show20250609QQQun = ref(false)

import { useDarkMode } from '~/composables/game/useDarkMode'
import { useGameInited } from '~/composables/game/useGameInited';
import { emitJoinBattleRoom } from '~/api/game/socket/battleRoom';
import { useIronCat } from '~/composables/game/useIronCat';
import { useSocketDisconnected } from '~/composables/game/useSocketDisconnected';
import { useRoute, useRouter } from 'vue-router';
import { useFriendRequest } from '~/composables/game/useFriendRequest';
import { allGameResource } from '~/shared/data/allGameResources';
const { initDarkMode, isDark, toggleDark } = useDarkMode()
initDarkMode();

const isGM = computed(() => {
  return user.value?.isGm
})

const reloadGame = () => {
  location.reload()
}

const router = useRouter()
const route = useRoute()
const defaultMenuIndex = 'homepage'

const actionMenuMap = computed(() => {
  const map = new Map<string, GameMainActionInfo>()
  Object.values(allGameActionMainType).forEach((info, index) => {
    map.set(`action-${index}`, info)
  })
  return map
})

const applyMenuSelection = (menuIndex: string) => {
  const target = menuIndex || defaultMenuIndex
  currentSelectMenuIndex.value = target
  currentSelectedMainAction.value = actionMenuMap.value.get(target)
}

const updateRouteTab = (menuIndex: string) => {
  const tabValue = menuIndex || undefined
  const newQuery = { ...route.query }
  if (tabValue) {
    newQuery.tab = tabValue
  } else {
    delete newQuery.tab
  }
  const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  if (currentTab === tabValue) return
  router.replace({ query: newQuery })
}

watch(() => route.query.tab, (tab) => {
  const nextTab = Array.isArray(tab) ? tab[0] : tab
  const candidate = typeof nextTab === 'string' && nextTab.length ? nextTab : defaultMenuIndex
  const validated = allowedMenuIndexSet.value.has(candidate) ? candidate : defaultMenuIndex
  if (validated !== candidate) {
    updateRouteTab(validated)
  }
  applyMenuSelection(validated)
}, { immediate: true })

// Custom rendered action menus (for Alchemy and Collecting, extensible)
type CustomRenderedActionMenu = {
  id: string;          // action id from allGameActionMainType
  index: string;       // left menu index string used for selection
  component: any;      // component to render
}

const customRenderedActionMenus: CustomRenderedActionMenu[] = [
  { id: 'mysterious', index: 'mysterious', component: resolveComponent('GameAlchemy') as unknown as object },
  // { id: 'collecting', index: 'collecting', component: resolveComponent('GameFarming') as unknown as object },
]

const customRenderedActionIdSet = computed(() => new Set(customRenderedActionMenus.map(i => i.id)))


import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
// @ts-ignore
window.tAllGameResource = clone(allGameResource);
// @ts-ignore
window.tAllEnhanceInfo = clone(enhanceInfoJson);
</script>


<style scoped lang="scss">
/* 美化的样式 */

/* 顶部导航栏美化 - 更素雅的配色 */
.moyu__header {
  background: white; // linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  color: #374151;
  position: relative;
  border-bottom: 1px solid #e5e7eb;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(148,163,184,0.05) 0%, rgba(203,213,225,0.05) 100%);
    pointer-events: none;
  }

  :deep(.el-page-header__left) {
    .el-divider.el-divider--vertical {
      display: none;
    }

  }
}

/* 黑夜模式下的顶部栏 */
.dark .moyu__header {
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  color: #f9fafb;
  border-bottom: 1px solid #374151;
}

/* 主题切换按钮美化 */
.theme-toggle-btn {
  border: 2px solid rgba(148,163,184,0.2);
  background: rgba(248,250,252,0.8);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  color: #6b7280;
  
  &:hover {
    background: rgba(248,250,252,0.9);
    transform: scale(1.05);
    border-color: rgba(148,163,184,0.3);
  }
}

.dark .theme-toggle-btn {
  border-color: rgba(156,163,175,0.3);
  background: rgba(55,65,81,0.8);
  color: #d1d5db;
  
  &:hover {
    background: rgba(55,65,81,0.9);
    border-color: rgba(156,163,175,0.4);
  }
}

.light-mode-btn {
  color: #f59e0b;
}

.dark-mode-btn {
  color: #60a5fa;
}

/* 用户下拉菜单美化 */
.user-dropdown {
  .el-dropdown__popper {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    border: 1px solid #e5e7eb;
  }

  :deep(.player-name) {
    color: #374151;
  }
}

.dark .user-dropdown {
  .el-dropdown__popper {
    border-color: #374151;
  }
  
  :deep(.player-name) {
    color: #f9fafb;
  }
}

.cute-dropdown-menu {
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}

.dark .cute-dropdown-menu {
  background: #1f2937;
}

.cute-dropdown-item {
  padding: 12px 16px;
  transition: all 0.3s ease;
  color: #374151;
  
  &:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
}

.dark .cute-dropdown-item {
  color: #f9fafb;
  
  &:hover {
    background: #374151;
    color: #ffffff;
  }
}

/* 侧边栏美化 - 更素雅的配色 */
.cute-sidebar {
  background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
  border-right: 1px solid #e5e7eb;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg, rgba(148,163,184,0.02) 0%, rgba(203,213,225,0.02) 100%);
    pointer-events: none;
  }
}

.dark .cute-sidebar {
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
  border-right: 1px solid #374151;
}

/* 菜单项美化 */
.cute-menu {
  border: none !important;
  background: transparent !important;

  &:deep(.el-sub-menu__title + [role="menu"]) {
    padding-left: 8px !important;
  }
}

.cute-menu-item {
  margin: 4px 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  color: #6b7280;

  &.el-sub-menu {
    .menu-text, .iconify {
      color: #6b7280;
    }

    @at-root .dark & {
      .menu-text, .iconify {
        color: #9ca3af;
      }
    }
  }

  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(148,163,184,0.1), transparent);
    transition: left 0.5s ease;
  }
  
  &:hover::before {
    left: 100%;
  }
  
  &:not(.el-sub-menu):hover {
    background: #f3f4f6;
    color: #374151;
    transform: translateX(3px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  &:not(.el-sub-menu).is-active {
    background: #e5e7eb;
    color: #1f2937;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  :deep(.el-menu-tooltip__trigger) {
    padding: 0;
    display: flex;
    justify-content: center;
  }
}

.dark .cute-menu-item {
  color: #9ca3af;
  
  &:hover {
    background: #374151;
    color: #f3f4f6;
  }
  
  &.is-active {
    background: #4b5563;
    color: #ffffff;
  }
}

/* 特殊菜单项 */
.special-item:hover {
  background: #fef3c7;
  color: #92400e;
}

.dark .special-item:hover {
  background: #451a03;
  color: #fbbf24;
}

.battle-item:hover {
  background: #fee2e2;
  color: #dc2626;
}

.dark .battle-item:hover {
  background: #450a0a;
  color: #f87171;
}

.action-item:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

.dark .action-item:hover {
  background: #1e3a8a;
  color: #93c5fd;
}

.gm-item:hover {
  background: #f3e8ff;
  color: #7c3aed;
}

.dark .gm-item:hover {
  background: #3730a3;
  color: #c4b5fd;
}

.sponsor-item:hover {
  background: #ecfdf5;
  color: #059669;
}

.dark .sponsor-item:hover {
  background: #064e3b;
  color: #6ee7b7;
}

.collapse-item:hover {
  background: #f1f5f9;
  color: #475569;
}

.dark .collapse-item:hover {
  background: #334155;
  color: #cbd5e1;
}

/* 分割线美化 */
.cute-divider {
  border-color: #e5e7eb;
  margin: 8px 16px !important;
}

.dark .cute-divider {
  border-color: #374151;
}

/* 菜单图标和文字 */
.menu-icon {
  transition: all 0.3s ease;
}

.cute-menu-item:hover .menu-icon {
  transform: scale(1.05);
}

.menu-text {
  font-weight: 500;
  transition: all 0.3s ease;
}

/* 主内容区域美化 */
.cute-content {
  background: #f9fafb;
  position: relative;
}

.dark .cute-content {
  background: #111827;
}

.cute-main {
  position: relative;

  @media screen and (max-width: 768px) {
    height: calc(100vh - 64px);
  }
}

.content-wrapper {
  position: relative;
  z-index: 1;
}

/* 卡片美化 */
.cute-card {
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
  background: #ffffff;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
}

.dark .cute-card {
  background: #1f2937;
  border-color: #374151;
  color: #f9fafb;
}

/* 悬浮聊天按钮美化 */
.cute-chat-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #6b7280;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: fixed;
  overflow: hidden;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    background: #4b5563;
  }
  
  &:active {
    transform: scale(0.95);
  }
}

/* 聊天面板美化 */
.cute-chat-panel {
  border-radius: 16px 16px 0 0;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.dark .cute-chat-panel {
  border-color: #374151;
}

.cute-close-btn {
  background: #f3f4f6;
  color: #6b7280;
  border: none;
  transition: all 0.3s ease;
  
  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
}

.dark .cute-close-btn {
  background: #374151;
  color: #d1d5db;
  
  &:hover {
    background: #4b5563;
    color: #f9fafb;
  }
}

/* 对话框美化 */
.cute-dialog {
  .el-dialog {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid #e5e7eb;
  }
  
  .el-dialog__header {
    background: #f9fafb;
    color: #374151;
    padding: 20px;
    text-align: center;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .el-dialog__title {
    font-size: 1.2rem;
    font-weight: bold;
  }
}

.dark .cute-dialog {
  .el-dialog {
    border-color: #374151;
  }
  
  .el-dialog__header {
    background: #1f2937;
    color: #f9fafb;
    border-bottom-color: #374151;
  }
}

.cute-dialog-content {
  padding: 20px;
}

/* 按钮美化 */
.cute-button {
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  background: #6b7280;
  border: none;
  color: white;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    background: #4b5563;
  }
}

/* 动画效果保持原样 */
@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translate3d(0,0,0);
  }
  40%, 43% {
    transform: translate3d(0,-8px,0);
  }
  70% {
    transform: translate3d(0,-4px,0);
  }
  90% {
    transform: translate3d(0,-2px,0);
  }
}

.bounce-enter-active {
  animation: bounce 0.6s ease;
}

.bounce-leave-active {
  animation: bounce 0.6s ease reverse;
}

/* 滑动动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 响应式优化 */
@media (max-width: 768px) {
  .cute-chat-button {
    width: 50px;
    height: 50px;
  }
  
  .cute-menu-item {
    margin: 0px 4px;
    border-radius: 6px;
  }
  
  .cute-sidebar {
    &::before {
      opacity: 0.01;
    }
  }
}

/* 其余原有样式保持不变 */
.moyu-idle__body-section {
  background-color: transparent;
}

.chat-panel {
  --chat-panel-spacing: 16px;
  --chat-panel-left: 136px;
  left: calc(var(--chat-panel-left) + var(--chat-panel-spacing));
  right: var(--chat-panel-spacing);

  @media screen and (max-width: 768px) {
    & {
      --chat-panel-left: 0px;
      --chat-panel-left: 0px;
    }
    
    .cute-chat-panel {
      width: 100% !important;
    }
  }
}

.moyu-mobile .chat-panel {
  bottom: 24px;
}

.moyu-mobile.menu-collapsed .chat-panel {
  --chat-panel-spacing: 8px;
  --chat-panel-left: 48px;
}

.moyu-idle__content {
  max-height: calc(100vh - 64px);
}

.aside {
  max-height: calc(100vh - 64px);
}

/* Socket disconnected fixed banner */
.socket-disconnected-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  // pointer-events: none;
}
.socket-disconnected-banner__inner {
  pointer-events: auto;
  width: 100%;
  max-width: 1280px;
  margin: 8px;
  background: #ef4444; /* red-500 */
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  text-align: center;
  font-weight: 600;
}

@media (max-width: 768px) {
  .socket-disconnected-banner__inner {
    margin: 6px;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 14px;
  }
}
</style>