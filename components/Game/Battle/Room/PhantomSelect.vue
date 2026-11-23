<template>
  <div class="space-y-4">
    <el-table :loading="loading" :data="borrowedPhantoms">
      <el-table-column prop="characterUuid" label="玩家" width="180">
        <template #default="{ row }">
          <GameUserAvatarAndName :uuid="row.phantomOwner"/>
        </template>
      </el-table-column>
      <el-table-column prop="characterUuid" label="镜像">
        <template #default="{ row }">
          <GameBattleBaseBattleUnit :unit="row.snapshot" :hide-name="true"></GameBattleBaseBattleUnit>
          <template v-if="row.note">
            <el-divider class="my-3! mb-2!"></el-divider>
            <div class="text-xs text-gray-400 dark:text-gray-600">
              {{ row.note }}
            </div>
          </template>
        </template>
      </el-table-column>

      <el-table-column label="操作" fixed="right" width="80">
        <template #default="{ row }">
          <slot name="action" :row="row">
            <div class="flex flex-col md:flex-row gap-2">
              <el-popconfirm title="使用此镜像？" @confirm="handleSelect(row)">
                <template #reference>
                  <el-button class="ml-0!" size="small" type="primary" @click="">使用</el-button>
                </template>
              </el-popconfirm>
            </div>
          </slot>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  onCreateCharacterPhantomBorrowFail,
  onGetSelfBorrowedPhantomSuccess,
  emitGetSelfBorrowedPhantomList,
  emitReturnCharacterPhantomBorrow,
  onGetSelfBorrowedPhantomFail,
  onReturnCharacterPhantomBorrowFail,
  onReturnCharacterPhantomBorrowSuccess,
} from '~/api/game/socket/characterPhantom'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { ElNotification } from 'element-plus'
import type { CharacterPhantomBorrowDTO, CharacterPhantomListingDTO } from '~/shared/types/characterPhantom';

const props = defineProps<{
  guildUuid?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', phantomUuid: string): void
}>()

const loading = ref(false)
const borrowedPhantoms = ref<CharacterPhantomBorrowDTO[]>([])

let off1: Function | undefined
let off2: Function | undefined

onMounted(async () => {
  await waitUtilConnected()

  off1 = onGetSelfBorrowedPhantomSuccess((data) => {
    loading.value = false
    borrowedPhantoms.value = data.borrows
  })
  off2 = onGetSelfBorrowedPhantomFail((d) => {
    loading.value = false
    ElNotification.error({ title: '获取失败', message: d.message || 'unknown' })
  })

  emitGetSelfBorrowedPhantomList()
})

const handleSelect = (phantom: CharacterPhantomBorrowDTO) => {
    emit('select', phantom.uuid)
}

onUnmounted(() => {
  off1?.()
  off2?.()
})
</script>

<style scoped></style>