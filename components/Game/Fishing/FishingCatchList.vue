<template>
    <div class="w-full">
        <el-skeleton :rows="4" animated v-if="loading" />
        <div v-else-if="error" class="text-xs text-red-500">{{ error }}</div>
        <div v-else>
            <div v-if="items.length === 0" class="text-xs text-gray-500">暂无鱼获</div>
            <div v-else>
                <ul class="space-y-3 divide-y divide-gray-200 dark:divide-gray-700">
                    <li v-for="it in summaryItems" :key="it.id" class="flex items-center justify-between text-sm pb-3">
                        <div class="flex flex-col gap-2">
                            <div class="font-medium">
                                <FishingCatchPreview :fish="it" />
                            </div>
                            <div v-if="!it.asResource">
                                <div class="text-xs text-gray-500 flex flex-row gap-4">
                                    <div>
                                        长度: {{ it.length }}cm
                                    </div>
                                    <div>
                                        重量: {{ it.weight }}kg
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400">{{ formatTimeToStr(it.caughtAt) }}</div>
                    </li>
                </ul>

                <div class="mt-2 flex items-center justify-between">
                    <div class="text-xs text-gray-500">共 {{ items.length }} 条</div>
                    <button v-if="items.length > 5" @click.stop="openDialog" type="button"
                        class="text-xs text-blue-600 hover:underline">查看更多</button>
                </div>

                <el-dialog v-model="showDialog" width="520px" title="鱼获详情">
                    <div class="max-h-128 overflow-auto">
                        <template v-if="loading">
                            <el-skeleton :rows="6" animated />
                        </template>
                        <template v-else>
                            <ul class="space-y-3 divide-y divide-gray-200 dark:divide-gray-700">
                                <li v-for="it in items" :key="it.id"
                                    class="flex items-center justify-between text-sm pb-3">
                                    <div class="flex flex-col gap-2">
                                        <div class="font-medium">
                                            <FishingCatchPreview :fish="it" />
                                        </div>
                                        <div v-if="!it.asResource">
                                            <div class="text-xs text-gray-500 flex flex-row gap-4">
                                                <div>
                                                    长度: {{ it.length }}cm
                                                </div>
                                                <div>
                                                    重量: {{ it.weight }}kg
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xs text-gray-400">{{ formatTimeToStr(it.caughtAt) }}</div>
                                </li>
                            </ul>
                        </template>
                    </div>
                    <template #footer>
                        <el-button @click="showDialog = false">关闭</el-button>
                    </template>
                </el-dialog>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { emitGetCatches, onGetCatchesSuccess, onGetCatchesFail } from '@/api/game/socket/fishing'
import { formatTimeToStr } from '~/shared/utils';
import FishingCatchPreview from './FishingCatchPreview.vue'
import type { CaughtFishDTO } from '~/shared/types/fishing';

const props = defineProps<{ userUuid: string; sessionId: string }>()

const items = ref<Array<CaughtFishDTO>>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showDialog = ref(false)

const summaryItems = computed(() => items.value.slice(0, 5))

function openDialog() {
    showDialog.value = true
}

let unsubSuccess: null | (() => void) = null
let unsubFail: null | (() => void) = null

function clearListeners() {
    if (unsubSuccess) { unsubSuccess(); unsubSuccess = null }
    if (unsubFail) { unsubFail(); unsubFail = null }
}

async function load() {
    if (!props.sessionId) return
    // idempotent: 如果已经加载过且无错误则不重复请求
    if (loading.value) return
    loading.value = true
    error.value = null

    // one-shot listeners
    unsubSuccess = onGetCatchesSuccess((payload) => {
        // ensure response matches this component's sessionId
        if (payload?.sessionId !== props.sessionId) return
        items.value = payload.data;// Array.isArray(payload?.data) ? payload.data : (payload || [])
        loading.value = false
        clearListeners()
    })
    unsubFail = onGetCatchesFail((p: any) => {
        if (p?.sessionId && p.sessionId !== props.sessionId) return
        error.value = p?.message || '请求失败'
        items.value = []
        loading.value = false
        clearListeners()
    })

    try {
        emitGetCatches({ sessionId: props.sessionId })
    } catch (e) {
        error.value = '请求异常'
        items.value = []
        loading.value = false
        clearListeners()
    }
}

defineExpose({ load })

onBeforeUnmount(() => clearListeners())

function formatTime(s: string | Date) {
    try {
        const d = typeof s === 'string' ? new Date(s) : s
        return d ? d.toLocaleString() : ''
    } catch (_) { return '' }
}
</script>

<style scoped></style>
