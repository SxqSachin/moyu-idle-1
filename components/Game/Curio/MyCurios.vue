<template>
  <div>
    <div class="flex gap-4 mb-6">
      <el-select
        v-model="selectedTag"
        placeholder="选择标签筛选"
        @change="filterByTag"
        class="w-48"
        clearable
      >
        <el-option
          v-for="tag in tags"
          :key="tag"
          :label="tag"
          :value="tag"
        />
      </el-select>
    </div>
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ error }}
    </div>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <el-card
        v-for="curio in curios"
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
          <span>标签: {{ curio.lore_tag }}</span>
          <span>{{ formatDate(curio.created_at) }}</span>
        </div>
      </el-card>
    </div>
    <div v-if="hasMore" class="text-center mt-6">
      <el-button
        type="default"
        :loading="loading"
        @click="loadMore"
        class="bg-gray-200 hover:bg-gray-300"
      >
        加载更多
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CurioItem } from '~/shared/types/curio';

interface Props {
  curios: CurioItem[];
  tags: string[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadCurios: (page: number) => Promise<void>;
  loadTags: () => Promise<void>;
  loadCuriosByTag: (tag: string, page: number) => Promise<void>;
}

const props = defineProps<Props>();

const selectedTag = ref('');

async function filterByTag() {
  if (selectedTag.value) {
    await props.loadCuriosByTag(selectedTag.value, 1);
  } else {
    await props.loadCurios(1);
  }
}

async function loadMore() {
  const nextPage = Math.floor(props.curios.length / 10) + 1;
  if (selectedTag.value) {
    await props.loadCuriosByTag(selectedTag.value, nextPage);
  } else {
    await props.loadCurios(nextPage);
  }
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