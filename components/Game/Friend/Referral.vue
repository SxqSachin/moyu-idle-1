<template>
  <div class="flex flex-col gap-4">
    <!-- 头部卡片 -->
    <el-card class="text-white">
      <template #default>
        <!-- 推荐链接 -->
        <div class="flex items-center gap-2 text-lg font-bold mb-4">
          <el-icon>
            <Link />
          </el-icon>
          <span>我的专属邀请链接</span>
        </div>
        <div class="mb-3">
          <el-input v-model="url" readonly class="font-mono text-xs">
            <template #append>
              <el-button @click="copyLink" type="primary">
                <el-icon>
                  <DocumentCopy />
                </el-icon>

                复制
              </el-button>
            </template>
          </el-input>
        </div>
      </template>
    </el-card>

        <!-- 自定义邀请礼包 -->
        <el-card>
          <template #default>
            <div class="flex flex-col md:flex-row items-start justify-between mb-4 gap-2">
              <div class="flex items-center gap-2 text-lg font-bold">
                  <el-icon>
                    <Icon name="material-symbols:local-florist-outline-rounded" />
                  </el-icon>
                  <span>我的邀请礼包</span>
              </div>

              <div class="flex flex-col md:flex-row items-start md:items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <el-button size="small" type="primary" @click="openRewardDialog" :loading="editingReward">设置 / 修改礼包</el-button>
                <span v-if="inviteRewardSetting?.lastUpdatedAt && nextRewardModifyAt" class="text-xs">下次可修改：{{ formatTime(nextRewardModifyAt) }}</span>
              </div>
            </div>

            <div class="text-xs text-gray-500 mb-2">你可以设置邀请礼包，当被邀请人确认邀请关系后，他们将获得礼包内的资源。</div>
            <div class="text-xs text-gray-500 mb-2">被邀请人随时可以看到你的礼包内容。</div>

            <div class="flex flex-col flex-wrap pb-4 mt-4">
              <template v-if="displayRewards.length">
                <div class="flex flex-row flex-wrap gap-4">
                  <ItemSlot v-for="res in displayRewards" :key="res.id" :resource-id="res.id" :count="res.count">
                  </ItemSlot>
                </div>
              </template>
              <div v-else class="text-sm text-center self-center text-gray-500">
                <el-empty description="礼包为空" :image-size="48"></el-empty>
              </div>
            </div>
          </template>
        </el-card>

    <!-- 奖励说明卡片 -->
    <el-card>
      <template #default>
        <div class="flex items-center gap-2 text-lg font-bold mb-4">
          <el-icon>
            <Icon name="material-symbols:featured-seasonal-and-gifts-rounded"></Icon>
          </el-icon>
          <span>邀请奖励</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <el-card shadow="hover">
            <div class="flex flex-row items-center gap-2">
              <div class="text-blue-400 dark:text-blue-600">
                <el-icon size="32">
                  <Trophy />
                </el-icon>
              </div>
              <h3 class="text-base font-bold mb-2 m-0">阶段一奖励</h3>
            </div>
            <div class="mt-2">
              <span class="block text-sm">
                被邀请的玩家达成：<br />
                1. 注册满5天<br />
                2. 总生活等级（不含交易）到达100级
                3. 完成邮箱验证
              </span>
              <div class="text-sm my-2">
                可获得:
              </div>
              <div class="mb-2 flex gap-2 flex-wrap">
                <GameCommonResourceIconAndName v-for="(count, id) in REFERRER_REWARD[0]" :key="id" :resource-id="id"
                  :count="count?.count" />
              </div>
            </div>
          </el-card>

          <el-card shadow="hover">
            <div class="flex flex-row items-center gap-2">
              <div class="text-blue-500">
                <el-icon size="32">
                  <Trophy />
                </el-icon>
              </div>
              <h3 class="text-base font-bold mb-2 m-0">阶段二奖励</h3>
            </div>
            <div class="mt-2">
              <span class="block text-sm">
                被邀请的玩家达成：<br />
                1. 注册满10天<br />
                2. 总生活等级（不含交易）到达220级 <br />
                3. 完成邮箱验证 <br />
                4. 确认邀请关系
              </span>
              <div class="text-sm my-2">
                可获得:
              </div>
              <div class="mb-2 flex gap-2 flex-wrap">
                <GameCommonResourceIconAndName v-for="(count, id) in REFERRER_REWARD[1]" :key="id" :resource-id="id"
                  :count="count?.count" />
              </div>
            </div>
          </el-card>

          <el-card shadow="hover">
            <div class="flex flex-row items-center gap-2">
              <div class="text-blue-500">
                <el-icon size="32">
                  <Money />
                </el-icon>
              </div>
              <h3 class="text-base font-bold mb-2 m-0">持续收益</h3>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 m-0"><b>已确认邀请关系</b>的好友赞助所获得的赞助积分 <strong>10%</strong></p>
              <div class="flex items-center gap-1 font-bold text-amber-600">
                <el-icon>
                  <TrendCharts />
                </el-icon>
                <span>持续获得</span>
              </div>
            </div>
          </el-card>
        </div>
      </template>
    </el-card>

    <!-- 统计数据卡片 -->
    <el-card v-if="inviter" class="border-0 bg-white shadow-lg">
      <template #default>
        <!-- 邀请人信息 -->
        <div class="mb-4">
          <div class="flex items-center gap-2 text-lg font-bold mb-4">
            <el-icon>
              <Icon name="material-symbols:emoji-people-rounded"></Icon>
            </el-icon>
            <span>你的邀请人</span>
          </div>
          <div class="flex flex-row items-center justify-between gap-3">
            <div>
              <GameUserAvatarAndName :uuid="inviter.uuid"  @click="showPlayerInfo(inviter.uuid)"/>
              <div class="text-sm flex-1">
                <div class="text-xs text-gray-500">邀请时间: {{ inviter.createDate ? formatTime(inviter.createDate) : '-' }}</div>
              </div>
            </div>
            <div class="flex-shrink-0">
              <el-button v-if="confirmed === true" type="success" size="small" disabled>已确认</el-button>
              <template v-else-if="confirmed === false">
                <el-popconfirm placement="top" hide-icon width="300" title="确认关系后，你将可以获得邀请人提供的“礼包”，同时邀请人可以获得“邀请奖励”" @confirm="confirmRelationship">
                  <template #reference>
                    <el-button type="primary" size="small">确认关系</el-button>
                  </template>
                </el-popconfirm>
              </template>
              <span v-else class="text-xs text-gray-500">查询中...</span>

              <el-popconfirm placement="top" width="250" title="删除关系后，你的邀请关系将被删除，请确认后再操作" @confirm="deleteRelationship">
                <template #reference>
                  <el-button type="danger" size="small" class="ml-2" v-if="canDeleteRelationship">删除关系</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
          <div class="mt-3">
            <template v-if="!confirmed">
              <el-divider class="my-4!"></el-divider>
              <div class="text-xs text-gray-500 mb-2">确认邀请关系后，你可以获得来自邀请人提供的礼包：</div>
              <div class="flex flex-wrap gap-3" v-if="inviterRewardList.length">
                <ItemSlot v-for="res in inviterRewardList" :key="res.id" :resource-id="res.id" :count="res.count">
                </ItemSlot>
              </div>
              <div v-else class="text-xs text-gray-500">无礼包或未设置</div>
            </template>
          </div>
        </div>
      </template>
    </el-card>
    <el-card class="border-0 bg-white shadow-lg" v-if="info">
      <template #default>
        <div class="flex items-center justify-between gap-2 text-lg font-bold mb-4">
          <div class="flex flex-row items-center gap-2">
            <el-icon>
              <Icon name="material-symbols:bar-chart-rounded"></Icon>
            </el-icon>
            <span>邀请统计</span>
          </div>
          <el-button @click="refreshInfo" :loading="refshing">刷新</el-button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <el-popover>
            <template #reference>
              <el-card shadow="hover" class="cursor-pointer" @click="showReferrerInfo">
                <div class="text-3xl font-bold mb-2 text-blue-400">{{ info.total }}</div>
                <div class="text-sm opacity-80 mb-2">总邀请数</div>
              </el-card>
            </template>
            <div class="text-center">
              点击查看详情
            </div>
          </el-popover>

          <el-card shadow="hover">
            <div class="text-3xl font-bold mb-2">{{ info.unclaimedStage1Count }}</div>
            <div class="text-sm opacity-80 mb-2">可领取一阶段奖励</div>
            <el-button :loading="claiming" v-if="info.unclaimedStage1Count > 0" class="w-full" size="small"
              type="success" @click="claimStage1Rewards">
              领取奖励
            </el-button>
          </el-card>

          <el-card shadow="hover">
            <div class="text-3xl font-bold mb-2">{{ info.unclaimedStage2Count }}</div>
            <div class="text-sm opacity-80 mb-2">可领取二阶段奖励</div>
            <el-button :loading="claiming" v-if="info.unclaimedStage2Count > 0" class="w-full" size="small"
              type="success" @click="claimStage2Rewards">
              领取奖励
            </el-button>
          </el-card>

          <el-card shadow="hover">
            <div class="text-3xl font-bold mb-2">{{ info.claimedStage1Count + info.claimedStage2Count }}</div>
            <div class="text-sm opacity-80 mb-2">已领取奖励</div>
          </el-card>
        </div>
  
      </template>
    </el-card>
  </div>

  <el-dialog v-model="showReferredListDialog" width="375px" title="推荐玩家列表" :align-center="true">
    <div class="text-xs mb-4 text-gray-400 dark:gray-600">点击玩家头像可查看详情</div>
    <div class="flex flex-col items-start justify-start gap-2 divide-y divide-gray-300 dark:divide-gray-700">
      <template v-for="u in info?.referredUserInfo">
        <div class="w-full flex flex-col gap-2 pb-4 last:pb-0">
          <div class="flex flex-row items-center justify-between">
            <GameUserAvatarAndName :uuid="u.uuid" @click="showPlayerInfo(u.uuid)"></GameUserAvatarAndName>
            <template v-if="u.confirmed">
              <el-tag type="success" size="small">已确认</el-tag>
            </template>
            <template v-else>
              <el-tag type="info" size="small">未确认</el-tag>
            </template>
          </div>
          <el-tab></el-tab>
          <span class="text-xs">创建时间: {{ formatTime(u.createDate) }}</span>
          <span class="text-xs">最后活跃: {{ formatTime(u.latestOnlineDate) }}</span>
        </div>
      </template>
    </div>
  </el-dialog>

  <!-- 玩家信息弹窗 -->
  <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
    :close-on-click-modal="true" destroy-on-close>
    <template #header>
      <span>玩家信息</span>
    </template>

    <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
  </el-dialog>

  <!-- 设置邀请礼包 -->
  <el-dialog v-model="rewardDialogVisible" :width="isMobile ? '100%' : '520px'" title="设置邀请礼包" :close-on-click-modal="false">
    <div class="space-y-4">
      <div class="text-sm text-gray-500">每7天可修改一次，确认邀请时会从你的背包扣除并发给新人。</div>

      <div class="text-xs">
        <div> 不可包含强化后的物品</div>
        <div> 不可包含不可交易的物品（金币、心意点数可以添加）</div>

        <div class="mt-2"> 物品种类上限：{{ INVITE_REWARD_MAX_ITEM_KINDS }}</div>
        <div> - 生活装备种类上限：{{INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS}}</div>
        <div> - 战斗装备种类上限：{{ INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS }}</div>

        <div class="mt-2">每种物品数量上限：</div>
        <div> - 金币：{{ INVITE_REWARD_ITEM_LIMITS.gold }}</div>
        <div> - 心意点数：{{ INVITE_REWARD_ITEM_LIMITS.cutePoint }}</div>
        <div> - 装备类：{{ INVITE_REWARD_MAX_EQUIPITEM_LIMIT }}</div>
        <div> - 其他：{{ INVITE_REWARD_DEFAULT_ITEM_LIMIT }}</div>

      </div>

      <div class="space-y-2">
        <div class="text-sm font-semibold">已选物品<span class="text-xs">（将数量设置为0可以删除物品）</span></div>
        <div class="grid grid-wrap grid-cols-3 gap-3">
          <template v-if="Object.keys(rewardDraft).length">
            <div v-for="(val, id) in rewardDraft" :key="id" class="flex flex-col items-center">
              <ItemSlot :resource-id="id">
              </ItemSlot>
              <el-input-number
                class="mt-8"
                size="small"
                :model-value="val?.count ?? 0"
                :min="0"
                :max="getInviteRewardLimit(id as AllGameResourceID)"
                @change="(v) => updateRewardDraftItem(id as AllGameResourceID, v ?? 1)"
              />
            </div>
          </template>
          <div v-else class="text-sm text-gray-500">还没有选择物品</div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="text-sm font-semibold">添加物品</div>
        <el-select :disabled="canAddMoreInviteGift" filterable placeholder="选择物品" class="w-full" @change="(val: AllGameResourceID)=>updateRewardDraftItem(val, rewardDraft[val]?.count ?? 1)">
          <el-option v-for="item in availableRewardItems" :key="item.id" :label="item.name" :value="item.id">
            <GameCommonSimpleResourceIconAndName :resource-id="item.id">(库存：{{formatNumber(inventory?.[item.id]?.count ?? 0)}})</GameCommonSimpleResourceIconAndName>
          </el-option>
        </el-select>
      </div>

      <div class="text-right">
        <el-button @click="rewardDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="editingReward" @click="setInviteReward">保存</el-button>
      </div>
    </div>
  </el-dialog>



