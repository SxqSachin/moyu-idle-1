<template>
    <el-card class="h-full hover:shadow-md transition-shadow duration-150 cursor-pointer relative" @click="openShopDialog">
        <div v-if="pinnedSet.has(shop.uuid)" class="pin-triangle" aria-hidden="true">
            <span class="pin-text">置顶</span>
        </div>
        <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="flex flex-row items-center gap-2">
                        <span class="font-semibold text-xl truncate" :title="shop.name">{{ shop.name }}</span>
                        <template v-if="shop.owner == user?.uuid">
                            <el-tag type="success" size="small">你的店铺</el-tag>
                        </template>
                    </div>

                    <div class="flex flex-col justify-end items-end">
                        <el-tag size="small" class="w-fit!">{{ shopState }}</el-tag>
                        <div v-if="shop.totalSoldCount">
                            <span class="text-xs text-gray-500 dark:text-gray-400" :title="shop.name">总销量: {{
                                shop.totalSoldCount}}</span>
                        </div>
                    </div>
                </div>

                <div v-if="shop.description">
                    <span class="text-sm text-gray-500 dark:text-gray-400" :title="shop.name">{{ shop.description
                        }}</span>
                </div>

                <div class="mt-3">
                    <GameUserAvatarAndName :uuid="shop.owner"></GameUserAvatarAndName>
                </div>
                <template v-if="shop.sellResource?.length">
                    <div class="flex flex-row flex-wrap items-center mt-2 gap-1">
                        <div class="text-sm text-gray-500">出售:</div>
                        <template v-for="rid in shop.sellResource">
                            <GameCommonResourceIconAndName :resource-id="rid"></GameCommonResourceIconAndName>
                        </template>
                    </div>
                </template>

            </div>
        </div>
    </el-card>

    <el-dialog v-model="showShopDialog" :title="shop.name" @close="showShopDialog = false"
        :width="isMobile ? '100%' : '600px'">

        <div class="flex flex-row items-center mt-2">
            <div class="font-bold text-base">店主：</div>
            <GameUserAvatarAndName :uuid="shop.owner"></GameUserAvatarAndName>
        </div>

        <div v-if="shop.description" class="mt-2">
            <el-text>{{ shop.description }}</el-text>
        </div>

        <el-divider class="my-2!"></el-divider>
        <div class="mb-2">商品信息：</div>

        <div class="grid gap-3 grid-cols-1 md:grid-cols-2">
            <GamePlayerShopItemCard v-for="it in currentItems" :key="it.uuid" :item="it" />
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { usePlayerShop } from "~/composables/game/usePlayerShop";
import type { PlayerShopDTO } from "~/shared/types/playerShop";

const { isMobile } = useDevice();
const { user } = useUserSession()

const props = defineProps<{ shop: PlayerShopDTO; }>();

const {
    currentItems,
    openShop,
    pinnedSet
} = usePlayerShop()

const showShopDialog = ref(false)

const openShopDialog = () => {
    if (props.shop.uuid) {
        openShop(props.shop.uuid);
        showShopDialog.value = true
    }
}

const shopState = computed(() => {
    const map = {
        OPEN: '营业中',
        PAUSED: '已暂停',
        CLOSED: '已关闭',
        EXPIRED: '已过期',
        REMOVED: '已删除',
    }

    return map[props.shop.state] || props.shop.state
})

</script>

<style scoped>
.pin-triangle {
    position: absolute;
    top: 0;
    left: 0;
    width: 40px;
    height: 40px;
    z-index: 20;
    pointer-events: none;
}
.pin-triangle::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-top: 40px solid #ffd54f; /* gold */
    border-right: 40px solid transparent;
}
.pin-text {
    position: absolute;
    top: 36px;
    left: -20px;
    width: 80px;
    display: block;
    text-align: center;
    transform: rotate(-45deg);
    transform-origin: left top;
    color: #39405d;
    font-weight: 700;
    font-size: 11px;
    pointer-events: none;
}
</style>