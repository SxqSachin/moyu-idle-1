<template>
    <el-card class="satiety-info bg-yellow-50 w-full" shadow="hover" body-class="p-3!">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-2xl">😋</span>
                <div class="flex flex-col">
                    <span class="text-sm font-bold">饱食度</span>
                    <span class="text-xs text-gray-500">吃饱了才有力气干活哦</span>
                </div>
            </div>
            <div class="text-xl font-bold text-yellow-600">
                {{ satiety }}
            </div>
        </div>
    </el-card>
</template>

<script setup lang="ts">
defineProps<{
    satiety: number
}>()
</script>