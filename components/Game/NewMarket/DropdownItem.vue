<template>
    <component :is="shouldRenderDropdown ? ElDropdown : 'div'" :show-timeout="620" v-bind="dropdownProps"
        :ref="setDropdownRef" class="flex items-center justify-center leading-none">

        <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
            @click="handleNameClick" @mouseenter="handleNameClick">
            <div class="relative w-full h-full flex items-center justify-center">
                <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="resourceId"
                    :icon-size="8" :show-extra-text="true" :hide-name="true">
                </GameCommonSimpleResourceIconAndName>
            </div>
            <div
                class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                {{ resourceName }}
            </div>
            <span class="absolute right-1.5 top-1.5 text-xs text-gray-400 opacity-50">▼</span>
        </div>

        <template v-if="shouldRenderDropdown" #dropdown>
            <el-dropdown-menu>
                <template v-for="subId in enhanceMap[resourceId]" :key="subId">
                    <el-dropdown-item v-if="filteredResourceIds?.includes(subId)" :command="subId"
                        class="flex items-center gap-2" @click="() => onSubItemClick(subId)">
                        <div class="flex flex-row items-center justify-center h-8">
                            <GameCommonSimpleResourceIconAndName :resource-id="subId" :icon-size="8" />
                        </div>
                    </el-dropdown-item>
                </template>
            </el-dropdown-menu>
        </template>
        <!-- </el-dropdown> -->
    </component>
</template>

<script setup lang="tsx">
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllGameActionID } from '~/shared/types/gameAction';
import type { AllGameResourceID, AllGameResourceIDWithInternal } from '~/shared/types/gameResource';

import enhanceInfo from '~/assets/resource/enhanceInfo.json';
import { ElDropdown } from 'element-plus';

const enhanceMap: { [key in AllGameResourceID]: AllGameActionID[] } = {};
Object.keys(enhanceInfo).forEach(key => {
    const base = key.split('+')[0];
    if (!enhanceMap[base]) enhanceMap[base] = [];
    enhanceMap[base].push(key);
});
// 2. 对每个链条按等级排序，并补全最后一次强化的结果
Object.keys(enhanceMap).forEach(base => {
    // 排序：基础在前，+1、+2...依次递增
    enhanceMap[base].sort((a, b) => {
        const getLevel = (id: string) => {
            const match = id.match(/\+(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        };
        return getLevel(a) - getLevel(b);
    });

    // 检查最后一级是否有 enhanceSuccessTo 指向的下一级，如果有且未在链表中，则补全
    let lastId = enhanceMap[base][enhanceMap[base].length - 1];

    // @ts-ignore
    while (enhanceInfo[lastId]?.enhanceSuccessTo && !enhanceMap[base].includes(enhanceInfo[lastId].enhanceSuccessTo)) {
        // @ts-ignore
        enhanceMap[base].push(enhanceInfo[lastId].enhanceSuccessTo);
        // @ts-ignore
        lastId = enhanceInfo[lastId].enhanceSuccessTo;
    }
});

const emits = defineEmits<{
    (e: 'toResourceMarketDetail', resourceId: string): void
}>()

const props = defineProps<{
    resourceId: AllGameActionID,
    filteredResourceIds?: AllGameResourceIDWithInternal[]
}>()

const dropDownRef = ref()
function setDropdownRef(el: any) {
  dropDownRef.value = el
}

const shouldRenderDropdown = ref(false)

function handleNameClick() {
  // 延迟渲染 dropdown，避免意外点击
  if (!shouldRenderDropdown.value) {
    shouldRenderDropdown.value = true
    // 等待 dropdown 渲染完成后再次触发点击
    nextTick(() => {
      if (dropDownRef.value) {
        // 尝试多种方式触发 dropdown
        try {
          dropDownRef.value.handleOpen()
        } catch (error) {
          console.error('Failed to trigger dropdown:', error)
        }
      }
    })
  }
}

const dropdownProps = computed(() => {
    if (!shouldRenderDropdown.value) return {}

    return {
        trigger: "hover"
    }
})

const onSubItemClick = (subId: AllGameResourceID) => {
    shouldRenderDropdown.value = false
    emits('toResourceMarketDetail', subId)
}

onUnmounted(() => {
    // 清理 dropdown 相关状态
    shouldRenderDropdown.value = false
    dropDownRef.value = null
})


const resourceName = computed(() => {
    return allGameResourceWithInternal[props.resourceId]?.name || props.resourceId;
})
</script>