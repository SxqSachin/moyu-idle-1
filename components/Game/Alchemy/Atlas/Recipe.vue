<template>
    <div class="flex flex-col py-4" v-if="mainOutputResource">
        <div class="text-center flex flex-col items-center mb-4">
            <GameCommonSimpleResourceIconAndName :resource-id="recipe.mainOutputResourceId" :hide-name="true"
                :icon-size="16"></GameCommonSimpleResourceIconAndName>

            <span class="text-sm text-gray-600 dark:text-gray-400">{{ mainOutputResource.name }}</span>
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ index + 1 }} / {{ total }}</span>
        </div>

        <div>
            <el-button plain type="primary" class="w-full mb-1" @click="useRecipe">使用此配方</el-button>
        </div>

        <el-divider class="mt-1! mb-2!"></el-divider>

        <div class="flex flex-col gap-2  text-sm text-gray-600 dark:text-gray-300 leading-8">
            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4">
                成功率: {{ Math.floor((recipe.baseSuccessChance ?? 0) * 100) }}%
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4" v-if="Object.keys(recipe.minSuccessStatusLevel).length">
                <span> 属性要求: </span>
                <div class="inline-flex flex-wrap gap-2">
                    <div v-for="(level, status) in recipe.minSuccessStatusLevel" :key="status">
                        <span class="inline-block text-sm px-2 py-1 rounded " :class="getStatusTagColor(status, level)">
                            <GameCommonStatusIconAndName :status="status"></GameCommonStatusIconAndName>
                            <span>: {{ level }}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4">
                <span>配方：</span>
                <div class="inline-flex flex-wrap gap-2">
                    <template v-for="(input, type) of recipe.inputs">
                        <template v-if="type.startsWith('(')">
                            <GameCommonAlchemyTag :type="(type as any)">:{{ input?.count }}</GameCommonAlchemyTag>
                        </template>
                        <template v-else>
                            <GameCommonResourceIconAndName :resource-id="type" :count="input?.count">
                            </GameCommonResourceIconAndName>
                        </template>
                    </template>
                </div>
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4"
                v-if="recipe.outputsOnSuccessWhenDay || recipe.outputsOnSuccessWhenNight">
                <div>成功产出：</div>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnSuccessWhenDay">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnSuccessWhenDay">
                    </GameCommonAlchemyOutputSpec>
                </div>
                <span class="mx-2" v-if="recipe.outputsOnSuccessWhenDay && recipe.outputsOnSuccessWhenNight && notEqual(recipe.outputsOnSuccessWhenDay, recipe.outputsOnSuccessWhenNight)">或</span>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnSuccessWhenNight && notEqual(recipe.outputsOnSuccessWhenDay, recipe.outputsOnSuccessWhenNight)">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnSuccessWhenNight">
                    </GameCommonAlchemyOutputSpec>
                </div>
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4"
                v-if="recipe.outputsOnFailWhenDay || recipe.outputsOnFailWhenNight">
                <div>失败产出：</div>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnFailWhenDay">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnFailWhenDay"></GameCommonAlchemyOutputSpec>
                </div>
                <span class="mx-2" v-if="recipe.outputsOnFailWhenDay && recipe.outputsOnFailWhenNight && notEqual(recipe.outputsOnFailWhenDay, recipe.outputsOnFailWhenNight)">或</span>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnFailWhenNight && notEqual(recipe.outputsOnFailWhenDay, recipe.outputsOnFailWhenNight)">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnFailWhenNight"></GameCommonAlchemyOutputSpec>
                </div>
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-4"
                v-if="recipe.outputsOnMutationWhenDay || recipe.outputsOnMutationWhenNight">
                <div>变种产出：
                    ({{ mutationPercentText }})
                </div>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnMutationWhenDay">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnMutationWhenDay">
                    </GameCommonAlchemyOutputSpec>
                </div>
                <span class="mx-2" v-if="recipe.outputsOnMutationWhenDay && recipe.outputsOnMutationWhenNight && notEqual(recipe.outputsOnMutationWhenNight, recipe.outputsOnMutationWhenNight)">或</span>
                <div class="inline-flex flex-wrap gap-2" v-if="recipe.outputsOnMutationWhenNight && notEqual(recipe.outputsOnMutationWhenNight, recipe.outputsOnMutationWhenNight)">
                    <GameCommonAlchemyOutputSpec :outputs="recipe.outputsOnMutationWhenNight">
                    </GameCommonAlchemyOutputSpec>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup lang="tsx">
import { useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { allGameResource, allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { AllBaseCharacterStatusType } from '~/shared/types/characterInfo';
import { AllResourceAlchemyTag, type AlchemyAtlasEntry, type AlchemyOutputSpec, type AlchemyRecipe, type AllResourceAlchemyTagId } from '~/shared/types/gameAlchemy';

const characterStatus = useCharacterStatusInfo();

const props = defineProps<{
    recipe: AlchemyAtlasEntry
    index: number
    total: number
}>()

const mainOutputResource = computed(() => {
    if (!props.recipe.mainOutputResourceId) return null

    return allGameResourceWithInternal[props.recipe.mainOutputResourceId];
})

const getStatusTagColor = (status: AllBaseCharacterStatusType, levelRequirement: number | undefined) => {
    let cls = 'bg-blue-100 dark:bg-gray-400 text-blue-800 dark:text-gray-800'

    if ((characterStatus.value[status].final ?? 0) < (levelRequirement ?? 0)) {
        cls = 'bg-red-100 text-red-800'
    }

    return cls
}

const useRecipe = () => {
    eventBus.emit('use-alchemy-recipe', {recipe: props.recipe});
}

const notEqual = (a: AlchemyOutputSpec[] | undefined, b: AlchemyOutputSpec[] | undefined) => {
    if (!a && !b) return false;
    return JSON.stringify(a) !== JSON.stringify(b);
}

const mutationPercentWhenDay = computed(() => {
    return props.recipe.mutationPercentWhenDay ?? 0;
})

const mutationPercentWhenNight = computed(() => {
    return props.recipe.mutationPercentWhenNight ?? 0;
})

const equipment = useCharacterWorkEquipment();

const mutationPercentText = computed(() => {
    let lMutationPercentWhenDay = mutationPercentWhenDay.value;
    let lMutationPercentWhenNight = mutationPercentWhenNight.value;

    let text = '';

    if (lMutationPercentWhenDay && lMutationPercentWhenNight) {
        text = `${Math.round(lMutationPercentWhenDay * 100)}% / ${Math.round(lMutationPercentWhenNight * 100)}%`;
    } else if (lMutationPercentWhenDay) {
        text = `${Math.round(lMutationPercentWhenDay * 100)}%`;
    } else if (lMutationPercentWhenNight) {
        text = `${Math.round(lMutationPercentWhenNight * 100)}%`;
    } else {
        text = ``;
    }

    let extraMutationPercentFromEquipment = 0;
    Object.values(equipment.value).forEach((equipmentId) => {
      if (!equipmentId) return;

      let resource = allGameResourceWithInternal[equipmentId];

      for(const onEquip of resource.onEquip ?? []) {
        if (onEquip.alchemyModify?.mutationPercentIncrease) {
          extraMutationPercentFromEquipment += onEquip.alchemyModify.mutationPercentIncrease;
        }
      }
    })

    if (text && extraMutationPercentFromEquipment > 0) {
        text += ` + ${(extraMutationPercentFromEquipment * 100).toFixed(2)}%`;
    }

    return text;
})

</script>