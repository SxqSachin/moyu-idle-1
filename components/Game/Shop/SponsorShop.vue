<template>
    <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        感谢每一位赞助者对游戏的支持！<br>
        赞助积分可用于兑换珍稀道具、专属装扮等福利。<br>
        快来看看有哪些心仪的奖励吧 (=｀ω´=)

        <div class="gap-1 mt-2">
            <el-text size="small" class="font-bold!">
                在此处购买后会在仓库中加入对应的解锁物品，使用后可解锁对应的样式
            </el-text>
            <br>
            <el-text size="small" class="font-bold!">
                解锁的样式可在右上角“个人信息”->“个性化”中进行修改
            </el-text>
        </div>

        <div class="gap-1 mt-4">
            <el-text class=font-bold!>
                其他服务:
            </el-text>
            <br />
            <el-text size="small" class="font-bold! text-green-600!" v-if="playerProfile.canUseCustomAvatar?.normal">
                您已解锁自定义头像功能，可在“个人信息”中上传自定义头像
            </el-text>
            <el-text size="small" class="font-bold! text-orange-400!" v-else>
                总赞助积分达到 {{ CUSTOM_AVATAR_MIN_SPONSOR_POINTS }} 后，您可以使用自定义头像功能，可在“个人信息”中上传自定义头像
            </el-text>
            <br />
            <!-- <el-text size="small" class="font-bold! text-green-600!"
                v-if="sponsorPoint.max > CUSTOM_SPONSOR_POINT_LEVEL_1 ">
                您现在可以从下列选项中选择一项进行定制：一件以您用户名命名的装备、一个自定义称号、一个自定义个人背景。可以加入我们的QQ群与管理员联系。
                <span class="ml-1 text-xs text-gray-500">（已使用：{{ usage.usedCount }}，可用：{{ usage.available }}）</span>
            </el-text>
            <el-text size="small" class="font-bold! text-orange-300!" v-else>
                总赞助积分达到 {{ CUSTOM_SPONSOR_POINT_LEVEL_1 }} 后，您可以从下列选项中选择一项进行定制：一件以您用户名命名的装备、一个自定义称号、一个自定义个人背景。
                <span class="ml-1 text-xs text-gray-500">（已使用：{{ usage.usedCount }}，可用：{{ usage.available }}）</span>
            </el-text> -->
        </div>
    </div>

    <div class="flex flex-col flex-wrap items-center">
        <div class="mr-auto text-lg font-semibold flex items-center gap-2">
            <span>当前赞助积分：</span>
            <span class="text-yellow-500 text-xl">{{ formatNumber(sponsorPoint.current) }}</span>
        </div>
        <div class="mr-auto text-lg font-semibold flex items-center gap-2">
            <span>历史总赞助积分：</span>
            <span class="text-yellow-500 text-xl">{{ formatNumber(sponsorPoint.max) }}</span>
        </div>
    </div>

    <div class="flex my-2">
        <el-popover placement="bottom" width="280" trigger="click">
            <template #reference>
                <el-button size="small" type="success">赞助积分包兑换</el-button>
            </template>
            <div class="flex flex-col gap-2">
                <div class="text-sm font-medium mb-2">你可以使用<GameCommonResourceIconAndName
                        resource-id="sponsorPointPack"></GameCommonResourceIconAndName>兑换赞助积分</div>


                <div class="mb-4 flex items-center">
                    <span class="whitespace-nowrap">可兑换：</span>
                    <el-input-number v-model="usedSponsorPointPackCount" :min="0"
                        :max="inventoryHasSponsorPointPackCount" :step="1" :step-strictly="true" />
                    <span class="ml-2 text-gray-400">/ {{ inventoryHasSponsorPointPackCount }}</span>

                </div>

                <div>可获得： {{ SPONSOR_POINT_PACK_TO_SPONSOR_POINT_RATE * usedSponsorPointPackCount }} 赞助积分</div>

                <el-popconfirm :title="'确认兑换' + usedSponsorPointPackCount + '个赞助积分包？'" @confirm="useSponsorPointPack">
                    <template #reference>
                        <el-button size="small" type="primary">兑换</el-button>
                    </template>
                </el-popconfirm>
            </div>
        </el-popover>
    </div>

    <el-tabs v-model="currentSponsorShopType">
        <el-tab-pane label="全部" name="all">
        </el-tab-pane>
        <el-tab-pane v-for="kind in allKind" :key="kind" :label="kind" :name="kind">
        </el-tab-pane>
    </el-tabs>

    <ShopGrid :resources="filteredResourceList">
        <template #card="{ resource }">
            <div class="flex flex-col h-full justify-between">
            <div class="flex items-center gap-2">
                <GameCommonResourceIconAndName :resource-id="resource.id"></GameCommonResourceIconAndName>
            </div>

            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <div v-html="(resource.description || '').replace(/\n/g, '<br/>')"></div>
            </div>

            <div class="mt-3">
                <template v-if="cannotBuyBecauseHasUniqueFlag(resource)">
                    <el-text size="small">已拥有</el-text>
                </template>
                <template v-else>
                    <div class="inline-flex flex-row gap-2 items-center mb-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400"> 消耗积分： </span>
                        <span class="text-yellow-500">{{ resource.userBuyCostSponsorPoint }}</span>
                    </div>
                    <div class="flex flex-row flex-wrap gap-2 items-center">
                        <el-button :plain="!canBuyCount(resource, 1)" type="success" size="small"
                            :disabled="!canBuyCount(resource, 1)" @click="buy(resource)" class="mr-2">购买</el-button>

                            <ItemPreview :resource-id="resource.id"></ItemPreview>
                    </div>
                </template>
            </div>
            </div>
        </template>
    </ShopGrid>

    <el-dialog :draggable="true" v-model="showBuyDialog" title="购买" width="350" align-center @closed="onBuyDialogClose">
        <div v-if="buyResourceInfo && buyResourceInfo.userBuyCostSponsorPoint">
            <div class="mb-4">
                <span>购买：</span>
                <GameCommonSimpleResourceIconAndName :resource-id="buyResourceInfo.id">
                </GameCommonSimpleResourceIconAndName>
            </div>
            <div v-if="!buyResourceInfo.maxBuyCount || buyResourceInfo.maxBuyCount > 1" class="mb-4 flex items-center">
                <span class="whitespace-nowrap">数量：</span>
                <el-input-number size="small" controls-position="right" v-model="buyTradeInfo!.count" :min="1"
                    :max="maxBuyCount(buyResourceInfo)" :step="1" :step-strictly="true">
                </el-input-number>
            </div>
            <div>
                <span>消耗积分：</span>
                <div class="inline-flex flex-col gap-2">
                    <span> <span class="text-yellow-500"> {{ buyCost }} </span> 积分 </span>
                </div>
            </div>
            <div>
                <span>购买后剩余：</span>
                <div class="inline-flex flex-col gap-2">
                    <span> <span class="text-yellow-500"> {{ remainSponsorPoint }} </span> 积分 </span>
                </div>
            </div>
            <div v-if="buyTradeInfo?.id">
                <span>库存内现有此物品数量：</span>
                {{ currentBuyItemInventoryCount }}
            </div>
            <div class="my-2" v-if="buyResourceInfo.onUse">
                <div class="text-xs">购买后别忘记在仓库中使用哦～</div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button type="primary" class="w-full"
                    :disabled="!buyResourceInfo || !buyTradeInfo || !buyResourceInfo.userBuyCostSponsorPoint || !canBuyCount(buyResourceInfo, buyTradeInfo.count)"
                    @click="emitBuy()">
                    确认购买
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed } from 'vue'
import { $fetch } from 'ofetch'
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources'
import { type GameResourceTradeEvent, type AllGameResourceID, type GameResource, GameResourceCategory } from '~/shared/types/gameResource'
import { emitShopBuyResource, emitShopSellResource, } from '~/api/game/socket/trade'
import { useSponsorPoint } from '~/composables/game/useSponsorPoint'
import { useUniqueFlag } from '~/composables/game/useUniqueFlag'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { clone, formatNumber } from '~/shared/utils'
import { emitBuyFromSponsorShop, emitExchangeSponsorPointPack, onBuyFromSponsorShopFail, onBuyFromSponsorShopSuccess, onExchangeSponsorPointPackFail, onExchangeSponsorPointPackSuccess } from '~/api/game/socket/shop'
import type { FuncAction } from '~/shared/types'
import { emitGetSponsorPoint } from '~/api/game/socket/sponsorPoint'
import { emitGetAllUniqueFlag } from '~/api/game/socket/uniqueFlag'
import { useInventory } from '~/composables/game/useInventory'
import { GameCommonResourceIconAndName } from '#components'
import ShopGrid from './ShopGrid.vue'
import { usePlayerProfile } from '~/composables/game/usePlayerProfile'
import { CUSTOM_AVATAR_MIN_SPONSOR_POINTS, CUSTOM_SPONSOR_POINT_LEVEL_1, SPONSOR_POINT_PACK_TO_SPONSOR_POINT_RATE } from '~/shared/data/constant'
import Avatar from '../Player/Profile/Avatar.vue'
import ItemPreview from '../Common/ItemPreview.vue'

