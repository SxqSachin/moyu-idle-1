<template>
    <div v-if="info">
        {{ info.name }}
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGuildProfileInfo } from '~/composables/game/useGuildProfileInfo';

const guildProfiles = useGuildProfileInfo()

const props = defineProps<{
    uuid: string
    plain?: boolean // 是否为纯文本模式，不显示弹窗
}>();

// // 弹窗相关
// const playerInfoDialogVisible = ref(false);
// const currentSelectPlayerUuid = ref<string | null>(null);

const info = computed(() => {
    return guildProfiles.value[props.uuid] || null;
})

onMounted(async () => {
    if (!info.value) {
        let res = await $fetch("/api/game/guild/profile", {
            method: "GET",
            query: {
                uuid: props.uuid
            }
        })
        if (res.code === 200 && 'data' in res) {
            if (res.data.uuid == props.uuid) {
                guildProfiles.value[props.uuid] = res.data
            }
        }
    }
})
</script>

<style scoped>
/* 可根据需要调整样式 */
</style>