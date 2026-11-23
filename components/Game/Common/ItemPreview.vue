<template>
    <div v-if="previewInfo[resourceId]" class="inline-flex flex-col gap-2 items-start">
        <el-popover placement="top" :width="previewInfo[resource.id].size">
            <template #reference>
                <el-button size="small" type="primary" plain>预览</el-button>
            </template>
            <div>
                <template v-if="previewInfo[resource.id].url">
                    <el-image :src="previewInfo[resource.id].url">
                        <template #placeholder>
                            <div class="image-slot">Loading<span class="dot">...</span></div>
                        </template>
                    </el-image>
                </template>
                <template v-else>
                    <template v-if="previewInfo[resource.id].comp">
                        <component :is="previewInfo[resource.id].comp"></component>
                    </template>
                </template>
            </div>
        </el-popover>
    </div>
</template>

<script setup lang="tsx">
import { allGameResource } from '~/shared/data/allGameResources';
import Avatar from '../Player/Profile/Avatar.vue';
import { usePlayerProfile } from '~/composables/game/usePlayerProfile';

const profile = usePlayerProfile();

const props = defineProps<{
    resourceId: string;
}>();

const resource = computed(() => {
    return allGameResource[props.resourceId];
})


const previewInfo: Record<string, {
    size?: number,
    url?: string,
    comp?: any
}> = {
    sponsorPointResource_avatarAlchemist: {
        size: 128,
        url: '/static/images/preview/avatar_alchemist.gif',
    },
    sponsorPointResource_profileFishing_1: {
        size: 380,
        url: '/static/images/preview/profileFishing_1.png',
    },
    sponsorPointResource_profileNightNinja_1: {
        size: 380,
        url: '/static/images/preview/night_ninja_profile_bg_1.png',
    },
    sponsorPointResource_profileCuteKitty_1: {
        size: 380,
        url: '/static/images/preview/cute_profile_bg_1.png',
    },

    sponsorPointResource_chatBubble_cute_cat_1: { size: 328, url: '/static/images/preview/chatBubble_cute_cat_1.png' },
    sponsorPointResource_chatBubble_cute_cat_2: { size: 328, url: '/static/images/preview/chatBubble_cute_cat_2.png' },
    sponsorPointResource_chatBubble_dark_mag_1: { size: 328, url: '/static/images/preview/chatBubble_dark_mag_1.png' },
    sponsorPointResource_chatBubble_kitty_1: { size: 328, url: '/static/images/preview/chatBubble_kitty_1.png' },
    sponsorPointResource_chatBubble_moon_1: { size: 328, url: '/static/images/preview/chatBubble_moon_1.png' },
    sponsorPointResource_chatBubble_ninja_cat_1: { size: 328, url: '/static/images/preview/chatBubble_ninja_cat_1.png' },
    sponsorPointResource_chatBubble_star_1: { size: 328, url: '/static/images/preview/chatBubble_star_1.png' },

    sponsorPointResource_avatarBorder_kittyHead1: {
        size: 200,
        comp: <div class="p-8"> <Avatar avatar={profile.value.avatar} border='kitty_head_1' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_bunny_1: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='bunny_1' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_ghostBladeNebula:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='ghostBladeNebula' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_cuteParty:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='cuteParty' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_kittyRing2:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='kittyRing2' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_mageKitty1:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='mageKitty1' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_holyPawsGospel:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='holyPawsGospel' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_emberClaw:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='emberClaw' size={128} > </Avatar> </div >
    },

    t_avatarBorder_meowQuest:
    {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='meowQuest' size={128} > </Avatar> </div >
    },

    t_avatarBorder_privateDetective: {

        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='privateDetective' size={128} > </Avatar> </div >
    },

    t_avatarBorder_SpringFestival2026_1: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='SpringFestival2026_1' size={128} > </Avatar> </div >
    },
    t_avatarBorder_SpringFestival2026_12: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='SpringFestival2026_12' size={128} > </Avatar> </div >
    },

    t_avatarBorder_SpringFestivalLuckyCat2026: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='SpringFestivalLuckyCat2026' size={128} > </Avatar> </div >
    },
    t_avatarBorder_SpringFestival2026_LuckyHorseCat: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='SpringFestival2026_LuckyHorseCat' size={128} > </Avatar> </div >
    },
    t_avatarBorder_SpringFestival2026_LuckyHorseCat2: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='SpringFestival2026_LuckyHorseCat2' size={128} > </Avatar> </div >
    },

    t_avatarBorder_catVillageOverseer_1: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='catVillageOverseer_1' size={128} > </Avatar> </div >
    },
    t_avatarBorder_catVillageOverseer_2: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='catVillageOverseer_2' size={128} > </Avatar> </div >
    },

    sponsorPointResource_avatarBorder_slumberCat: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='slumberCat' size={128} > </Avatar> </div >
    },
    sponsorPointResource_avatarBorder_catMercante: {
        size: 200,
        comp: <div class="p-8" > <Avatar avatar={profile.value.avatar} border='catMercante' size={128} > </Avatar> </div >
    }
}
</script>