const showBuyDialog = ref(false)
const buyTradeInfo = ref<GameResourceTradeEvent>()
const buyResourceInfo = ref<GameResource>()

const currentSponsorShopType = ref<string>('all');

const playerProfile = usePlayerProfile();
const inventory = useInventory();

// 兑换数量
const usedSponsorPointPackCount = ref(0);
const inventoryHasSponsorPointPackCount = computed(() => {
    return inventory.value['sponsorPointPack']?.count || 0;
});
const useSponsorPointPack = () => {
    if (usedSponsorPointPackCount.value <= 0) {
        ElNotification({
            title: '兑换数量必须大于0',
            type: 'warning',
        });
        return;
    }

    if (!usedSponsorPointPackCount.value || !Number.isInteger(usedSponsorPointPackCount.value)) {
        ElNotification({
            title: '兑换数量必须为整数',
            type: 'warning',
        });
        return;
    }

    if (usedSponsorPointPackCount.value > inventoryHasSponsorPointPackCount.value) {
        ElNotification({
            title: '兑换数量超过库存',
            type: 'warning',
        });
        return;
    }

    emitExchangeSponsorPointPack(usedSponsorPointPackCount.value);

    usedSponsorPointPackCount.value = 0;
};

const { isMobile } = useDevice();

const profile = usePlayerProfile();

