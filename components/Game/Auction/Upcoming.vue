<template>
  <div>
    <div v-if="loading" class="py-8 text-center text-gray-500">加载中……</div>
    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3" v-if="items.length">
        <GameUserBatchAvatarAndName :uuid-list="items.map(i => i.creator)">
          <template v-for="it in items" :key="it.uuid">
            <GameAuctionListItem :item="it" @select="onSelect(it.uuid)" />
          </template>
        </GameUserBatchAvatarAndName>
      </div>
      <div v-else class="py-8 text-center text-gray-400">暂无即将成交的拍卖</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { emitGetUpcomingAuctions, onGetUpcomingAuctionsFail, onGetUpcomingAuctionsSuccess } from '~/api/game/socket/auction';
import type { AuctionDetailDTO } from '~/shared/types/auction';

const items = ref<AuctionDetailDTO[]>([]);
const loading = ref(true);

const emit = defineEmits<{ (e: 'select', uuid: string): void }>();

function reload() {
  loading.value = true;
  emitGetUpcomingAuctions();
}

let offSuccess: (() => void) | undefined;
let offFail: (() => void) | undefined;

function onSelect(uuid: string) {
  emit('select', uuid);
}

onMounted(() => {
  offSuccess = onGetUpcomingAuctionsSuccess((data) => {
    items.value = data.items ?? [];
    loading.value = false;
  });
  offFail = onGetUpcomingAuctionsFail((_err) => {
    items.value = [];
    loading.value = false;
  });

  reload();
});

onUnmounted(() => {
  offSuccess?.();
  offFail?.();
});
</script>
