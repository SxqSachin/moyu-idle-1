<template>
    <div class="py-2 border-t border-gray-300">
        <TitleEffect :title="title"></TitleEffect>
    </div>
</template>

<script setup lang="tsx">
import { allTitles } from '~/shared/data/allTitle';
import TitleEffect from '../../Common/TitleEffect.vue';

const props = defineProps<{
    title: keyof typeof allTitles
}>()
</script>