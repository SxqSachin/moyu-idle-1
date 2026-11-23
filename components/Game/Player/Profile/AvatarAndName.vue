<template>
    <div class="inline-flex items-center space-x-2 cursor-pointer">
        <GamePlayerProfileAvatar :avatar="profile?.avatar ?? avatar ?? ''" :border="profile?.style?.currentAvatarBorder" :size="avatarSize ?? 42"></GamePlayerProfileAvatar>
        <div class="flex flex-col">
            <span class="font-medium text-gray-700 dark:text-gray-200 player-name whitespace-nowrap">{{ profile?.name ?? name ?? '未登录' }}</span>
            <span class="text-xs mt-1 text-gray-400 whitespace-nowrap block truncate max-w-30"> {{ title }} </span>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { allTitles } from '~/shared/data/allTitle';
import type { PlayerProfileInfo } from '~/shared/types/characterInfo';

const props = defineProps<{
    profile?: PlayerProfileInfo

    avatar?: string
    name?: string

    avatarSize?: number
}>()

const title = computed(() => {
    if (!props.profile?.title) {
        return ''
    }

    return allTitles[props.profile.title].name
})

</script>