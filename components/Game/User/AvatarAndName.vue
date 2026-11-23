<template>
    <div class="inline-flex items-center space-x-3 cursor-pointer" v-if="profile">
        <template v-if="!hideAvatar">
            <GamePlayerProfileAvatar :avatar="profile.avatar ?? ''" :border="profile.style.currentAvatarBorder" :size="avatarSize ?? 42"></GamePlayerProfileAvatar>
        </template>
        <div class="flex flex-col items-start" v-if="!onlyAvatar">
            <span class="font-medium text-gray-700 dark:text-gray-200 player-name whitespace-nowrap">
                <span v-if="ironcat" class="text-xs text-blue-300 dark:text-sky-300">
                    [硬核猫]
                </span>
                <span>
                    {{ specificName ?? profile?.name ?? '加载中' }} {{ nameSuffix }}
                </span>
            </span>
            <span v-if="title && !hideTitle" class="text-xs mt-1 text-gray-400 whitespace-nowrap block max-w-30 player-title truncate"> {{ title }}
            </span>
        </div>
    </div>
    <div v-else>
        <span class="font-medium text-gray-700 dark:text-gray-200 ">{{ '加载中' }}</span>
    </div>
</template>
<script lang="ts" setup>
import { useUserProfileInfo } from '~/composables/game/useUserProfileInfo';
import { allTitles } from '~/shared/data/allTitle';
import { clone } from '~/shared/utils';

const userProfiles = useUserProfileInfo()

const props = defineProps<{
    uuid: string,
    hideAvatar?: boolean
    hideTitle?: boolean

    onlyAvatar?: boolean

    nameSuffix?: string

    avatarSize?: number

    specificName?: string
}>()

const profile = computed(() => {
    return userProfiles.value[props.uuid] || null;
})

const ironcat = computed(() => {
    return profile.value.ironcat
})

onMounted(async () => {
    if (!profile.value) {
        let res = await $fetch("/api/game/user/profile", {
            method: "GET",
            query: {
                uuid: props.uuid
            }
        })
        if (res.code === 200 && 'data' in res) {
            if (res.data.uuid == props.uuid) {
                userProfiles.value[props.uuid] = res.data;
                userProfiles.value = clone(userProfiles.value)
            }
        }
    }
})

const title = computed(() => {
    if (!profile?.value.title) {
        return ''
    }

    let title = allTitles[profile.value.title].name

    return title
})

</script>