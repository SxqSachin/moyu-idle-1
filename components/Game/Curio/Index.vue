<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <h2 class="text-2xl font-bold mb-6 text-gray-800">古董收藏</h2>
    <el-tabs v-model="activeTab" @tab-click="handleTabClick">
      <el-tab-pane label="我的古董" name="my">
        <MyCurios
          :curios="curios"
          :tags="tags"
          :loading="loading"
          :error="error"
          :has-more="hasMore"
          :load-curios="loadCurios"
          :load-tags="loadTags"
          :load-curios-by-tag="loadCuriosByTag"
        />
      </el-tab-pane>

      <el-tab-pane label="古董鉴定" name="identify">
        <IdentifyCurio
          :loading="loading"
          :error="error"
          :unidentified-curio-count="unidentifiedCurioCount"
          :last-identified-results="lastIdentifiedResults"
          :identify-curio="identifyCurio"
          :clear-last-identified-results="clearLastIdentifiedResults"
        />
      </el-tab-pane>

      <el-tab-pane label="博物馆" name="museum">
        <Museum
          :museum-curios="museumCurios"
          :loading="loading"
          :error="error"
          :museum-has-more="museumHasMore"
          :load-museum-curios="loadMuseumCurios"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useCurio } from '~/composables/game/useCurio';
import { useInventory } from '~/composables/game/useInventory';
import MyCurios from './MyCurios.vue';
import IdentifyCurio from './IdentifyCurio.vue';
import Museum from './Museum.vue';

const {
  curios,
  museumCurios,
  tags,
  loading,
  error,
  hasMore,
  museumHasMore,
  lastIdentifiedResults,
  identifyCurio,
  loadCurios,
  loadTags,
  loadCuriosByTag,
  loadMuseumCurios,
  clearLastIdentifiedResults,
} = useCurio();

const inventory = useInventory();

const activeTab = ref('my');

const unidentifiedCurioCount = computed(() => {
  return inventory.value['unidentifiedCurio']?.count ?? 0;
});

async function handleTabClick(tab: any) {
  if (tab.props.name === 'museum' && museumCurios.value.length === 0) {
    await loadMuseumCurios();
  }
}

onMounted(async () => {
  await loadTags();
  await loadCurios();
});
</script>