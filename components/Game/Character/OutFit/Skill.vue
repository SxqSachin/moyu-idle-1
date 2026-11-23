<template>
    <div class="flex flex-wrap gap-2">
        <template v-for="skill of outfit.data" :key="skill.skillId">
            <GameCommonBattleSkillName v-if="skill.enabled" :logic="skill.logic" :skill-id="skill.skillId"></GameCommonBattleSkillName>
        </template>

    </div>
</template>

<script setup lang="tsx">
import type { CharacterSkillOutFitInGame } from '~/shared/types/characterInfo';


const props = defineProps<{
  outfit: CharacterSkillOutFitInGame
}>()

</script>