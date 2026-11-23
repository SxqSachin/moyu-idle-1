<template>
    <span class="inline-block text-sm px-2 py-1 rounded bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800">
        <span class="inline-flex gap-2 flex-wrap">
            <template v-for="t in info">
                <span>{{ t.name }}</span>
            </template>
        </span>
        <slot></slot>
    </span>
</template>

<script setup lang="tsx">
import { AllResourceAlchemyTag, type AllResourceAlchemyTagId } from '~/shared/types/gameAlchemy';

const props = defineProps<{
    type: AllResourceAlchemyTagId
}>()

const info = computed(() => {
    let tag = props.type as string
    if (tag.startsWith('(')) {
        tag = tag.slice(1, -1)
    }

    let fTag = tag

    let r = fTag.split(',').map(t => {
        return AllResourceAlchemyTag[t  as AllResourceAlchemyTagId]
    })

    return r;
})

// const name = computed(() => {
//     return info.value?.name
// })
</script>