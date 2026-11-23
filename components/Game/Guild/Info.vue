<template>

    <div v-if="guild">
        <GameGuildInfoReadonly :guild-uuid="guild.uuid" :guild="guild"></GameGuildInfoReadonly>
    </div>

    <el-divider></el-divider>

    <div>
        <div v-if="isLeader" class="flex items-center mb-4">
            <el-button type="primary" @click="editInfo">
                {{ editing ? '取消编辑' : '编辑信息' }}
            </el-button>
            <el-button type="primary" @click="onDisband">
                解散公会
            </el-button>
        </div>
        <div v-if="!isLeader">
            <el-button type="primary" @click="onLeave">
                离开公会
            </el-button>
        </div>
    </div>


    <el-dialog v-model="editing" width="420px" :close-on-click-modal="false">
        <GameGuildConfig @close="editing = false"></GameGuildConfig>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { emitUpdateGuildInfo, onUpdateGuildInfoSuccess, onUpdateGuildInfoFail, emitDisbandGuild, onDisbandGuildSuccess, onDisbandGuildFail, emitGetMyGuild, emitGetOtherGuildInfo, onGetOtherGuildSuccess, emitLeaveGuild, onLeaveGuildFail, onLeaveGuildSuccess } from '~/api/game/socket/guild'
import { waitUtilConnected } from '~/api/game/socket/socket';
import { allGameActionMainType } from '~/shared/data/allGameActions';
import type { FuncAction } from '~/shared/types';
import type { GameGuild } from '~/shared/types/guild';
import { sanitizeInput } from '~/shared/utils';

const props = defineProps<{
    guildUuid: string
}>()

const guild = ref<GameGuild | null>()

const { user } = useUserSession()
const isLeader = computed(() => !!guild.value && guild.value?.owner === user.value?.uuid)

const editing = ref(false)
const loading = ref(false)

const form = ref({
    name: guild.value?.name ?? "",
    description: guild.value?.description || '',
    type: guild.value?.type || []
})

const editInfo = () => {
    editing.value = true
}

function onDisband() {
    if (!guild.value) return
    if (!isLeader.value) return

    ElMessageBox.confirm(
        '解散公会后，所有成员将被移出，且该操作不可撤销，创建公会时的资源也不会返还。确定要解散公会吗？',
        '解散公会确认',
        {
            confirmButtonText: '确认解散',
            cancelButtonText: '取消',
            type: 'error',
        }
    ).then(() => {
        if (!guild.value) return
        loading.value = true
        emitDisbandGuild(guild.value.uuid)
    }).catch(() => { })
}

function onLeave() {
    if (!guild.value) return

    ElMessageBox.confirm(
        '离开公会后，您将无法再访问公会的所有功能，且该操作不可撤销。确定要离开公会吗？',
        '离开公会确认',
        {
            confirmButtonText: '确认离开',
            cancelButtonText: '取消',
            type: 'warning',
        }
    ).then(() => {
        if (!guild.value) return
        loading.value = true
        emitLeaveGuild(guild.value.uuid)
    }).catch(() => { })
}

let offUpdateSuccess: FuncAction
let offUpdateFail: FuncAction
let offDisbandSuccess: FuncAction
let offDisbandFail: FuncAction
let offGetGuild: FuncAction
let offLeaveSuccess: FuncAction
let offLeaveFail: FuncAction

onMounted(async () => {
    await waitUtilConnected()

    offGetGuild = onGetOtherGuildSuccess((guildData) => {
        guild.value = guildData.guild
    })

    offUpdateSuccess = onUpdateGuildInfoSuccess(() => {
        loading.value = false
        editing.value = false
        // 可选：弹窗提示

        ElNotification({
            title: "公会信息已成功更新！",
            type: "success",
            duration: 1800,
        })

        emitGetOtherGuildInfo(guild.value!.uuid)
    })
    offUpdateFail = onUpdateGuildInfoFail((e) => {
        loading.value = false
        // 可选：弹窗提示

        ElNotification({
            title: "公会信息更新失败:" + e.message,
            type: "error",
            duration: 1800,
        })
    })

    offDisbandSuccess = onDisbandGuildSuccess(() => {
        loading.value = false
        ElNotification({
            title: "公会已成功解散！",
            type: "success",
            duration: 1800,
        })
        // 可选：重定向或刷新页面

        emitGetMyGuild()
    })
    offDisbandFail = onDisbandGuildFail((e) => {
        loading.value = false
        ElNotification({
            title: "公会解散失败，请重试:" + e.message,
            type: "error",
            duration: 1800,
        })
    })

    offLeaveSuccess = onLeaveGuildSuccess(() => {
        loading.value = false
        ElNotification({
            title: "成功离开公会！",
            type: "success",
            duration: 1800,
        })
        // 可选：重定向或刷新页面

        emitGetMyGuild()
    })
    offLeaveFail = onLeaveGuildFail(() => {
        loading.value = false
        ElNotification({
            title: "离开公会失败，请重试。",
            type: "error",
            duration: 1800,
        })
    })

    emitGetOtherGuildInfo(props.guildUuid)
})


// watch(() => guild, (newGuild) => {
//     form.value.name = newGuild.name
//     form.value.description = newGuild.description || ''
//     form.value.type = newGuild.type || ''
// })

onUnmounted(() => {
    offGetGuild?.()
    offUpdateSuccess?.()
    offUpdateFail?.()
    offDisbandSuccess?.()
    offDisbandFail?.()
})
</script>