<template>
  <div class="flex flex-col gap-2 items-center w-full">
    <el-popconfirm title="获得“精力充沛“" @confirm="trigger" width="200">
      <template #reference>
        <el-button type="primary" class="flex-1 text-center">获得“精力充沛“</el-button>
      </template>
    </el-popconfirm>
    <el-popconfirm title="获得“精力充沛(生命)”" @confirm="triggerGetHpRegen" width="200">
      <template #reference>
        <el-button type="primary" class="flex-1 text-center">获得“精力充沛(生命)”<span>30%效果提升</span></el-button>
      </template>
    </el-popconfirm>
    <el-popconfirm title="获得“精力充沛(魔法)”" @confirm="triggerGetMpRegen" width="200">
      <template #reference>
        <el-button type="primary" class="flex-1 text-center">获得“精力充沛(魔法)”<span>30%效果提升</span></el-button>
      </template>
    </el-popconfirm>
  </div>
</template>

<script setup lang="tsx">
import { emitGetVitalityCatStatueEffect, onGetVitalityCatStatueEffectFail, onGetVitalityCatStatueEffectSuccess } from '~/api/game/socket/guildBuildingEffect';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';

const props = defineProps<{
  guildUuid: string;
}>();

let off1: FuncAction;
let off2: FuncAction;
onMounted(async () => {
    await waitUtilConnected();

    off1 = onGetVitalityCatStatueEffectSuccess((data) => {
        ElNotification.success({
            title: "操作成功",
            message: '玩儿的很开心',
        });
    });

    off2 = onGetVitalityCatStatueEffectFail((data) => {
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

const trigger = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetVitalityCatStatueEffect(props.guildUuid, 'all')
}
const triggerGetHpRegen = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetVitalityCatStatueEffect(props.guildUuid, 'hp')
}
const triggerGetMpRegen = async (e: Event) => {
  if (!e.isTrusted) return;

  emitGetVitalityCatStatueEffect(props.guildUuid, 'mp')
}
</script>