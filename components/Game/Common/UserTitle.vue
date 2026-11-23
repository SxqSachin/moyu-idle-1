<template>
    <div class="flex flex-col gap-2 items-start mb-2 border-t border-gray-300 pb-2">
        <div>{{ conf.name }}</div>

        <div v-if="conf.statusModifyEffect" class="flex flex-row gap-2 items-center">
            <template v-for="effect in conf.statusModifyEffect">
                <span class="inline-block rounded" :class="getTagClass()">
                    <GameCommonStatusIconAndName :status="effect.status"></GameCommonStatusIconAndName>:
                    {{ getEffectCountModifyValueStr(effect) }}
                </span>
            </template>
        </div >

        <template v-if="conf.specDescription">
            <div class="text-xs mt-1">{{ conf.specDescription }}</div>
        </template>
    </div>
</template>

<script setup lang="tsx">
import { allTitles, type GameTitle } from '~/shared/data/allTitle';
import type { GameEffectActionAboutStatus } from '~/shared/types/gameEffect';

const props = defineProps<{
    title: keyof typeof allTitles
}>()

const conf = computed<GameTitle>(() => allTitles[props.title])

const getTagClass = () => {
    let prefix = " px-2 py-1 text-xs "
    return prefix + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
}

const getEffectCountModifyValueStr = (effectAction: GameEffectActionAboutStatus) => {
    if (effectAction.increase) {
        return '+' + (effectAction.increase)
    }

    return '-' + (effectAction.decrease!)
}
</script>