</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { 
  UserFilled, Link, DocumentCopy, Medal, Trophy,
  Money, TrendCharts, DataAnalysis, User, Coin 
} from '@element-plus/icons-vue'
import { ElMessage, ElNotification } from 'element-plus'
import { formatCountToStr, formatNumber, formatTime, generateReferralCode } from '~/shared/utils'
import type { FuncAction } from '~/shared/types'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { emitClaimedStage1Reward, emitClaimedStage2Reward, emitGetReferrerInfo, onClaimedStage1RewardFail, onClaimedStage1RewardSuccess, onClaimedStage2RewardFail, onClaimedStage2RewardSuccess, onGetReferrerInfoFail, onGetReferrerInfoSuccess, emitGetMyInviter, onGetMyInviterSuccess, onGetMyInviterFail, emitGetConfirmReferredRelationshipInfo, onGetConfirmReferredRelationshipInfoSuccess, onGetConfirmReferredRelationshipInfoFail, emitConfirmReferredRelationship, onConfirmReferredRelationshipSuccess, onConfirmReferredRelationshipFail, emitDeleteReferredRelationship, onDeleteReferredRelationshipSuccess, onDeleteReferredRelationshipFail, emitSetInviteRewardSetting, onSetInviteRewardSettingSuccess, onSetInviteRewardSettingFail, emitGetInviteRewardSetting, onGetInviteRewardSettingSuccess, onGetInviteRewardSettingFail } from '~/api/game/socket/referrer'
import { type ReferrerInfo, type InviteRewardSetting } from '~/shared/types/referrer'
import { INVITE_REWARD_DEFAULT_ITEM_LIMIT, INVITE_REWARD_EDIT_COOLDOWN_MS, INVITE_REWARD_ITEM_LIMITS, INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS, INVITE_REWARD_MAX_EQUIPITEM_LIMIT, INVITE_REWARD_MAX_ITEM_KINDS, INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS, REFERRER_REWARD } from '~/shared/data/constant'
import type { ItemCountInfo } from '~/shared/types/gameInventory'
import type { AllGameResourceID } from '~/shared/types/gameResource'
import ItemSlot from '~/components/Game/Common/ItemSlot.vue'
import { allGameResource } from '~/shared/data/allGameResources'
import { useInventory } from '~/composables/game/useInventory'

