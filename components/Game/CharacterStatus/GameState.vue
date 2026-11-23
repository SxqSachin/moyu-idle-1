<template>
    <template v-if="!isEmpty">
        <el-card class="w-full" body-class="p-3! flex flex-col gap-2" shadow="hover">
            <div class="text-sm mb-2 text-gray-500 dark:text-gray-300"> 全局效果： </div>
            <div class="flex flex-col gap-2">
                <template v-if="notExpiredGlobalStatusState.length">
                    <template v-for="state in notExpiredGlobalStatusState" :key="state.id">
                        <div class="flex flex-row items-center gap-4 text-gray-500 dark:text-gray-300 text-sm">
                            <GameCommonGlobalStatusEffectStateName :state-id="state.id" :state-effect="state">
                            </GameCommonGlobalStatusEffectStateName>
                            <div class="text-xs">
                                持续至：{{ formatTime(state.until, {hideSecond: true}) }}
                            </div>
                        </div>
                    </template>
                </template >

                <template v-if="notExpiredGlobalActionDurationEffectState.length">
                    <template v-for="state in notExpiredGlobalActionDurationEffectState" :key="state.stateId">
                        <div class="flex flex-row items-center gap-4 text-gray-500 dark:text-gray-300 text-sm">
                            <GameCommonGlobalActionDurationEffectStateName :state-id="state.stateId"></GameCommonGlobalActionDurationEffectStateName>
                            <div class="text-xs">
                                持续至：{{ formatTime(state.until, {hideSecond: true}) }}
                            </div>
                        </div>
                    </template>
                </template>
            </div>
            <div v-if="notExpiredStateWhenStartEachBattle.length">
                <div class="text-sm mb-2 text-gray-500 dark:text-gray-300"> 战斗内效果： </div>
                <div class="flex flex-col gap-2">
                    <template v-for="state in notExpiredStateWhenStartEachBattle" :key="state.id">
                        <div class="flex flex-row items-center gap-4 text-gray-500 dark:text-gray-300 text-sm">
                            <GameCommonStateName :state-id="state.id">
                            </GameCommonStateName>
                            <div class="text-xs">
                                持续至：{{ formatTime(state.until, {hideSecond: true}) }}
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </el-card>
    </template>
</template>

<script setup lang="ts">
import { no } from 'element-plus/es/locale/index.mjs';
import type { PlayerState } from '~/shared/types/characterInfo';
import { formatTime } from '~/shared/utils';

const props = defineProps<{
    gameState: PlayerState
}>()

const notExpiredStateWhenStartEachBattle = computed(() => {
    let stateWhenStartEachBattle = props.gameState?.battle?.stateWhenStartEachBattle ?? []

    return stateWhenStartEachBattle.filter(state => {
        return new Date(state.until) > new Date()
    })
})

const notExpiredGlobalStatusState = computed(() => {
    let states = props.gameState?.global?.statusEffect ?? []

    return states.filter(state => {
        return new Date(state.until) > new Date()
    })
})

const notExpiredGlobalActionDurationEffectState = computed(() => {
    let states = props.gameState?.global?.actionEffect ?? []

    return states.filter(state => {
        return new Date(state.until) > new Date()
    })
})

const isEmpty = computed(() => {
    if (!props.gameState) {
        return true;
    }

    return notExpiredStateWhenStartEachBattle.value.length === 0 && notExpiredGlobalStatusState.value.length === 0 && notExpiredGlobalActionDurationEffectState.value.length === 0;
})
</script>