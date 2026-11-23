<template>
    <el-card class="w-full">
        <div class="mb-3 flex items-center gap-3">
            <el-select v-model="fishFilter" placeholder="筛选鱼种（全部）" size="small" style="width:220px">
                <el-option :label="'全部'" :value="''" />
                <el-option v-for="fid in fishTypes" :key="fid" :label="allFishSpecies[fid as AllFishSpeciesID]?.name" :value="fid">
                    {{ 
                    // @ts-ignore
                        allFishSpecies[fid]?.name
                    }}
                </el-option>
            </el-select>
            <div class="text-sm text-gray-500">共 {{ items.length }} 条</div>
        </div>

        <el-skeleton :rows="4" animated v-if="loading" />
        <div v-else-if="error" class="text-xs text-red-500">{{ error }}</div>

        <div v-else>
            <div v-if="filteredItems.length === 0" class="text-xs text-gray-500">暂无鱼获</div>
            <div v-else>
                <DynamicScroller :items="filteredItems" key-field="id" class="max-h-128" :min-item-size="72">
                    <template #default="{ item: it }">
                        <div
                            class="flex items-center justify-between text-sm py-3 border-b border-gray-200 dark:border-gray-700 px-2">
                            <div class="flex flex-col gap-2">
                                <div class="font-medium">
                                    <FishingCatchPreview :fish="it" />
                                </div>
                                <div v-if="!it.asResource">
                                    <div class="text-xs text-gray-500 flex flex-row gap-4">
                                        <div>长度: {{ it.length }}cm</div>
                                        <div>重量: {{ it.weight }}kg</div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-xs text-gray-400">{{ formatTimeToStr(it.caughtAt) }}</div>
                        </div>
                    </template>
                </DynamicScroller>
            </div>
        </div>
    </el-card>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, computed } from 'vue'
import { DynamicScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { emitGetMyCatches, onGetMyCatchesSuccess, onGetMyCatchesFail } from '~/api/game/socket/fishing'
import FishingCatchPreview from './FishingCatchPreview.vue'
import { formatTimeToStr, ObjectKeysTyped } from '~/shared/utils'
import type { CaughtFishDTO } from '~/shared/types/fishing'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies'

const items = ref<Array<CaughtFishDTO>>([])
const loading = ref(true)
const error = ref<string | null>(null)

const fishFilter = ref<AllFishSpeciesID>()

const fishTypes = computed(() => {
    return ObjectKeysTyped(allFishSpecies).filter(f => !allFishSpecies[f].asResource)
})

const filteredItems = computed(() => {
    if (!fishFilter.value) return items.value
    return items.value.filter(i => i.fishId === fishFilter.value)
})

let unsubSuccess: null | (() => void) = null
let unsubFail: null | (() => void) = null

function clearListeners() {
    if (unsubSuccess) { unsubSuccess(); unsubSuccess = null }
    if (unsubFail) { unsubFail(); unsubFail = null }
}

function load() {
    loading.value = true
    error.value = null

    unsubSuccess = onGetMyCatchesSuccess((p) => {
        items.value = Array.isArray(p?.data) ? p.data : []
        loading.value = false
        clearListeners()
    })
    unsubFail = onGetMyCatchesFail((p) => {
        error.value = p?.message || '请求失败'
        items.value = []
        loading.value = false
        clearListeners()
    })

    try {
        emitGetMyCatches()
    } catch (e) {
        error.value = String(e)
        loading.value = false
        clearListeners()
    }
}

load()

onBeforeUnmount(() => clearListeners())
</script>

<style scoped></style>
