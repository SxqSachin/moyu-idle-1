<template>
    <el-popover placement="top" trigger="hover" :width="200" :show-after="380" popper-class="kitty-info-popover">
        <template #reference>
            <span :class="{
                'font-bold px-2 py-0.5 rounded-sm bg-teal-200 text-teal-600 cursor-pointer': !plain
            }">
                🐱
                {{ kittyInfo?.name || '猫咪' }}
            </span>
        </template>
        <div v-if="kittyInfo" class="flex flex-col items-center">
            <div class="flex items-center gap-2 mb-2">
                🐱
                <span class="text-lg font-bold text-gray-800 dark:text-gray-100">{{ kittyInfo.name || '猫咪' }}</span>
            </div>
            <div class="flex items-center gap-2 mb-2">
                <span>正在：</span>
                <template v-if="!kittyInfo.isWorking">
                    <span>休息</span>
                </template>
                <template v-else>
                    <GameCommonActionNameAndIcon :action-id="kittyInfo.actionId"></GameCommonActionNameAndIcon>
                </template>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1 flex flex-row items-center">
                <span> 照料人： </span>
                <GameUserAvatarAndName :uuid="kittyInfo.owner" @click="showPlayerInfo(kittyInfo.owner)">
                </GameUserAvatarAndName>
            </div>
        </div>
    </el-popover>

    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :append-to-body="true" :show-close="true"
        :close-on-click-modal="true" destroy-on-close>
        <template #header>
            <span>玩家信息</span>
        </template>
        <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useKittyProfileInfo } from '~/composables/game/useKittyProfileInfo';

const kittyProfiles = useKittyProfileInfo()

const props = defineProps<{
    uuid: string
    plain?: boolean // 是否为纯文本模式，不显示弹窗
}>();

// 弹窗相关
const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);

function showPlayerInfo(playerUuid: string) {
    currentSelectPlayerUuid.value = playerUuid;
    playerInfoDialogVisible.value = true;
}

const kittyInfo = computed(() => {
    return kittyProfiles.value[props.uuid] || null;
})

onMounted(async () => {
    if (!kittyInfo.value) {
        let res = await $fetch("/api/game/kitty/profile", {
            method: "GET",
            query: {
                uuid: props.uuid
            }
        })
        if (res.code === 200 && 'data' in res) {
            if (res.data.uuid == props.uuid) {
                kittyProfiles.value[props.uuid] = res.data
            }
        }
    }
})
</script>

<style scoped>
/* 可根据需要调整样式 */
</style>