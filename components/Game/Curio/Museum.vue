<template>
  <div>
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ error }}
    </div>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <el-card
        v-for="curio in museumCurios"
        :key="curio.id"
        class="shadow-md hover:shadow-lg transition-shadow"
        :body-style="{ padding: '16px' }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-800">{{ curio.name }}</h3>
            <el-tag :type="getRarityColor(curio.rarity)" size="small">
              稀有度 {{ curio.rarity }}
            </el-tag>
          </div>
        </template>
        <p class="text-gray-600 mb-3">{{ curio.description }}</p>
        <div class="flex justify-between items-center text-sm text-gray-500">
          <span>发现者: {{ curio.ownerName || '未知' }}</span>
          <span>{{ formatDate(curio.created_at) }}</span>
        </div>
      </el-card>
    </div>
    <div v-if="museumHasMore" class="text-center mt-6">
      <el-button
        type="default"
        :loading="loading"
        @click="loadMoreMuseum"
        class="bg-gray-200 hover:bg-gray-300"
      >
        加载更多
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CurioItemWithOwner } from '~/shared/types/curio';

interface Props {
  museumCurios: CurioItemWithOwner[];
  loading: boolean;
  error: string | null;
  museumHasMore: boolean;
  loadMuseumCurios: (page: number) => Promise<void>;
}

const props = defineProps<Props>();

async function loadMoreMuseum() {
  const nextPage = Math.floor(props.museumCurios.length / 10) + 1;
  await props.loadMuseumCurios(nextPage);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString();
}

function getRarityColor(rarity: number) {
  if (rarity >= 4) return 'danger';
  if (rarity >= 3) return 'warning';
  if (rarity >= 2) return 'success';
  return 'info';
}
</script>