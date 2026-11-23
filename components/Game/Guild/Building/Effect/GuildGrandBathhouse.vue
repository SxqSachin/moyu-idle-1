<template>
  <div class="flex flex-col gap-2 items-center w-full">
    <el-popconfirm title="选择获得生活增益，每8小时只能进行1次选择。" @confirm="triggerWork" width="200">
      <template #reference>
        <el-button type="primary" class="flex-1 text-center">洗个热水澡</el-button>
      </template>
    </el-popconfirm>
    <el-popconfirm title="选择获得战斗增益，每8小时只能进行1次选择。" @confirm="triggerBattle" width="200">
      <template #reference>
        <el-button type="primary" class="flex-1 text-center ml-0!">洗个冷水澡</el-button>
      </template>
    </el-popconfirm>
  </div>
</template>

<script setup lang="tsx">
import { emitGetGuildGrandBathhouseEffect, onGetGuildGrandBathhouseEffectFail, onGetGuildGrandBathhouseEffectSuccess } from '~/api/game/socket/guildBuildingEffect';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';

const props = defineProps<{
  guildUuid: string;
}>();

let off1: FuncAction;
let off2: FuncAction;
onMounted(async () => {
    await waitUtilConnected();

    off1 = onGetGuildGrandBathhouseEffectSuccess((data) => {
        ElNotification.success({
            title: "操作成功",
            message: '洗了个澡，感觉焕然一新！',
        });
    });

    off2 = onGetGuildGrandBathhouseEffectFail((data) => {
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

const triggerWork = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetGuildGrandBathhouseEffect(props.guildUuid, 'work')
}
const triggerBattle = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetGuildGrandBathhouseEffect(props.guildUuid, 'battle')
}
</script>