const { user } = useUserSession()

const { isMobile } = useDevice();
const inventory = useInventory();

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
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
let off16: FuncAction
let off17: FuncAction
let off18: FuncAction

const info = ref<ReferrerInfo>()
const inviter = ref<{ uuid: string; name?: string; createDate?: string | Date } | null>(null)
const showReferredListDialog = ref(false)
const confirmedInfo = ref<{
  confirmed: boolean,
  confirmedAt: string | Date | null
}>()

// 邀请礼包
const inviteRewardSetting = ref<{
  uuid: string
  userUuid: string
  reward: ItemCountInfo
  isActive: boolean
  lastUpdatedAt: string | Date
} | null>(null)

const inviterRewardSetting = ref<InviteRewardSetting | null>(null)

const pendingRewardTarget = ref<string | null>(null)

const editingReward = ref(false)
const rewardDialogVisible = ref(false)
const rewardDraft = reactive<ItemCountInfo>({})

const displayRewards = computed(() => {
  const reward = inviteRewardSetting.value?.reward ?? {}
  return Object.entries(reward).map(([id, val]) => ({
    id: id as AllGameResourceID,
    count: val?.count ?? 0,
    name: allGameResource[id as AllGameResourceID]?.name ?? id,
  })).filter(r => r.count > 0)
})

