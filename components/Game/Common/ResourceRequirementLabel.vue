<template>
  <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded mb-2">
    <el-text class="pointer-events-none text-sm text-gray-700 dark:text-gray-200 mb-2">
      需求:
    </el-text>
    <div class="inline-flex flex-row flex-wrap gap-2">
      <div
        v-for="req in resourceRequirements"
        :key="req.resourceId"
        class="flex items-center rounded text-sm white-space-nowrap"
        :class="getRequirementClass(req)"
      >
        <GameCommonResourceIconAndName :inventory="inventory" :resource-id="req.resourceId" :show-inventory-count="true" :count="req.final">
        </GameCommonResourceIconAndName>
        <span class="text-sm pr-1">
          <template v-if="req.base != req.final"> (基础消耗:{{ req.base }}) </template>
        </span>
        <!-- <span class="text-sm">(库存:{{ req.inventory }})</span> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from "vue";
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import type { AllGameActionID } from "~/shared/types/gameAction";

const props = defineProps<{
  actionId: AllGameActionID
  inventory?: CharacterInventory
}>()

const allActionResourceRequirement = useActionResourceReqiurement()

const resourceRequirements = computed(() => {
  const reqArr = unref(allActionResourceRequirement)[props.actionId] || [];
  const inventory = props.inventory || {};
  return reqArr.map(req => ({
    ...req,
    inventory: inventory[req.resourceId]?.count ?? 0
  }));
});

// 资源消耗样式判断逻辑优化
function getRequirementClass(req: { inventory: number; final: number }) {
  if (req.final === 0) {
    return "bg-gray-200 dark:bg-gray-600 text-gray-500";
  }
  if (req.inventory < req.final) {
    return "bg-red-100 text-red-800";
  }
  return "bg-blue-100 dark:bg-gray-400 text-blue-800 dark:text-gray-800";
}
</script>