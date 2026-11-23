
<template>
  <div>
    <el-select
      v-model="selectedCategory"
      placeholder="全部分类"
      clearable
      class="w-56 mb-2"
    >
      <el-option label="全部分类" value="all" />
      <el-option
        v-for="(info, key) in allGameResourceCategoryInfo"
        :key="key"
        :label="`${info.icon} ${info.name}`"
        :value="key"
      />
    </el-select>
    <el-input v-model="searchKeyword" placeholder="搜索资源" clearable class="mb-2" />
    <div class="overflow-y-auto" v-if="!!filteredCatalogList.length" style="max-height:70vh;">
      <ul class="flex flex-col gap-1">
        <li
          v-for="item in filteredCatalogList"
          :key="item?.id"
          :class="[
            'flex items-center px-2 py-1 rounded cursor-pointer transition',
            selectedResourceId === item?.id
              ? 'bg-blue-100 text-blue-600 font-bold'
              : 'hover:bg-gray-100'
          ]"
          @click="item?.id && selectResource(item.id)"
        >
          <GameCommonSimpleResourceIconAndName v-if="item?.id" :resource-id="item.id" />
          <span v-else class="text-gray-400">未知</span>
        </li>
      </ul>
    </div>
    <div class="flex items-center justify-center mt-2" v-else>
      <el-text size="small" class="text-center">
        该分类下暂无已上架的求购单
      </el-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { GameCommonSimpleResourceIconAndName } from "#components";
import { allGameResource, allGameResourceCategoryInfo } from "@/shared/data/allGameResources";
import type { AllGameResourceID, GameResourceCategory } from "@/shared/types/gameResource";

const props = defineProps<{
  catalogList: Array<{ id: string, name: string, count: number, minPrice: number }>,
  selectedResourceId: string | null,
  activeCategory: 'all' | 'mine' | GameResourceCategory,
}>();
const emit = defineEmits<{
  (e: 'select-resource', id: string): void,
}>();

const searchKeyword = ref("");
const selectedCategory = ref<'all' | 'mine' | GameResourceCategory>('all');

const filteredCatalogList = computed<{id: AllGameResourceID}[]>(() => {
  let list = props.catalogList;
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    list = list.filter(item => {
      let resource = allGameResource[item.id];
      return resource?.category?.includes(selectedCategory.value as GameResourceCategory);
    });
  }
  if (searchKeyword.value) {
    list = list.filter(item => item.name.includes(searchKeyword.value));
  }
  return list;
});

function selectResource(id: string) {
  emit('select-resource', id);
}
</script>