const inviterRewardList = computed(() => {
  const reward = inviterRewardSetting.value?.reward ?? {}
  return Object.entries(reward).map(([id, val]) => ({
    id: id as AllGameResourceID,
    count: val?.count ?? 0,
    name: allGameResource[id as AllGameResourceID]?.name ?? id,
  })).filter(r => r.count > 0)
})

const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);
function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid || null;
  playerInfoDialogVisible.value = true;
}

const claiming = ref(false)

const refshing = ref(false)
const refreshInfo = (e: Event) => {
  if (!e.isTrusted) return;
  refshing.value = true
  emitGetReferrerInfo()
}

onMounted(async () => {
  await waitUtilConnected()

  off1 = onGetReferrerInfoSuccess(data => {
    setTimeout(() => {
      refshing.value = false
    }, 1000)

    info.value = data.info
  })

  off7 = onGetMyInviterSuccess((data) => {
    inviter.value = data.inviter ? { uuid: data.inviter.uuid, name: data.inviter.name, createDate: data.inviter.createDate } : null;
    if (data.inviter?.uuid) {
      requestInviteRewardSetting(data.inviter.uuid)
    }
  })

  off8 = onGetMyInviterFail((data) => {
    ElNotification.error({ title: '获取邀请人信息失败', message: data.message });
  })

  off2 = onGetReferrerInfoFail(data => {
    setTimeout(() => {
      refshing.value = false
    }, 1000)

    ElNotification.error({
      title: '获取推荐信息失败',
      message: data.message
    })
  })

  off3 = onClaimedStage1RewardSuccess(() => {
    setTimeout(() => {
      claiming.value = false;
    }, 1000);
    ElNotification.success({
      title: '一阶段奖励领取成功',
      message: '奖励已发放到您的背包，请注意查收'
    })
  })
  off4 = onClaimedStage1RewardFail(data => {
    setTimeout(() => {
      claiming.value = false;
    }, 1000);
    ElNotification.error({
      title: '一阶段奖励领取失败',
      message: data.message
    })
  })
  off5 = onClaimedStage2RewardSuccess(() => {
    setTimeout(() => {
      claiming.value = false;
    }, 1000);
    ElNotification.success({
      title: '二阶段奖励领取成功',
      message: '奖励已发放到您的背包，请注意查收'
    })
  })
  off6 = onClaimedStage2RewardFail(data => {
    setTimeout(() => {
      claiming.value = false;
    }, 1000);
    ElNotification.error({
      title: '二阶段奖励领取失败',
      message: data.message
    })
  })

  off9 = onGetConfirmReferredRelationshipInfoSuccess((data) => {
    confirmedInfo.value = data;
  })

  off10 = onGetConfirmReferredRelationshipInfoFail((data) => {
    ElNotification.error({ title: '获取确认状态失败', message: data.message });
  })

  off11 = onConfirmReferredRelationshipSuccess(() => {
    confirmedInfo.value = {
      confirmed: true,
      confirmedAt: new Date()
    };
    ElNotification.success({ title: '确认成功', message: '邀请关系已确认' });
  })

  off12 = onConfirmReferredRelationshipFail((data) => {
    ElNotification.error({ title: '确认失败', message: data.message });
  })

  off13 = onDeleteReferredRelationshipSuccess(() => {
    confirmedInfo.value = undefined;
    inviter.value = null;
    ElNotification.success({ title: '删除成功', message: '邀请关系已删除' });
  })

  off14 = onDeleteReferredRelationshipFail((data) => {
    ElNotification.error({ title: '删除失败', message: data.message });
  })

  off15 = onSetInviteRewardSettingSuccess((data) => {
    editingReward.value = false
    rewardDialogVisible.value = false
    if (data.setting) {
      inviteRewardSetting.value = data.setting
    }
    ElNotification.success({ title: '已保存邀请礼包', message: '修改每7天可进行一次' })
  })

  off16 = onSetInviteRewardSettingFail((data) => {
    editingReward.value = false
    ElNotification.error({ title: '保存失败', message: data.message })
  })

  off17 = onGetInviteRewardSettingSuccess((data) => {
    const target = pendingRewardTarget.value
    pendingRewardTarget.value = null
    if (target && target === user.value?.uuid) {
      inviteRewardSetting.value = data.setting ?? null
    } else {
      inviterRewardSetting.value = data.setting ?? null
    }
  })

  off18 = onGetInviteRewardSettingFail((data) => {
    pendingRewardTarget.value = null
    ElNotification.error({ title: '获取邀请礼包失败', message: data.message })
  })


  emitGetReferrerInfo()
  emitGetMyInviter()
  emitGetConfirmReferredRelationshipInfo()
  requestInviteRewardSetting()
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
  off16?.()
  off17?.()
  off18?.()
})

