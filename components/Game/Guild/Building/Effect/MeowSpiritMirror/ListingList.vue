<template>
  <div>
    <el-table :data="filteredList" v-loading="loading" style="width: 100%">
      <el-table-column prop="characterUuid" label="玩家" :width="isMobile ? '120px' : '180px'">
        <template #default="{ row }">
          <GameUserAvatarAndName :uuid="row.owner" @click="showPlayerInfo(row.owner)" />
        </template>
      </el-table-column>

      <el-table-column prop="characterUuid" label="镜像" width="260">
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

      <el-table-column prop="usageCount" label="使用次数" width="80">
      </el-table-column>

      <el-table-column prop="created_at" label="时间" width="140">
        <template #default="{ row }">
          <span>{{ formatTimeToStr(row.created_at) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" fixed="right" :width="isMobile ? '80px' : '160px'">
        <template #default="{ row }">
          <slot name="action" :row="row">
            <div class="flex flex-col md:flex-row gap-2">

              <el-popconfirm title="释放此镜像？" @confirm="emitCancel(row)" v-if="isOwner(row)">
                <template #reference>
                  <el-button size="small" type="danger" @click="">消散</el-button>
                </template>
              </el-popconfirm>
              <el-button class="ml-0!" size="small" type="primary" @click="emitBorrow(row)"
                :loading="borrowPhantom === row.uuid">使用</el-button>
            </div>
          </slot>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
    :close-on-click-modal="true" destroy-on-close>
    <template #header>
      <span>玩家信息</span>
    </template>

    <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, defineExpose } from 'vue'
import { waitUtilConnected } from '~/api/game/socket/socket'
import {
  emitListCharacterPhantom,
  onListCharacterPhantomSuccess,
  onListCharacterPhantomFail,
} from '~/api/game/socket/characterPhantom'
import { formatTimeToStr } from '~/shared/utils';
import type { CharacterPhantomListingDTO } from '~/shared/types/characterPhantom';

const { isMobile } = useDevice()

const props = defineProps<{
  guildUuid?: string | null
  listingUuid?: string | null
  limit?: number
  filter?: string
}>()

const emits = defineEmits<{
  (e: 'borrow', phantom: CharacterPhantomListingDTO): void
  (e: 'cancel', phantom: CharacterPhantomListingDTO): void
  (e: 'loaded'): void
}>()

const loading = ref(false)
const list = ref<CharacterPhantomListingDTO[]>([])
const borrowPhantom = ref<CharacterPhantomListingDTO | null>(null)

const { user } = useUserSession()

let offListSuccess: Function | undefined
let offListFail: Function | undefined

// 弹窗相关
const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);

function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid || null;
  playerInfoDialogVisible.value = true;
}

async function refresh() {
  loading.value = true
  const payload: any = { limit: props.limit ?? 50 }
  if (props.guildUuid) payload.guildUuid = props.guildUuid
  if (props.listingUuid) payload.listingUuid = props.listingUuid
  await waitUtilConnected()
  emitListCharacterPhantom(payload)
}

onMounted(async () => {
  await waitUtilConnected()

  offListSuccess = onListCharacterPhantomSuccess((d) => {
    list.value = d.list ?? []
    loading.value = false
    emits('loaded')
  })
  offListFail = onListCharacterPhantomFail((e) => {
    loading.value = false
  })

  // initial load
  refresh()
})

onUnmounted(() => {
  offListSuccess?.()
  offListFail?.()
})

function emitBorrow(phantom: CharacterPhantomListingDTO) {
  borrowPhantom.value = phantom  
  emits('borrow', phantom)
}

function emitCancel(phantom: CharacterPhantomListingDTO) {
  emits('cancel', phantom)
}

function isOwner(row: any) {
  const cur = user.value?.uuid
  return !!cur && row.owner === cur
}

const filteredList = computed(() => {
  if (!props.filter) return list.value
  return list.value.filter(i => (i.characterUuid || '').includes(props.filter!))
})

// expose refresh so parent can trigger after save etc.
defineExpose({ refresh, list, loading })

</script>

<style scoped>
/* layout handled by tailwind classes in parent templates */
</style>