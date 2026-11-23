<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <el-button @click="refreshList">刷新</el-button>
      </div>
    </div>

    <ListingList
      ref="listingRef"
      :guildUuid="guildUuid"
      @borrow="openBorrowFor"
      @cancel="handleCancel"
    />

    <!-- Borrow Dialog -->
    <el-dialog v-model="showBorrowDialog" title="带走这张照片?" width="420" :destroy-on-close="true">
      <Borrow v-if="borrowPhantom" :guildUuid="guildUuid" :phantom="borrowPhantom" @close="closeBorrow" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Borrow from './Borrow.vue'
import ListingList from './ListingList.vue'
import { emitCancelCharacterPhantomListing, onCancelCharacterPhantomListingFail, onCancelCharacterPhantomListingSuccess } from '~/api/game/socket/characterPhantom'
import { ElNotification } from 'element-plus'
import type { CharacterPhantomListingDTO } from '~/shared/types/characterPhantom'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'

const props = defineProps<{
  guildUuid: string
}>()
const emit = defineEmits<{
  (e: 'created'): void
  (e: 'close'): void
}>()

const guildUuid = props.guildUuid
const listingRef = ref<any>(null)

const showBorrowDialog = ref(false)
const borrowPhantom = ref<CharacterPhantomListingDTO | null>(null)


let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  off1 = onCancelCharacterPhantomListingSuccess(() => {
    ElNotification.success({ title: '下架成功' })
  })
  off2 = onCancelCharacterPhantomListingFail(e => {
    ElNotification.error({ title: '下架失败', message: e?.message || 'unknown' })
  })
})

onUnmounted(() => {
  off1?.();
  off2?.();
})

function refreshList() {
  listingRef.value?.refresh?.()
}

function openBorrowFor(phantom: CharacterPhantomListingDTO) {
  borrowPhantom.value = phantom 
  showBorrowDialog.value = true
}

function closeBorrow() {
  showBorrowDialog.value = false
  // borrowListingUuid.value = null
}

async function handleCancel(phantom: CharacterPhantomListingDTO) {
  console.log(phantom)
  emitCancelCharacterPhantomListing(phantom.uuid)
}
</script>

<style scoped>
/* layout handled by tailwind classes in template */
</style>