<template>
  <el-card class="w-full max-w-md mx-auto mt-8 shadow-lg">
    <div class="flex flex-col items-center space-y-4">
      <GameUserAvatarAndName :uuid="user!.uuid" :only-avatar="true" :avatar-size="96"></GameUserAvatarAndName>

      <div class="text-xl font-semibold">{{ profile?.name || '未设置昵称' }}</div>
      <div class="text-sm font-semibold">{{ title }}</div>
      <div class="text-gray-500 text-sm">
        创建时间：{{ profile?.createDate ? formatTime(profile.createDate) : '未知' }}
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";
import { formatTime } from "~/shared/utils";
import { computed } from "vue";

import { allTitles } from "~/shared/data/allTitle";

const { user } = useUserSession()

const props = defineProps<{
  profile: PlayerProfileInfo
}>()

const avatarUrl = computed(() => {
  const key = props.profile.avatar as keyof typeof avatarMap;
  return key && avatarMap[key] ? avatarMap[key] : avatarMap['avatar_1.png'];
});

const titleId = computed(() => {
  return props.profile.availableTitle
})
const title = computed(() => {
  const selectedTitleId = props.profile.title ?? '' as keyof typeof allTitles

  // @ts-ignore
  return allTitles?.[selectedTitleId]?.name as string
})
</script>