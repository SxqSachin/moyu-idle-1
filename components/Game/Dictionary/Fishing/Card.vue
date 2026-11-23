<template>
    <template v-if="asResource">

        <template v-if="isSingleResource && singleResourceInfo">
            <div class="flex items-start justify-start flex-col gap-2">
                <GameCommonResourceIconAndName :resource-id="singleResourceInfo.id">
                </GameCommonResourceIconAndName>
                <div>出没时间: <span>{{ appearTime }}</span></div>
                <div>权重: {{ cfg.weight }}</div>
                <div>基础概率: {{ formatPercent(fishConf.percent) }}</div>
                <div>提供经验: {{ fishConf.exp }}</div>

                <div v-if="neededBait.length" class="flex flex-col items-start justify-start gap-2">
                    <div>偏好饵料:</div>
                    <div class="flex flex-row gap-2 justify-start items-start flex-wrap">
                        <div v-for="baitId in neededBait" :key="baitId">
                            <GameCommonResourceIconAndName :resource-id="baitId">
                            </GameCommonResourceIconAndName>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>

            <div class="flex items-start justify-start flex-col gap-2">
                <div class="font-medium text-base text-gray-800 dark:text-gray-100">{{ fishConf.name }}</div>
                <div>出没时间: <span>{{ appearTime }}</span></div>
                <div>权重: {{ cfg.weight }}</div>
                <div>基础概率: {{ formatPercent(fishConf.percent) }}</div>
                <div>提供经验: {{ fishConf.exp }}</div>

                <div v-if="neededBait.length" class="flex flex-col items-start justify-start gap-2">
                    <div>偏好饵料:</div>
                    <div class="flex flex-row gap-2 justify-start items-start flex-wrap">
                        <div v-for="baitId in neededBait" :key="baitId">
                            <GameCommonResourceIconAndName :resource-id="baitId">
                            </GameCommonResourceIconAndName>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-start items-start gap-2">
                    <div> 产出： </div>
                    <div class="flex flex-col gap-2 justify-start items-start">
                        <div v-for="(weight, id) in allFishSpecies[cfg.speciesId].resourcePool" :key="id">
                            <GameCommonResourceIconAndName :resource-id="(id as string)">
                            </GameCommonResourceIconAndName>
                            <span> - 权重 {{ weight }}</span>
                        </div>
                    </div>
                </div>
            </div>

        </template>

    </template>
    <template v-else>
        <div class="flex flex-col items-start justify-start flex-1 gap-2">
            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <GameFishingPreview :fish="allFishSpecies[cfg.speciesId]"></GameFishingPreview>
            </div>
            <div class="flex flex-col gap-2 justify-start items-start">
                <div>出没时间: <span>{{ appearTime }}</span></div>
                <div>权重: <span>{{ props.cfg.weight }}</span></div>
                <div>提供经验: {{ fishConf.exp }}</div>

                <div v-if="neededBait.length" class="flex flex-col items-start justify-start gap-2">
                    <div>偏好饵料:</div>
                    <div class="flex flex-row gap-2 justify-start items-start flex-wrap">
                        <div v-for="baitId in neededBait" :key="baitId">
                            <GameCommonResourceIconAndName :resource-id="baitId">
                            </GameCommonResourceIconAndName>
                        </div>
                    </div>
                </div>

                <div>捕获几率: <span>{{ formatPercent(fishConf.percent) }}</span></div>

                <div>长度: <span>{{ fishConf.minLength ?? '-' }}cm - {{
                    fishConf.maxLength ?? '-' }}cm</span>
                </div>
                <div>重量: <span>{{ fishConf.minWeight ?? '-' }}kg - {{
                    fishConf.maxWeight ?? '-' }}kg</span>
                </div>
            </div>

            <el-divider class="my-0!"></el-divider>

            <div>
                <span> 基础回收价: </span>
                <GameCommonResourceIconAndName resource-id="gold" :count="fishConf.shopBaseRecallPrice">
                </GameCommonResourceIconAndName>
            </div>
            <div>
                <span> 品相额外价: </span>
                <GameCommonResourceIconAndName resource-id="gold" :count="fishConf.extraPriceForEachQuality">
                </GameCommonResourceIconAndName>
            </div>
            <div>
                <span> 每单位长度额外价: </span>
                <GameCommonResourceIconAndName resource-id="gold" :count="fishConf.extraPriceForEachLength">
                </GameCommonResourceIconAndName>
            </div>
            <div>
                <span> 每单位重量额外价: </span>
                <GameCommonResourceIconAndName resource-id="gold" :count="fishConf.extraPriceForEachWeight">
                </GameCommonResourceIconAndName>
            </div>
        </div>
    </template>

</template>

<script setup lang="tsx">
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies';


const props = defineProps<{
    cfg: {
        speciesId: AllFishSpeciesID,
        weight: number
    }
}>()


const fishConf = computed(() => {
    return allFishSpecies[props.cfg.speciesId];
})

const asResource = computed(() => {
    return fishConf.value.asResource;
})

const resourcePool = computed(() => {
    if (!asResource.value) return {};
    return fishConf.value.resourcePool || {};
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

function formatPercent(v?: number) {
    if (v === undefined || v === null) return '-'
    return `${(v * 100).toFixed(2)}%`
}

const appearTime = computed(() => {
    const ah = fishConf.value.activeHours;
    if (!ah) return '全天';
    if (ah.start == '00:00' && ah.end == '23:59') return '全天';
    return `${ah.start} - ${ah.end}`;
})

const neededBait = computed(() => {
    return fishConf.value.neededBait || null;
})

</script>