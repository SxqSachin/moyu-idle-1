<template>
    <template v-for="(count, id) in itemCountInfo" :key="id">
        <template v-if="showCount">
            <GameCommonResourceIconAndName :resource-id="id" :count="count?.count" :show-inventory-count="showInventoryCount"></GameCommonResourceIconAndName>
        </template>
        <template v-else>
            <GameCommonResourceIconAndName :resource-id="id"></GameCommonResourceIconAndName>
        </template>
    </template>
  
</template>

<script setup lang="ts">
import { ElPopover } from "element-plus";
import { computed, unref, ref, nextTick, onUnmounted } from "vue";
import { useInventory } from '~/composables/game/useInventory';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { CharacterInventory, ItemCountInfo } from '~/shared/types/gameInventory';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';


const props = defineProps<{
    itemCountInfo: ItemCountInfo
    showCount?: boolean
    showInventoryCount?: boolean
}>()

</script>