const currentBuyItemInventoryCount = computed(() => {
    if (!buyTradeInfo.value?.id) return 0;
    return inventory.value[buyTradeInfo.value.id]?.count || 0;
})

const sponsorPoint = useSponsorPoint()
// Service usage state
const usage = ref<{ usedCount: number, available: number, lastUsedAt: string | null }>({ usedCount: 0, available: 0, lastUsedAt: null })
const SERVICE_KEY = 'custom_service_level_1'
const loadUsage = async () => {
    const res = await $fetch('/api/game/sponsor/service-usage', { method: 'GET', query: { serviceKey: SERVICE_KEY } }) as any
    if (res?.ok) {
        usage.value = res.data
    }
}
// 仅展示数据，无“确认使用”逻辑
const uniqueFlag = useUniqueFlag()

const resourceList = computed(() => {
    const allResource = Object.values(allGameResource)

    return allResource.filter(resource => {
        return !!resource.userBuyCostSponsorPoint
    })
})

const filteredResourceList = computed(() => {
    if (currentSponsorShopType.value === 'all') {
        return resourceList.value
    }
    return resourceList.value.filter(i => i.sponsorShopKind === currentSponsorShopType.value);
})

function canBuyCount(resource: GameResource | undefined, count?: number) {
    if (!resource?.userBuyCostSponsorPoint || !count) return false


    if (cannotBuyBecauseHasUniqueFlag(resource)) {
        return false
    }

    if (resource.maxBuyCount) {
        return resource.maxBuyCount <= Math.floor(sponsorPoint.value.current / resource.userBuyCostSponsorPoint);
    }

    return resource.userBuyCostSponsorPoint * count <= sponsorPoint.value.current
}

