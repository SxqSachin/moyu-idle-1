<template>
  <div v-if="guild" class="flex flex-col items-center py-4">
    <div class="text-2xl font-bold text-gray-800 mb-2 text-center">{{ guild.name }}</div>
    <div class="text-gray-500 text-center mb-4 w-full break-words px-2">
      {{ guild.description || '暂无简介' }}
    </div>
    <div class="flex gap-2">
      <template v-for="type of guild.type" :key="type">
      <el-tag type="success">
        {{ map[type] }}
      </el-tag>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { emitGetOtherGuildInfo, onGetOtherGuildSuccess } from '~/api/game/socket/guild';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { allGameActionMainType } from '~/shared/data/allGameActions';
import type { FuncAction } from '~/shared/types';
import type { GameGuild } from '~/shared/types/guild';
import { ObjectKeys } from '~/shared/utils';

const props = defineProps<{
    guildUuid: string
    guild?: GameGuild
}>()

let map = computed(() => {
  let base: {[key: string]: string} = {
    life: '生活',
    idle: '摸鱼',
    battle: '战斗',
  }

  ObjectKeys<keyof typeof allGameActionMainType>(allGameActionMainType).forEach(key => {
    base[key] = allGameActionMainType[key].name
  })

  return base
})

const guild = ref<GameGuild | null>(props?.guild ? props.guild : null)

let offGetGuild: FuncAction

onMounted(async () => {
    await waitUtilConnected()

    offGetGuild = onGetOtherGuildSuccess((guildData) => {
        guild.value = guildData.guild
    })

    if (!props.guild) {
        emitGetOtherGuildInfo(props.guildUuid)
    }
})

onUnmounted(() => {
    offGetGuild?.()
})
</script>