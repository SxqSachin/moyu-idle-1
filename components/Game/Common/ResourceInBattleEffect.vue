<template>
    <div class="flex flex-col gap-2" v-if="resource?.inBattleEffect">
        <template v-for="battleEffect of resource.inBattleEffect">
            <span v-if="!battleEffect.hidden" class="w-fit px-2 py-1 text-xs bg-blue-100 dark:bg-gray-400 text-blue-800 dark:text-gray-800 inline-block rounded">
                <span v-if="battleEffect.currentHpModify"> 当前生命值: {{ valueModifyStr(battleEffect.currentHpModify) }}
                </span>
                <span v-if="battleEffect.currentMpModify"> 当前魔法值: {{ valueModifyStr(battleEffect.currentMpModify) }}
                </span>
                <span v-if="battleEffect.desc" v-html="battleEffect.desc.replaceAll('\n', '<br/>')">
                </span>
                <span v-if="battleEffect.addState"> {{ battleEffect.desc }}
                </span>
            </span>
        </template>
    </div>
    <div class="text-xs text-gray-500 my-2">冷却时间：{{ resource.inBattleCooldown ?? 0 }} 回合</div>
</template>

<script lang="ts" setup>
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal
}>()


const resource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})


const valueModifyStr = (value: number) => {
    if (value > 0) {
        return `+${value}`
    } else if (value < 0) {
        return `${value}`
    }
    return '0'
}

</script>