function maxBuyCount(resource: GameResource | undefined) {
    if (!resource?.userBuyCostSponsorPoint) return 0

    if (cannotBuyBecauseHasUniqueFlag(resource)) {
        return 0
    }

    if (resource.maxBuyCount) {
        return Math.min(resource.maxBuyCount, Math.floor(sponsorPoint.value.current / resource.userBuyCostSponsorPoint))
    }

    return Math.floor(sponsorPoint.value.current / resource.userBuyCostSponsorPoint)
}

// 是否因为已经存在唯一标记，而无法进行购买
function cannotBuyBecauseHasUniqueFlag(resource: GameResource) {
    if (!resource?.uniqueFlagCheckWhenBuy) return false;

    for (const check of resource.uniqueFlagCheckWhenBuy) {
        const hasFlag = uniqueFlag.value.some(flag => flag.type === check.data.type && flag.key === check.data.key);

        if ((check.condition === 'has' && !hasFlag) || (check.condition === 'not_has' && hasFlag)) {
            return true;
        }
    }

    return false
}

const buyCost = computed(() => {
    if (!buyResourceInfo.value) return 0
    if (!buyResourceInfo.value.userBuyCostSponsorPoint) return 0
    return buyResourceInfo.value.userBuyCostSponsorPoint * (buyTradeInfo.value?.count || 1)
})

const remainSponsorPoint = computed(() => {
    return sponsorPoint.value.current - buyCost.value
})

function buy(resource: GameResource) {
    showBuyDialog.value = true
    buyResourceInfo.value = resource
    buyTradeInfo.value = {
        id: resource.id,
        count: 1
    }
}

function emitBuy() {
    showBuyDialog.value = false
    if (!buyResourceInfo.value || !buyTradeInfo.value) {
        return
    }

    emitBuyFromSponsorShop({
        id: buyResourceInfo.value.id,
        count: buyTradeInfo.value.count
    })
}
function onBuyDialogClose() {
    buyResourceInfo.value = undefined
    buyTradeInfo.value = undefined
}

const allKind = computed(() => {
    return new Set(Object.values(resourceList.value).map(r => r.sponsorShopKind).filter(v => !!v))
})


let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
onMounted(async () => {
    await waitUtilConnected()
    await loadUsage()

    off1 = onBuyFromSponsorShopSuccess((data) => {
        showBuyDialog.value = false
        buyTradeInfo.value = undefined
        buyResourceInfo.value = undefined
        ElNotification({
            title: '购买成功',
            type: 'success',
        })

        emitGetSponsorPoint();
        emitGetAllUniqueFlag();
    })
    off2 = onBuyFromSponsorShopFail((data) => {
        showBuyDialog.value = false
        buyTradeInfo.value = undefined
        buyResourceInfo.value = undefined
        ElNotification({
            title: '购买失败',
            type: 'error',
            message: data.message,
        })
    })

    off3 = onExchangeSponsorPointPackSuccess(() => {
        ElNotification({
            title: '兑换成功',
            type: 'success',
        })
    });

    off4 = onExchangeSponsorPointPackFail((data) => {
        ElNotification({
            title: '兑换失败',
            type: 'error',
            message: data.message,
        })
    });
})

onUnmounted(() => {
    off1?.()
    off2?.()
    off3?.()
    off4?.()
})

</script>

<style scoped>
/* 可根据需要添加自定义样式 */
</style>