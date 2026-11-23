<template>
  <el-card>
    <div class="flex flex-col items-center justify-center py-12">
      <div class="text-lg text-gray-600 dark:text-gray-300 mb-2">你还没有加入任何公会</div>
      <div class="text-sm text-gray-400 mb-4 text-center">
        猫猫公会是有共同目标的猫猫们的聚集地，是猫猫们团结协作、共同成长的温馨家园。<br>
        你可以申请一片属于自己的天地，从零建造公会建筑，也可以直接加入已经建成的公会！<br>
      </div>

      <div class="text-xs text-gray-400 mb-4 text-center">
        猫猫村临时立了一个公会注册点，用于审核和创建公会喵！<br />
        <br />
        当前公会功能仅作为猫猫们的一个基于爱好的聚集地。
        <br />
        近期会基于猫猫公会扩展更多玩法，欢迎提供意见并持续关注喵！
      </div>

      <el-divider></el-divider>

      <div class="flex flex-col gap-2 items-center">
        <div class="text-sm text-gray-600 text-center dark:text-gray-400 mb-2">
          你可以在筹备好建造公会大厅所需的资源后，自己申请并建造一座公会大厅，并成为此公会的创始喵。
          <br />
          后续会添加公会维护费（相关制度设定中）请合理规划资源喵！
        </div>
        <div class="flex flex-col gap-2 items-center">
          <template v-for="requirement of CREATE_GUILD_RESOURCE_REQUIREMENT" :key="requirement.id">
            <GameCommonResourceIconAndName :resource-id="requirement.id" :count="requirement.count"
              :show-inventory-count="true"></GameCommonResourceIconAndName>
          </template>
        </div>
      </div>

      <el-button class="mt-4" type="primary" @click="dialogVisible = true" :disabled="!canCreateGuild">创建公会</el-button>
    </div>
    <el-dialog v-model="dialogVisible" title="创建公会" width="400px" :close-on-click-modal="false">
      <el-form :model="form" label-width="80px" class="space-y-4">
        <el-form-item label="名称">
          <el-input v-model="form.name" maxlength="16" show-word-limit />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="专精">
          <el-select :multiple="true" v-model="form.type" placeholder="请选择专精">
            <el-option label="生活" value="life" />
            <el-option label="摸鱼" value="idle" />
            <el-option label="战斗" value="battle" />
            <template v-for="mainType of allGameActionMainType">
              <el-option :label="mainType.name" :value="mainType.id">
                <el-icon class="menu-icon">
                  <Icon :name="mainType.icon" class="size-5" mode="css"></Icon>
                </el-icon>
                {{ mainType.name }}
              </el-option>
            </template>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreate" :loading="loading" :disabled="!canCreateGuild">创建</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { emitCreateGuild, onCreateGuildSuccess, onCreateGuildFail, emitGetMyGuild } from '~/api/game/socket/guild'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { useInventory } from '~/composables/game/useInventory'
import { allGameActionMainType } from '~/shared/data/allGameActions'
import { CREATE_GUILD_RESOURCE_REQUIREMENT } from '~/shared/data/constant'
import type { FuncAction } from '~/shared/types'
import { sanitizeInput } from '~/shared/utils'
import { simpleResourceRequirementCheck } from '~/shared/utils/game/requirementCheck'

const emits = defineEmits<{
  (e: 'create-success'): void
}>()

const dialogVisible = ref(false)
const loading = ref(false)
const form = ref({
  name: '',
  description: '',
  type: []
})

let offSuccess: FuncAction | undefined
let offFail: FuncAction | undefined

function resetForm() {
  form.value = { name: '', description: '', type: [] }
}

function onCreate(e: Event) {
  if (!e.isTrusted) return;

  form.value.name = sanitizeInput(form.value.name)

  loading.value = true
  emitCreateGuild(form.value)
}

onMounted(async () => {
  await waitUtilConnected()
  offSuccess = onCreateGuildSuccess(({ guild }) => {
    loading.value = false
    dialogVisible.value = false
    // 可选：弹窗提示

    ElNotification({
      title: '公会创建成功',
      message: `公会 "${guild.name}" 创建成功！`,
      type: 'success',
      duration: 1800,
    })

    resetForm()

    emits('create-success')
  })
  offFail = onCreateGuildFail(({ message }) => {
    loading.value = false
    // 可选：弹窗提示

    ElNotification({
      title: `创建公会失败`,
      message: `${message}`,
      type: 'error',
      duration: 1800,
    })
  })
})

const inventory = useInventory()
const canCreateGuild = computed(() => {
  return simpleResourceRequirementCheck(CREATE_GUILD_RESOURCE_REQUIREMENT, inventory.value)
})

onUnmounted(() => {
  offSuccess?.()
  offFail?.()
})
</script>