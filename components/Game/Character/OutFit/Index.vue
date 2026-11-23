<template>
  <el-tabs v-model="activeTab" class="mb-4">
    <el-tab-pane label="工作套装" name="work">
      <div class="flex flex-wrap gap-4">
        <el-card v-for="outfit in allWorkOutfit" :key="outfit.uuid" class="w-72" shadow="hover">
          <div class="flex flex-col justify-between items-center mb-4 space-y-2">
            <div class="font-bold text-lg">{{ outfit.name }}</div>
            <div>
              <el-button type="success" size="small" :disabled="applyDisabled" @click="e => handleApplyOutfit(e, outfit)">应用</el-button>
              <el-button type="primary" size="small" @click="showEditDialog(outfit)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDeleteOutfit(outfit)">删除</el-button>
            </div>
          </div>

          <el-divider class="my-2!"></el-divider>

          <GameCharacterOutFitSuit :readonly="true" v-if="outfit" :outfit="outfit"></GameCharacterOutFitSuit>

        </el-card>
        <div class="w-72 min-h-16 md:min-h-32 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-300"
          @click="showAddDialog('work')">
          <el-icon>
            <Plus />
          </el-icon>
          <span class="ml-2">添加新套装</span>
        </div>
      </div>
    </el-tab-pane>
    <el-tab-pane label="战斗套装" name="battle">
      <div class="flex flex-wrap gap-4">
        <el-card v-for="outfit in allBattleOutfit" :key="outfit.uuid" class="w-72" shadow="hover">
          <div class="flex flex-col justify-between items-center mb-4 space-y-2">
            <div class="font-bold text-lg">{{ outfit.name }}</div>
            <div>
              <el-button type="success" size="small" :disabled="applyDisabled || !canApplyBattleOutfit" @click="e => handleApplyOutfit(e, outfit)">应用</el-button>
              <el-button type="primary" size="small" @click="showEditDialog(outfit)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDeleteOutfit(outfit)">删除</el-button>
            </div>
          </div>

          <el-divider class="my-2!"></el-divider>

          <GameCharacterOutFitSuit :readonly="true" v-if="outfit" :outfit="outfit"></GameCharacterOutFitSuit>

        </el-card>
        <div class="w-72 min-h-16 md:min-h-32 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-300"
          @click="showAddDialog('battle')">
          <el-icon>
            <Plus />
          </el-icon>
          <span class="ml-2">添加新套装</span>
        </div>
      </div>
    </el-tab-pane>
    <el-tab-pane :lazy="true" label="技能" name="skill">
      <GameCharacterOutFitSkillOutfit></GameCharacterOutFitSkillOutfit>
    </el-tab-pane>
  </el-tabs>

  <!-- 新建套装弹窗 -->
  <el-dialog v-model="addDialogVisible" title="添加套装" width="340px">
    <el-form :model="addForm" label-width="80px">
      <el-form-item label="套装名称">
        <el-input v-model="addForm.name" maxlength="12" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="addForm.type" disabled>
          <el-option label="工作" value="work" />
          <el-option label="战斗" value="battle" />
        </el-select>
      </el-form-item>
      <!-- <el-form-item label="工作类型" v-if="addForm.type == 'work'">
        <el-select v-model="addForm.actionType" multiple clearable filterable>
          <template v-for="action in allGameActionMainType" :key="action.id">
            <el-option :label="action.name" :value="action.id" />
          </template>
        </el-select>
      </el-form-item> -->
    </el-form>
    <template #footer>
      <el-button @click="addDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleAddOutfit">保存</el-button>
    </template>
  </el-dialog>

  <!-- 编辑套装弹窗 -->
  <el-dialog v-model="editDialogVisible" title="编辑套装" width="340px">
    <el-form :model="editForm" label-width="80px">
      <el-form-item label="套装名称">
        <el-input v-model="editForm.name" maxlength="12" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="editForm.type" disabled>
          <el-option label="工作" value="work" />
          <el-option label="战斗" value="battle" />
        </el-select>
      </el-form-item>
      <!-- <el-form-item label="工作类型" v-if="editForm.type == 'work'">
        <el-select v-model="editForm.actionType" multiple clearable filterable>
          <template v-for="action in allGameActionMainType" :key="action.id">
            <el-option :label="action.name" :value="action.id" />
          </template>
        </el-select>
      </el-form-item> -->
      <GameCharacterOutFitSuit v-if="editOutfit" :outfit="editOutfit"></GameCharacterOutFitSuit>
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleEditOutfit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { emitGetAllOutfits, emitCreateOutfit, emitUpdateOutfit, onGetAllOutfitsSuccess, onCreateOutfitSuccess, onUpdateOutfitSuccess, onCreateOutfitFail, onUpdateOutfitFail, emitDeleteOutfit, emitApplyOutfit, onDeleteOutfitSuccess, onDeleteOutfitFail, onApplyOutfitSuccess, onApplyOutfitFail } from '~/api/game/socket/outfit'
import type { CharacterEquipmentOutfitInGame, CharacterEquipmentType } from '~/shared/types/characterInfo'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'
import { useBattleInfo } from '~/composables/game/useBattleInfo'
import { useCurrentBattleRoom } from '~/composables/game/useCurrentBattleRoom'
import { allGameAction, allGameActionMainType } from '~/shared/data/allGameActions'

