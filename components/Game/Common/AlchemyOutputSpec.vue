<template>
    <template v-for="output of outputs">
        <GameCommonResourceIconAndName :resource-id="output.id">
            <template #count>
                :
                <template v-if="output.range.max == output.range.min">{{ output.range.min }}</template>
                <template v-else>{{ output.range.min }}-{{ output.range.max }}</template>
            </template>
            <template #default>
                ({{ Math.floor(output.percent * 100) }}%)
            </template>
        </GameCommonResourceIconAndName>
    </template>
</template>

<script setup lang="tsx">
import { AllResourceAlchemyTag, type AlchemyOutputSpec, type AllResourceAlchemyTagId } from '~/shared/types/gameAlchemy';

const props = defineProps<{
    outputs: AlchemyOutputSpec[]
}>()
</script>