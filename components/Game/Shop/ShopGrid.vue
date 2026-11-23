<template>
    <div :class="containerClass">
        <template v-for="item in resources" :key="item[itemKey]">
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md h-[200px]">

                <slot name="card" :resource="item">
                </slot>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInventory } from '~/composables/game/useInventory'

const props = defineProps<{
    resources: any[]
    itemKey?: string
    colsClass?: string
}>()
const inventoryInfo = useInventory()

const itemKey = props.itemKey ?? 'id'
const containerClass = computed(() => {
    return props.colsClass ?? 'grid gap-4 items-start grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 p-1'
})
</script>

<style scoped>
/* keep minimal styles here; layout controlled via utility classes */
</style>
