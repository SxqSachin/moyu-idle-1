<template>
  <div class="space-y-4">
    <GameUserAvatarAndName :uuid="phantom.owner"></GameUserAvatarAndName>

    <GameBattleBaseBattleUnit :unit="phantom.snapshot" :hide-name="true"></GameBattleBaseBattleUnit>

    <template v-if="phantom.note">
      <el-divider class="my-3! mb-2!"></el-divider>
      <div class="text-xs text-gray-400 dark:text-gray-600">
        {{ phantom.note }}
      </div>
    </template>

    <div class="flex justify-end">
      <el-button type="primary" @click="onBorrowRequested(phantom.uuid)">带走</el-button>
      <el-button @click="$emit('close')">关闭</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  emitCreateCharacterPhantomBorrow,
  onCreateCharacterPhantomBorrowSuccess,
  onCreateCharacterPhantomBorrowFail,
} from '~/api/game/socket/characterPhantom'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { ElNotification } from 'element-plus'
import type { CharacterPhantomListingDTO } from '~/shared/types/characterPhantom';

const props = defineProps<{
  guildUuid: string
  phantom: CharacterPhantomListingDTO
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const listingRef = ref<any>(null)
const filterCharacterUuid = ref('')
const borrowing = ref<string | null>(null)

let offBorrowSuccess: Function | undefined
let offBorrowFail: Function | undefined

onMounted(async () => {
  await waitUtilConnected()

  offBorrowSuccess = onCreateCharacterPhantomBorrowSuccess(() => {
    borrowing.value = null
    ElNotification.success({ title: '租用成功' })
    emit('close')
  })
  offBorrowFail = onCreateCharacterPhantomBorrowFail((d) => {
    borrowing.value = null
    ElNotification.error({ title: '租用失败', message: d.message || 'unknown' })
  })
})

onUnmounted(() => {
  offBorrowSuccess?.()
  offBorrowFail?.()
})

function onBorrowRequested(listingUuid: string) {
  borrowing.value = listingUuid
  try {
    emitCreateCharacterPhantomBorrow({
      phantomUuid: props.phantom.uuid,
      guildUuid: props.guildUuid,
    } as any)
  } catch (e: any) {
    borrowing.value = null
    ElNotification.error({ title: '租用失败', message: e?.message || 'unknown' })
  }
}
</script>

<style scoped></style>