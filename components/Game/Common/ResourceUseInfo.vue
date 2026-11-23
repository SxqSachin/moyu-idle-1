<template>
    <div class="flex flex-row flex-wrap items-start gap-2">
        <template v-for="triggerEffect in thisResource.onUse">
            <template v-for="resourceEffect in triggerEffect.resourceEffect">
                <span class="inline-block rounded" :class="getTagClass(triggerEffect)">

                    <GameCommonSimpleResourceIconAndName :resource-id="resourceEffect.resource">
                    </GameCommonSimpleResourceIconAndName>
                    <span class="ml-1">
                        {{ getResourceEffectCountModifyValueStr(resourceEffect) }}
                        {{ getResourceEffectCountModifyPercentStr(resourceEffect) }}
                    </span>

                </span>
            </template>

            <template v-for="effect in triggerEffect.learnBattleSkillEffect">
                <span class="inline-flex items-center rounded" :class="getTagClass(triggerEffect)">
                    <span> 学习技能： </span>
                    <div>
                        <GameCommonBattleSkillName :skill-id="effect.skillId">
                        </GameCommonBattleSkillName>
                    </div>
                    <span class="ml-2">
                        (+{{ effect.expReward }}经验)
                    </span>
                    <span>{{ isSkillLearned(effect.skillId) ? '(已学习)' : '' }}</span>
                </span>
            </template>


            <template v-for="title in triggerEffect.addTitle">
                <span class="inline-flex items-center rounded" :class="getTagClass(triggerEffect)">
                    <span> 获得称号： </span>
                    <span>
                        {{ allTitles[title].name }}
                    </span>
                </span>
            </template>

            <template v-for="effect in triggerEffect.statusExpEffect">
                <span class="inline-flex items-center rounded" :class="getTagClass(triggerEffect)">
                    <span> {{ allCharacterStatus[effect.status].icon }} {{ allCharacterStatus[effect.status].name }}经验:
                    </span>
                    <span class="ml-2"> +{{ effect.increase }} </span>
                </span>
            </template>

            <template v-for="effect in triggerEffect.statusLevelEffect">
                <span class="inline-flex items-center rounded" :class="getTagClass(triggerEffect)">
                    <span> {{ allCharacterStatus[effect.status].icon }} {{ allCharacterStatus[effect.status].name }}等级:
                    </span>
                    <span class="ml-2"> +{{ effect.increase }} </span>
                </span>
            </template>

            <template v-for="effect in triggerEffect.addSkillTreePoint">
                <span class="inline-flex items-center rounded" :class="getTagClass(triggerEffect)">
                    <template v-if="effect.treeId == 'life'">
                        <span> 生活专精点: +{{ effect.increase }}</span>
                    </template>
                    <template v-if="effect.treeId == 'battle'">
                        <span> 战斗专精点: +{{ effect.increase }}</span>
                    </template>
                </span>
            </template>

        </template>

        <template v-if="hasTextDetail">
            <template v-for="triggerEffect in thisResource.onUse">
                <template v-for="effect in triggerEffect.textDetail">
                    <span class="flex flex-row items-left rounded" :class="getTagClass(triggerEffect)">
                        <span> {{ effect.title }} <template v-if="effect.description">:</template> </span>
                        <span class="flex-1" v-html="effect.description.replaceAll('\n', '<br/>')"> </span>
                    </span>
                </template>
            </template>
        </template>

        <template v-if="canPreview">
            <ItemPreview :resource-id="props.resourceId" />
        </template>
    </div>
  
</template>

<script setup lang="ts">
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills';
import { useInventory } from '~/composables/game/useInventory';
import { allCharacterStatus } from '~/shared/data/allCharacterStatus';
import { allGameBattleSkills } from '~/shared/data/allGameBattleSkill';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { allTitles } from '~/shared/data/allTitle';
import type { GameEffectAction, GameEffectActionAboutResource, GameEffectActionAboutResourceWithPercent } from '~/shared/types/gameEffect';
import type { CharacterInventory } from '~/shared/types/gameInventory';
import type { AllGameResourceIDWithInternal } from '~/shared/types/gameResource';
import { getResourcerIconAndName } from '~/shared/utils/game/info';
import ItemPreview from './ItemPreview.vue';

const props = defineProps<{
    resourceId: AllGameResourceIDWithInternal

    inventory?: CharacterInventory

    multiple?: number

    reduce?: number
    
    small?: boolean
}>()

const multiple = computed(() => {
    return props.multiple ?? 1
})

const inventory = computed(() => {
    if (props.inventory) {
        return props.inventory
    }
    return unref(useInventory())
});

const thisResource = computed(() => {
    return allGameResourceWithInternal[props.resourceId]
})

const skillInfo = useCharacterBattleSkills()

const isSkillLearned = (skillId: string) => {
    return unref(skillInfo).find(skill => skill.skillId === skillId)
}

const getTagClass = (effectAction: GameEffectAction) => {
    let prefix = props.small ? " px-2 py-1 text-xs " : " px-2 py-1 text-sm "
    if (effectAction.isDebuff) {
        return prefix + ' bg-red-100 text-red-800';
    }

    return prefix + ' bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800 ';
}

const getResourceCount = (resourceId: AllGameResourceIDWithInternal) => {
    return unref(inventory)[resourceId]?.count ?? 0
}

const getResourceEffectCountModifyValueStr = (effectAction: GameEffectActionAboutResource) => {
    if (effectAction.increase) {
        return '+' + (effectAction.increase * unref(multiple))
    }

    return '-' + (effectAction.decrease! * unref(multiple))
}

const getResourceEffectCountModifyResultStr = (resourceEffect: GameEffectActionAboutResource) => {
    let inventoryCount = getResourceCount(resourceEffect.resource)

    let result = 0

    let revertEffect = 0
    let reduce = props.reduce ?? 0

    if (resourceEffect.increase) {
        revertEffect = -(reduce * resourceEffect.increase)
        result = (inventoryCount + (resourceEffect.increase * unref(multiple)))
    } else if (resourceEffect.decrease) {
        revertEffect = reduce * resourceEffect.decrease
        result = (inventoryCount - (resourceEffect.decrease * unref(multiple)))
    }


    return ` (${inventoryCount - reduce} -> ${result - reduce})`
}

const getResourceEffectCountModifyPercentStr = (resourceEffect: GameEffectActionAboutResourceWithPercent) => {
    if (!resourceEffect.percent) {
        return ""
    }

    return `(${resourceEffect.percent * 100}%)`
}

const hasTextDetail = computed(() => {
    if (!thisResource.value.onUse) {
        return false
    }
    for (const triggerEffect of thisResource.value.onUse) {
        if (triggerEffect.textDetail && triggerEffect.textDetail.length > 0) {
            return true
        }
    }
    return false
})

const canPreview = computed(() => {
    return thisResource.value.onUse?.some(effect => {
        return effect.addAvatarBorder?.length || effect.addProfileStyle
    })
})
</script>