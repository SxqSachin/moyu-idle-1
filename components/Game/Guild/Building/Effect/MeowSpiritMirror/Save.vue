<template>
  <el-text class="self-start!"> 将当前的镜像保存下来吗？ </el-text>
  <div class="flex flex-col gap-1 mt-4">
    <el-text class="self-start!"> 镜像将拥有以下战斗配置: </el-text>
    <el-text class="self-start!"> - 各项属性 </el-text>
    <el-text class="self-start!"> - 装备 </el-text>
    <el-text class="self-start!"> - 技能配置 </el-text>
    <div class="my-1"></div>
    <el-text class="self-start!"> 镜像将不继承以下战斗配置: </el-text>
    <el-text class="self-start!"> - 战斗物品袋 </el-text>
    <div class="my-1"></div>
    <el-text class="self-start!"> 镜像将拥有以下状态: </el-text>
    <el-text class="self-start!"> - 迷雾虚像 </el-text>
  </div>

  <el-divider class="my-3!"></el-divider>

  <div>
    <el-text class="self-start!"> 留一段话 </el-text>
    <el-input class="mt-2!" v-model="note" :maxlength="20" :show-word-limit="true"></el-input>
  </div>

  <div class="mt-4">
    <el-text class="self-start!"> 将消耗： </el-text>
    <GameCommonItemCountInfoIconAndName :item-count-info="MEOW_SPIRIT_MIRROR_SAVE_COST" :show-count="true" :show-inventory-count="true"></GameCommonItemCountInfoIconAndName>
  </div>

  <div class="mt-4">
    <el-button type="primary" :loading="creating" @click="handleCreate">生成镜像</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  emitCreateCharacterPhantomListing,
  onCreateCharacterPhantomListingSuccess,
  onCreateCharacterPhantomListingFail,
} from '~/api/game/socket/characterPhantom'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { ElNotification } from 'element-plus'
import { MEOW_SPIRIT_MIRROR_SAVE_COST } from '~/shared/data/constant';

const props = defineProps<{
  guildUuid?: string | null
}>()

const emits = defineEmits<{
  (e: 'created'): void
  (e: 'cancel'): void
}>()

const creating = ref(false)
const note = ref("")

let offCreateSuccess: Function | undefined
let offCreateFail: Function | undefined

onMounted(async () => {
  await waitUtilConnected()

  offCreateSuccess = onCreateCharacterPhantomListingSuccess(() => {
    creating.value = false
    ElNotification.success({ title: '记录成功' })
    emits('created')
  })

  offCreateFail = onCreateCharacterPhantomListingFail((d) => {
    creating.value = false
    ElNotification.error({ title: '记录失败', message: d.message || 'unknown' })
  })
})

onUnmounted(() => {
  offCreateSuccess?.()
  offCreateFail?.()
})

function handleCreate() {
  creating.value = true
  try {
    emitCreateCharacterPhantomListing({
      // owner: '', // server 会覆盖为当前用户
      guildUuid: props.guildUuid ?? undefined,
      note: note.value,
      // characterUuid: form.value.characterUuid,
      // snapshot: form.value.snapshot || '{}',
      // isPublic: form.value.isPublic,
      // extra: form.value.extra || ''
    })
  } catch (e: any) {
    creating.value = false
    ElNotification.error({ title: '上架失败', message: e?.message || 'unknown' })
  }
}
</script>

<style scoped>
/* tailwind classes used in template */
</style>