const activeTab = ref<'work' | 'battle'>('work')
const allWorkOutfit = ref<CharacterEquipmentOutfitInGame[]>([])
const allBattleOutfit = ref<CharacterEquipmentOutfitInGame[]>([])

const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const addForm = ref<Partial<CharacterEquipmentOutfitInGame>>({ type: 'work', name: '' })
const editForm = ref<Partial<CharacterEquipmentOutfitInGame>>({})
const applyDisabled = ref(false)

const battleInfo = useBattleInfo()
const room = useCurrentBattleRoom()

const canApplyBattleOutfit = computed(() => {
  if (room.value && room.value?.status != 'waiting') {
    return false
  }

  return !battleInfo.value?.battleStatus;
});

let editOutfit = ref<CharacterEquipmentOutfitInGame>()

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction
let off6: FuncAction
let off7: FuncAction
let off8: FuncAction
let off9: FuncAction

onMounted(async () => {
  await waitUtilConnected()
  off1 = onGetAllOutfitsSuccess(data => {
    allWorkOutfit.value = []
    allBattleOutfit.value = []
    for (const outfit of data.outfits) {
      if (outfit.type === 'battle') {
        allBattleOutfit.value.push(outfit)
      } else {
        allWorkOutfit.value.push(outfit)
      }
    }
  })
  off2 = onCreateOutfitSuccess(() => {
    ElNotification({
      title: '创建成功',
      message: '新配装已创建',
      type: 'success',
    })
    addDialogVisible.value = false
    emitGetAllOutfits()
  })
  off3 = onCreateOutfitFail((data) => {
    ElNotification({
      title: '创建失败',
      message: data.message,
      type: 'error',
    })
  })
  off4 = onUpdateOutfitSuccess(() => {
    ElNotification({
      title: '修改成功',
      message: '配装已更新',
      type: 'success',
    })

    editDialogVisible.value = false
    emitGetAllOutfits()
  })
  off5 = onUpdateOutfitFail((data) => {
    ElNotification({
      title: '修改失败',
      message: data.message,
      type: 'error',
    })
  })

  off6 = onDeleteOutfitSuccess(() => {
    ElNotification({
      title: '删除成功',
      message: '配装已删除',
      type: 'success',
    })
    emitGetAllOutfits()
  })
  off7 = onDeleteOutfitFail((data) => {
    ElNotification({
      title: '删除失败',
      message: data.message,
      type: 'error',
    })
  })

  off8 = onApplyOutfitSuccess(() => {
    ElNotification({
      title: '应用成功',
      message: '配装已应用',
      type: 'success',
    })

    setTimeout(() => {
      applyDisabled.value = false
    }, 1380)
  })
  off9 = onApplyOutfitFail((data) => {
    ElNotification({
      title: '应用失败',
      message: data.message,
      type: 'error',
    })

    setTimeout(() => {
      applyDisabled.value = false
    }, 1380)
  })

  emitGetAllOutfits()
})

onUnmounted(() => {
    off1?.()
    off2?.()
    off3?.()
    off4?.()
    off5?.()
    off6?.()
    off7?.()
    off8?.()
    off9?.()
})

function showAddDialog(type: CharacterEquipmentType) {
  addForm.value = { type, name: '' }
  addDialogVisible.value = true
}

function showEditDialog(outfit: CharacterEquipmentOutfitInGame) {
  editForm.value = { ...outfit }
  editOutfit.value = outfit
  editDialogVisible.value = true
}

function handleAddOutfit() {
  if (!addForm.value.name) {
    ElMessage.error('请输入套装名称')
    return
  }
  if (addForm.value.name.length > 12) {
    ElMessage.error('套装名称最多12个字')
    return
  }

  if (!addForm.value.actionType) {
    addForm.value.actionType = []
  }

  emitCreateOutfit(addForm.value.name!, addForm.value.type as CharacterEquipmentType, {}, addForm.value.actionType)
}

function handleEditOutfit() {
  if (!editForm.value.name) {
    ElMessage.error('请输入套装名称')
    return
  }
  if (editForm.value.name.length > 12) {
    ElMessage.error('套装名称最多12个字')
    return
  }
  if (editOutfit.value?.uuid) {
    editOutfit.value.name = editForm.value.name!

    if (!editForm.value.actionType) {
      editForm.value.actionType = []
    }

    emitUpdateOutfit(editOutfit.value.uuid, editOutfit.value, editForm.value.actionType)
  }
}

function handleApplyOutfit(e: Event, outfit: CharacterEquipmentOutfitInGame) {
  if (!e.isTrusted) return;

  applyDisabled.value = true
  emitApplyOutfit(outfit.uuid, outfit.type)
  // ElMessage.success('应用套装成功')
}

function handleDeleteOutfit(outfit: CharacterEquipmentOutfitInGame) {
  ElMessageBox({
    title: '删除配装',
    message: "确定删除此配装吗？",
    showCancelButton: true,
    confirmButtonText: '离开',
    cancelButtonText: '取消',
  }).then((action) => {
    emitDeleteOutfit(outfit.uuid)
  })
}
</script>