<template>
    <div class="flex flex-col gap-1 items-start">
        <div v-if="!hideTitle">{{ conf.name }}</div>
        <div class="text-xs text-gray-400" v-if="!hideDescription">{{ conf.description }}</div>

        <div v-if="conf.statusModifyEffect" class="flex flex-row gap-2 items-start">
            <h1 class="text-xs whitespace-nowrap relative top-1">启用时：</h1>
            <div class="flex flex-row gap-2 flex-wrap">
                <template v-for="effect in conf.statusModifyEffect">
                    <span class="inline-block rounded" :class="getTagClass()">
                        <GameCommonStatusIconAndName :status="effect.status"></GameCommonStatusIconAndName>:
                        {{ getEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>
        </div >

        <template v-if="conf.specDescription">
            <div class="text-xs">{{ conf.specDescription }}</div>
        </template>

        <div v-if="conf.statusModifyEffectWhenInactive" class="flex flex-row gap-2 items-start">
            <h1 class="text-xs whitespace-nowrap relative top-1">未启用时：</h1>
            <div class="flex flex-row gap-2 flex-wrap">
                <template v-for="effect in conf.statusModifyEffectWhenInactive">
                    <span class="inline-block rounded" :class="getTagClass()">
                        <GameCommonStatusIconAndName :status="effect.status"></GameCommonStatusIconAndName>:
                        {{ getEffectCountModifyValueStr(effect) }}
                    </span>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="tsx">
import { allTitles, type GameTitle } from '~/shared/data/allTitle';
import type { GameEffectAction, GameEffectActionAboutStatus } from '~/shared/types/gameEffect';

const props = defineProps<{
    title: keyof typeof allTitles
    hideTitle?: boolean
    hideDescription?: boolean
}>()

const conf = computed<GameTitle>(() => allTitles[props.title])

const getTagClass = () => {
    let prefix = " px-1.5 py-0.5 text-xs "
    return prefix + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
}

const getEffectCountModifyValueStr = (effectAction: GameEffectActionAboutStatus) => {
    if (effectAction.increase) {
        return '+' + (effectAction.increase)
    }

    return '-' + (effectAction.decrease!)
}
</script>