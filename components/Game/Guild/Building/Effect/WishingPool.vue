<template>
    <el-button type="primary" @click="triggerWishingPoolEffect">许愿</el-button>
</template>

<script setup lang="tsx">
import { emitGetWishingPoolEffect, onGetWishingPoolEffectFail, onGetWishingPoolEffectSuccess } from '~/api/game/socket/guildBuildingEffect';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';

const props = defineProps<{
  guildUuid: string;
}>();

let off1: FuncAction;
let off2: FuncAction;
onMounted(async () => {
    await waitUtilConnected();

    off1 = onGetWishingPoolEffectSuccess((data) => {
        ElNotification.success({
            title: "许愿成功",
            message: `本次许愿获得了 ${data.luck} 点幸运值`//，奖励：${data.rewardInfo.count} 个 ${data.rewardInfo.itemName}`
        });
    });

    off2 = onGetWishingPoolEffectFail((data) => {
        ElNotification.error({
            title: "许愿失败",
            message: data.message || "许愿失败，请稍后再试"
        });
    });
})
onUnmounted(() => {
    off1?.();
    off2?.();
})

const triggerWishingPoolEffect = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetWishingPoolEffect(props.guildUuid)
}
</script>