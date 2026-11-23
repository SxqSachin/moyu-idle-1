<template>
    <div class="item-card relative h-21" @click="handleSelectAtlasItem">
        <div class="flex items-center justify-center w-16 h-16 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700">
            <template v-if="mainOutputResource">
                <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute"
                    :resource-id="mainOutputResource.id" :icon-size="8" :show-extra-text="true" :hide-name="true">
                </GameCommonSimpleResourceIconAndName>
            </template>
            <template v-else>
                <span class="text-gray-500 dark:text-gray-400"> ? </span>
            </template>
        </div>
        <div v-if="mainOutputResource" class="absolute whitespace-nowrap w-13 md:w-15 text-center overflow-hidden text-ellipsis bottom-0 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400">
            {{ mainOutputResource.name }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { allGameResource, allGameResourceWithInternal } from "~/shared/data/allGameResources";
import type { AlchemyAtlasEntry } from "~/shared/types/gameAlchemy";

const props = defineProps<{
    atlasItem: AlchemyAtlasEntry[]
}>()

const emits = defineEmits<{
    (e: 'select', payload: { items: AlchemyAtlasEntry[] }): void
}>()

function handleSelectAtlasItem() {
    emits("select", {items: props.atlasItem})
}

const atlasItemMainOutputItemResourceId = computed(() => {
    return props.atlasItem.find(i => i?.mainOutputResourceId)?.mainOutputResourceId
})

const mainOutputResource = computed(() => {
    if (!atlasItemMainOutputItemResourceId.value) return null

    return allGameResourceWithInternal[atlasItemMainOutputItemResourceId.value];
})


function hasOutputs(e: AlchemyAtlasEntry) {
  return !!(
    (e.outputsOnSuccessWhenDay && e.outputsOnSuccessWhenDay.length) ||
    (e.outputsOnSuccessWhenNight && e.outputsOnSuccessWhenNight.length) ||
    (e.outputsOnMutationWhenDay && e.outputsOnMutationWhenDay.length) ||
    (e.outputsOnMutationWhenNight && e.outputsOnMutationWhenNight.length)
  );
}

function gatherOutputs(e: AlchemyAtlasEntry) {
  const list: { id: string; range?: { min?: number; max?: number }; percent: number }[] = [];
  const push = (arr?: any[]) => {
      if (!arr) return;
    for (const it of arr) {
      list.push({ id: it.id, range: it.range, percent: it.percent ?? 0 });
    }
  };
  push(e.outputsOnSuccessWhenDay);
  push(e.outputsOnSuccessWhenNight);
  push(e.outputsOnMutationWhenDay);
  push(e.outputsOnMutationWhenNight);
  return list;
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity .15s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>