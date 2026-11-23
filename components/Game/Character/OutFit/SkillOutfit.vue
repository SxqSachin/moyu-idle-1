<template>
    <div class="flex flex-wrap gap-4">
        <el-card v-for="outfit in skillOutfit" :key="outfit.uuid" class="w-56" shadow="hover">
            <div class="flex flex-col justify-between items-center mb-4 space-y-2">
                <div class="font-bold text-lg overflow-hidden text-ellipsis whitespace-nowrap break-keep w-48">{{ outfit.name }}</div>
                <div>
                    <el-button type="success" size="small" :disabled="applyDisabled || !canApplyBattleOutfit"
                        @click="e => handleApplySkillOutfit(e, outfit)">应用</el-button>
                    <!-- <el-button type="primary" size="small" @click="showEditDialog(outfit)">编辑</el-button> -->
                    <el-button type="danger" size="small" @click="handleDeleteSkillOutfit(outfit)">删除</el-button>
                </div>
            </div>

            <el-divider class="my-2!"></el-divider>

            <GameCharacterOutFitSkill :readonly="true" v-if="outfit" :outfit="outfit"></GameCharacterOutFitSkill>

        </el-card>
    </div>
</template>

<script setup lang="ts">
import { emitApplySkillOutfit, emitDeleteSkillOutfit, emitGetAllSkillOutfit, onApplySkillOutfitFail, onApplySkillOutfitSuccess, onDeleteSkillOutfitFail, onDeleteSkillOutfitSuccess, onGetAllSkillOutfitFail, onGetAllSkillOutfitSuccess } from '~/api/game/socket/outfit'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { useBattleInfo } from '~/composables/game/useBattleInfo'
import { useCurrentBattleRoom } from '~/composables/game/useCurrentBattleRoom'
import type { FuncAction } from '~/shared/types'
import type { CharacterSkillOutFitInGame } from '~/shared/types/characterInfo'

const skillOutfit = ref<CharacterSkillOutFitInGame[]>([])

const editDialogVisible = ref(false)
const editForm = ref<Partial<CharacterSkillOutFitInGame>>({})
const editOutfit = ref<CharacterSkillOutFitInGame | null>(null)
const applyDisabled = ref(false)

const battleInfo = useBattleInfo()
const room = useCurrentBattleRoom()

const canApplyBattleOutfit = computed(() => {
  if (room.value && room.value?.status != 'waiting') {
    return false
  }

  return !battleInfo.value?.battleStatus;
});

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction
let off6: FuncAction

onMounted(async () => {
    await waitUtilConnected()

    off1 = onGetAllSkillOutfitSuccess((data) => {
        skillOutfit.value = data.outfits
    })
    off2 = onGetAllSkillOutfitFail((data) => {
        ElNotification({
            title: '获取技能配装失败',
            message: data.message,
            type: 'error',
        })
    })

    off3 = onApplySkillOutfitSuccess((data) => {
        ElNotification({
            title: '应用技能配装成功',
            message: '技能配装已应用',
            type: 'success',
        })
        applyDisabled.value = false
    })
    off4 = onApplySkillOutfitFail((data) => {
        ElNotification({
            title: '应用技能配装失败',
            message: data.message,
            type: 'error',
        })
        applyDisabled.value = false
    })

    off5 = onDeleteSkillOutfitSuccess((data) => {
        skillOutfit.value = data.outfit
        ElNotification({
            title: '删除技能配装成功',
            message: '技能配装已删除',
            type: 'success',
        })
    })
    off6 = onDeleteSkillOutfitFail((data) => {
        ElNotification({
            title: '删除技能配装失败',
            message: data.message,
            type: 'error',
        })
    })

    emitGetAllSkillOutfit()
})

onUnmounted(() => {
    off1?.()
    off2?.()
    off3?.()
    off4?.()
    off5?.()
    off6?.()
})

function showEditDialog(outfit: CharacterSkillOutFitInGame) {
  editForm.value = { ...outfit }
  editOutfit.value = outfit
  editDialogVisible.value = true
}

function handleEditSkillOutfit() {
    if (!editForm.value.name) {
        ElMessage.error('请输入技能方案名称')
        return
    }
    if (editForm.value.name.length > 12) {
        ElMessage.error('技能方案名称最多12个字')
        return
    }
    if (editOutfit.value?.uuid) {
        editOutfit.value.name = editForm.value.name!
        // emitUpdateOutfit(editOutfit.value.uuid, editOutfit.value)
    }
}

function handleApplySkillOutfit(e: Event, outfit: CharacterSkillOutFitInGame) {
    if (!e.isTrusted) return;

    applyDisabled.value = true
    emitApplySkillOutfit(outfit.uuid)
}

function handleDeleteSkillOutfit(outfit: CharacterSkillOutFitInGame) {
    ElMessageBox({
        title: '删除技能配置',
        message: "确定删除此技能配置吗？",
        showCancelButton: true,
        confirmButtonText: '离开',
        cancelButtonText: '取消',
    }).then((action) => {
        emitDeleteSkillOutfit(outfit.uuid)
    })
}
</script>