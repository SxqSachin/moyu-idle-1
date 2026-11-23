<template>
    <div>
        <div class="flex flex-col gap-4">
            <div class="flex-shrink-0 flex">
                <GameCommonResourceIconAndName :resource-id="cfg.resourceId" />
            </div>
            <div class="flex flex-col gap-2 items-start">
                <h1 class="font-bold">作为鱼饵时:</h1>
                <div class="flex flex-col items-start gap-2 text-gray-600 dark:text-gray-300">
                    <div class="text-sm">咬口率提升: <span>{{ formatPercent(cfg.biteRateIncreasePercent) }}</span></div>
                    <div class="text-sm">最大上钩时间减少: <span>{{ formatPercent(cfg.hookTimeReductionPercent) }}</span></div>
                </div>

                <h1 class="font-bold mt-2">特定鱼类额外咬口率: </h1>
                <div class="flex flex-col items-start gap-2">
                    <div class="flex flex-col gap-2">
                        <template v-for="(percent, fishId) in cfg.preferredSpeciesBoost">
                            <div class="flex flex-row gap-2 items-center">
                                <GameFishingPreview :fish="allFishSpecies[fishId]"></GameFishingPreview>
                                <span class="text-sm  text-gray-600 dark:text-gray-300">提升: {{ formatPercent(percent)
                                }}</span>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <el-divider class="my-0!"></el-divider>

            <div class="flex flex-col gap-2 items-start">
                <h1 class="font-bold">打窝时:</h1>
                <div class="flex flex-col items-start gap-2">

                    <div class="text-sm">区域半径: <span>{{ formatNumber(cfg.baitAreaRadius) }}</span></div>
                    <div class="text-sm">每单位持续时间(分钟): <span>{{ formatNumber(cfg.baitAreaDurationSec / 60) }}</span></div>

                    <template v-if="cfg.baitAreaBiteRateIncreasePercent">
                        <div class="text-sm">区域内咬口率提升: <span>{{ formatPercent(cfg.baitAreaBiteRateIncreasePercent) }}</span></div>
                    </template>

                    <template v-if="cfg.baitAreaHookTimeReductionPercent">
                        <div class="text-sm">区域内最大上钩时间减少: <span>{{ formatPercent(cfg.baitAreaHookTimeReductionPercent) }}</span></div>
                    </template>

                    <template v-if="cfg.baitAreaPreferredSpeciesPercentBoost">
                        <h1 class="font-bold mt-2">区域内特定鱼类额外咬口率: </h1>
                        <div class="flex flex-col gap-2">
                            <template v-for="(percent, fishId) in cfg.baitAreaPreferredSpeciesPercentBoost">
                                <div class="flex flex-row gap-2 items-center">
                                    <GameFishingPreview :fish="allFishSpecies[fishId]"></GameFishingPreview>
                                    <span>提升: {{ formatPercent(percent) }}</span>
                                </div>
                            </template>
                        </div>
                    </template>

                    <template v-if="cfg.baitAreaPreferredSpeciesWeightBoost">
                        <h1 class="font-bold mt-2">区域内特定鱼类额外权重: </h1>
                        <div class="flex flex-col gap-2">
                            <template v-for="(weight, fishId) in cfg.baitAreaPreferredSpeciesWeightBoost">
                                <div class="flex flex-row gap-2 items-center">
                                    <GameFishingPreview :fish="allFishSpecies[fishId]"></GameFishingPreview>
                                    <span>提升: {{ weight }}</span>
                                </div>
                            </template>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="tsx">
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies';
import { allGameResource } from '~/shared/data/allGameResources';
import type { FishBaitInfo } from '~/shared/types/fishing';
import { formatNumber } from '~/shared/utils';

const props = defineProps<{
    cfg: FishBaitInfo
}>();

const cfg = props.cfg;

function formatPercent(v?: number) {
    if (v === undefined || v === null) return '-';
    return `${(v * 100).toFixed(2)}%`;
}

const resource = computed(() => {
    return allGameResource[props.cfg.resourceId];
})

const resourceName = computed(() => {
    // GameCommonResourceIconAndName will display icon+name; here we show name if available
    return cfg.resourceId || '未知饵料';
});

const areaSpeciesBoosts = computed(() => {
    const map = cfg.baitAreaPreferredSpeciesPercentBoost || {};
    return Object.entries(map).map(([id, percent]) => {
        const s = allFishSpecies[id as AllFishSpeciesID] || { name: id, icon: '' } as any;
        return { id, name: s.name || id, icon: s.icon || '', percent };
    });
});

const singleSpeciesBoosts = computed(() => {
    const map = cfg.preferredSpeciesBoost || {};
    return Object.entries(map).map(([id, percent]) => {
        const s = allFishSpecies[id as AllFishSpeciesID] || { name: id, icon: '' } as any;
        return { id, name: s.name || id, icon: s.icon || '', percent };
    });
});

</script>