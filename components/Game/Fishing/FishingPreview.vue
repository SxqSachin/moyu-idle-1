<template>
    <template v-if="isResource">
        <template v-if="isSingleResource && singleResourceInfo">
            <div class="flex items-start justify-start flex-col gap-2">
                <GameCommonResourceIconAndName :resource-id="singleResourceInfo.id">
                </GameCommonResourceIconAndName>
            </div>
        </template>
        <template v-else>
            <div class="flex items-start justify-start flex-col gap-2">
                <div v-for="(weight, id) in resourcePool" :key="id">
                    <GameCommonResourceIconAndName :resource-id="(id as string)">
                    </GameCommonResourceIconAndName>
                </div>
            </div>
        </template>
    </template>
    <template v-else>
        <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps" @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave">
            <template v-if="shouldRenderPopover" #reference>
                <div>
                    <el-tag class="cursor-pointer inline-flex items-center" :type="rarityTagType"
                        :disable-transitions="true">
                        <span class="text-sm mr-1">{{ species?.icon ?? '🐟' }}</span>
                        <span class="text-sm truncate">{{ species?.name ?? fishId }}</span>
                    </el-tag>
                </div>
            </template>

            <template v-if="!shouldRenderPopover">
                <div>
                    <el-tag class="cursor-pointer inline-flex items-center" :type="rarityTagType"
                        :disable-transitions="true">
                        <span class="text-sm mr-1">{{ species?.icon ?? '🐟' }}</span>
                        <span class="text-sm truncate">{{ species?.name ?? fishId }}</span>
                    </el-tag>
                </div>
            </template>

            <template v-if="shouldRenderPopover">
                <div class="max-w-xs">
                    <template v-if="!isResource">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="text-2xl">{{ species?.icon ?? '🐟' }}</div>
                            <div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-700 mb-2">{{ species?.description ?? '' }}</div>
                        <div class="flex flex-col gap-2 text-xs text-gray-500">
                            <span>
                                长度: {{ species?.minLength ?? '-' }}cm ~ {{ species?.maxLength ?? '-'
                                }}cm
                            </span>
                            <span>
                                重量: {{ species?.minWeight ?? '-' }}kg ~ {{ species?.maxWeight ?? '-'
                                }}kg
                            </span>
                        </div>
                        <!-- <div v-if="activeHoursText" class="text-xs text-gray-500 mt-2">活跃时间: {{ activeHoursText }}</div> -->
                    </template>
                </div>
            </template>
        </component>
    </template>

</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { ElPopover } from 'element-plus'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies';
import type { CaughtFishDTO, FishSpecies } from '~/shared/types/fishing';
import type { GameCommonResourceIconAndName } from '#components';

const props = defineProps<{
    fish: FishSpecies;
}>()
const fishId = computed(() =>  props.fish.id as AllFishSpeciesID);

const isResource = computed(() => !!props.fish.asResource);

const shouldRenderPopover = ref(false)
let hoverTimer: NodeJS.Timeout | null = null

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    return {
        placement: 'bottom',
        trigger: 'hover',
        transition: 'el-fade-in',
        showAfter: 120,
        width: 320,
    }
})

function handleMouseEnter() {
    if (shouldRenderPopover.value) return
    hoverTimer = setTimeout(() => { shouldRenderPopover.value = true }, 120)
}
function handleMouseLeave() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
}

onUnmounted(() => { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null } })

const species = computed(() => allFishSpecies[fishId.value] as FishSpecies);

const rarityTagType = computed<'primary' | 'success' | 'warning' | 'info' | 'danger'>(() => {
    const r = species.value?.rarity
    switch (r) {
        case 0: return 'info'
        case 1: return 'success'
        case 2: return 'primary'
        case 3: return 'warning'
        case 4: return 'danger'
        default: return 'primary'
    }
})

const qualityStrMap: { [key: number]: string } = {
    0: '普通',
    1: '优质',
    2: '精良',
    3: '稀有',
    4: '传奇',
} as const

const activeHoursText = computed(() => {
    const ah = species.value?.activeHours
    if (!ah) return ''
    return `${ah.start ?? '—'} - ${ah.end ?? '—'}`
})

const asResource = computed(() => {
    return props.fish.asResource;
})

const resourcePool = computed(() => {
    if (!asResource.value) return {};
    return props.fish.resourcePool || {};
})

const isSingleResource = computed(() => {
    if (!asResource.value) return false;

    return resourcePool.value && Object.keys(resourcePool.value).length === 1;
})

const singleResourceInfo = computed(() => {
    if (!isSingleResource.value) return null;
    const firstKey = Object.keys(resourcePool.value)[0];
    return {
        id: firstKey,
        weight: resourcePool.value[firstKey]
    }
})
</script>

<style scoped></style>