const referralCode = computed(() => {
  const userUuid = user.value?.uuid
  if (!userUuid) return ""
  return generateReferralCode(userUuid)
})

const url = computed(() => {
  if (process.client) {
    return `${location.protocol}//${location.host}/login?ref=${unref(referralCode)}`
  }
  return ""
})

const nextRewardModifyAt = computed(() => {
  if (!inviteRewardSetting.value) return null
  // 优先使用后端返回的 nextEditableAt
  const rawNext = (inviteRewardSetting.value as InviteRewardSetting).nextEditableAt ?? null
  if (rawNext) {
    return rawNext instanceof Date ? rawNext : new Date(rawNext)
  }

  let lastUpdateAt = inviteRewardSetting.value.lastUpdatedAt
  const last = typeof lastUpdateAt === 'string' ? new Date(lastUpdateAt) : lastUpdateAt
  return new Date(last.getTime() + INVITE_REWARD_EDIT_COOLDOWN_MS)
})

// 复制链接
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(url.value)
    ElMessage.success('链接已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 领取一阶段奖励
const claimStage1Rewards = (e: Event) => {
  if (!e.isTrusted) return

  emitClaimedStage1Reward()

  claiming.value = true
}

// 领取二阶段奖励
const claimStage2Rewards = (e: Event) => {
  if (!e.isTrusted) return

  emitClaimedStage2Reward()

  claiming.value = true
}

const openRewardDialog = () => {
  // 初始化草稿为当前奖励
  rewardDraftReset()
  rewardDialogVisible.value = true
}

const rewardDraftReset = () => {
  const reward = inviteRewardSetting.value?.reward ?? {}
  Object.keys(rewardDraft).forEach(k => delete rewardDraft[k as keyof ItemCountInfo])
  Object.entries(reward).forEach(([k, v]) => {
    if (v?.count) {
      rewardDraft[k as keyof ItemCountInfo] = { count: v.count }
    }
  })
}

const setInviteReward = () => {
  if (editingReward.value) return
  // if (!Object.keys(rewardDraft).length) {
    // ElNotification.error({ title: '保存失败', message: '奖励不能为空' })
    // return
  // }
  for (const [id, val] of Object.entries(rewardDraft)) {
    const maxLimit = getInviteRewardLimit(id as AllGameResourceID)
    const c = val?.count ?? 0
    if (c <= 0) {
      ElNotification.error({ title: '保存失败', message: `物品${id}数量必须大于0` })
      return
    }
    if (c > maxLimit) {
      ElNotification.error({ title: '保存失败', message: `物品${id}数量超过上限(${maxLimit})` })
      return
    }
  }
  editingReward.value = true
  emitSetInviteRewardSetting(rewardDraft)
}

const requestInviteRewardSetting = (targetUuid?: string) => {
  pendingRewardTarget.value = targetUuid ?? user.value?.uuid ?? null
  emitGetInviteRewardSetting(targetUuid)
}

// 格式化日期
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const showReferrerInfo = () => {
  showReferredListDialog.value = true
}

// 确认邀请关系
const confirmRelationship = (e: Event) => {
  if (!e.isTrusted) return;
  emitConfirmReferredRelationship();
}

// 删除邀请关系
const deleteRelationship = (e: Event) => {
  if (!e.isTrusted) return;
  emitDeleteReferredRelationship();
}

const updateRewardDraftItem = (id: AllGameResourceID, count: number) => {
  const limit = getInviteRewardLimit(id)
  const safeCount = Math.min(Math.floor(count), limit)
  if (count <= 0) {
    delete rewardDraft[id]
    return
  }
  rewardDraft[id] = { count: safeCount }
}

const getInviteRewardLimit = (id: AllGameResourceID): number => {
  return INVITE_REWARD_ITEM_LIMITS[id] ?? INVITE_REWARD_DEFAULT_ITEM_LIMIT
}

const availableRewardItems = computed(() => {
  return Object.entries(allGameResource)
    .filter(([_, v]) => !v.isInternal)
    .filter(([id, _]) => {
      if (!inventory.value[id]?.count) {
        return false;
      }

      return true;
    })
    .filter(([_, v]) => {
      if (v.id == 'gold') {
        return true;
      }
      if (v.id == 'cutePoint') {
        return true;
      }
      return !v.hideInMarket && !v.hideInShop
    })
    .map(([id, v]) => ({ id: id as AllGameResourceID, name: v.name }))
})

const confirmed = computed(() => {
  return confirmedInfo.value?.confirmed === true
})

const canDeleteRelationship = computed(() => {
  if (!confirmedInfo.value?.confirmed) return true;

  if (!confirmedInfo.value?.confirmedAt) return true;

  const confirmedAt = confirmedInfo.value.confirmedAt instanceof Date ? confirmedInfo.value.confirmedAt : new Date(confirmedInfo.value.confirmedAt);
  const now = new Date();
  const diffMs = now.getTime() - confirmedAt.getTime();

  const DELETE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
  return diffMs >= DELETE_COOLDOWN_MS;
})

const canAddMoreInviteGift = computed(() => {
  const currentKinds = Object.keys(rewardDraft).length;
  return currentKinds >= INVITE_REWARD_MAX_ITEM_KINDS;
})
</script>