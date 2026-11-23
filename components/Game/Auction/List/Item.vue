<template>
    <el-card class="cursor-pointer" @click="emit('select', item.uuid)" shadow="hover">
        <div>
            <div class="flex flex-col md:flex-row justify-between">
                <div class="flex flex-col gap-0 md:gap-4">
                    <div>
                        <h3 class="text-xl font-bold flex items-center gap-2">
                            <span> {{ item.metadata?.title ?? "拍卖物品" }} </span>
                            <template v-if="meta.iron_only">
                                <el-tag>仅限硬核喵</el-tag>
                            </template>
                        </h3>

                        <div class="text-sm mt-4">
                            <span> {{ auctionTargetTypeStr }} </span>
                            <span>
                                <template v-if="item.targetType === 'ITEM'">
                                    : <GameCommonResourceIconAndName :resource-id="item.targetId"/>
                                    <div class="my-2"></div>
                                    数量 : <span>{{ item.targetCount ?? 1 }}</span>
                                </template>
                            </span>
                        </div>

                        <div class="block md:hidden text-sm mt-2">
                            <div class="text-sm">状态: {{ auctionStateStr }}</div>
                            <div class="text-sm mt-1">结束于: {{ formatTime(item.endAt) }}</div>
                        </div>

                        <div class="flex md:hidden items-center gap-2 mt-4">
                            <h3 class="text-sm">{{ "发起人" }}</h3>
                            <div class="h-10 flex items-center">
                                <GameUserAvatarAndName :uuid="item.creator" :avatar-size="48"></GameUserAvatarAndName>
                            </div>
                        </div>

                        <el-divider class="block! md:hidden! my-2!"></el-divider>
                    </div>

                    <div class="hidden md:flex items-center gap-2">
                        <h3 class="text-sm">{{ "发起人" }}</h3>
                        <div class="h-10 flex items-center">
                            <GameUserAvatarAndName :uuid="item.creator" :avatar-size="48"></GameUserAvatarAndName>
                        </div>
                    </div>

                </div>
                <div class="hidden md:block text-right">
                    <div class="text-sm">状态</div>
                    <div class="font-bold">{{ auctionStateStr }}</div>
                    <div class="text-xs mt-2">结束于: {{ formatTime(item.endAt) }}</div>
                </div>
            </div>


            <div class="text-sm mt-2 flex flex-col gap-2">
                <div class="flex flex-col md:flex-row gap-2 md:gap-4">
                    <div>
                        <span class="inline-block mr-2">起拍价: </span>
                        <span class="font-bold text-amber-600">{{ formatNumber(item.startPrice) }}</span>
                    </div>
                    <div v-if="item.buyoutPrice">
                        <span class="inline-block mr-2">一口价: </span>
                        <span class="text-green-600 font-bold">{{ formatNumber(item.buyoutPrice) }}</span>
                    </div>
                    <div v-if="item.minIncrement">
                        <span class="inline-block mr-2">最小加价: </span>
                        <span class="text-green-600 font-bold">{{ formatNumber(item.minIncrement) }}</span>
                    </div>
                </div>

                <el-divider class="my-1!"></el-divider>
                <span>当前最高价: </span>
                <div class="flex flex items-center gap-2">
                    <template v-if="item.currentMaxPrice && item.currentMaxPriceUserUuid">
                        <div class="h-10 flex items-center">
                            <GameUserAvatarAndName :uuid="item.currentMaxPriceUserUuid" :avatar-size="48"></GameUserAvatarAndName>
                        </div>
                        <span class="font-bold text-amber-600">{{ formatNumber(item.currentMaxPrice) }}</span>
                    </template>
                    <template v-else="">
                        <span class="font-bold text-amber-600">-</span>
                    </template>
                </div>
            </div>
        </div>
    </el-card>
</template>

<script setup lang="tsx">
import type { AuctionDetailDTO } from '~/shared/types/auction';
import { formatNumber, formatTime, safeJsonParse } from '~/shared/utils';

const emit = defineEmits<{ (e: "select", uuid: string): void }>();

const props = defineProps<{
    item: AuctionDetailDTO;
}>();

const meta = computed(() => {
    return props.item.metadata ?? {}
})

const auctionTargetTypeStr = computed(() => {
    switch(props.item.targetType) {
        case "ITEM":
            return "物品";
        case "TITLE":
            return "头衔";
        case "TEXT":
            return "特殊";
        default:
            return "未知";
    }
})

const auctionStateStr = computed(() => {
    switch(props.item.state) {
        case "OPEN":
            return "进行中";
        case "ENDED":
            return "已结束";
        case "SETTLED":
            return "已结算";
        case "CANCELLED":
            return "已取消";
        default:
            return "未知";
    }
});
</script>