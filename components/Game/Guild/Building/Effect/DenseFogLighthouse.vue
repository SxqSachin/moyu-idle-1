<template>
  <div class="flex flex-col gap-2 items-center w-full">
    <el-popconfirm title="使用激进策略" @confirm="triggerA">
      <template #reference>
        <el-button type="primary" class="ml-0! flex-1 text-center">采用“激进策略“</el-button>
      </template>
    </el-popconfirm>
    <el-popconfirm title="使用稳健策略" @confirm="triggerB">
      <template #reference>
        <el-button type="primary" class="ml-0! flex-1 text-center">采用“稳健策略“</el-button>
      </template>
    </el-popconfirm>
    <el-popconfirm title="独自前行？" @confirm="triggerC">
      <template #reference>
        <el-button type="primary" class="ml-0! flex-1 text-center">“独自前行”</el-button>
      </template>
    </el-popconfirm>
  </div>
</template>

<script setup lang="tsx">
import { emitGetDenseFogLighthouseEffect, onGetDenseFogLighthouseEffectFail, onGetDenseFogLighthouseEffectSuccess } from '~/api/game/socket/guildBuildingEffect';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';

const props = defineProps<{
  guildUuid: string;
}>();

let off1: FuncAction;
let off2: FuncAction;
onMounted(async () => {
    await waitUtilConnected();

    off1 = onGetDenseFogLighthouseEffectSuccess((data) => {
        ElNotification.success({
            title: "操作成功",
            message: '你已受到指引',
        });
    });

    off2 = onGetDenseFogLighthouseEffectFail((data) => {
        ElNotification.error({
            title: "操作失败",
            message: data.message || "操作失败，请稍后再试"
        });
    });
})
onUnmounted(() => {
    off1?.();
    off2?.();
})

const triggerA = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetDenseFogLighthouseEffect(props.guildUuid, 'aggressive')
}
const triggerB = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetDenseFogLighthouseEffect(props.guildUuid, 'conservative')
}

const triggerC = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetDenseFogLighthouseEffect(props.guildUuid, 'alone')
}
</script>