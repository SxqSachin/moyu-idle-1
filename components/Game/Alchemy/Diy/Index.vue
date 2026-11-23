<template>
    <div v-if="!isMobile">
        <div class="flex flex-row gap-2">
            <div class="w-1/2">
                <GameAlchemyDiyAlchemyAction @done="handleDone"></GameAlchemyDiyAlchemyAction>
            </div>
            <div class="w-1/2">
                <GameAlchemyAtlas ref="atlas"></GameAlchemyAtlas>
            </div>
        </div>
    </div>
    <div v-else>
        <el-tabs v-model="activeTab">
            <el-tab-pane label="炼金台" name="alchemyAction">
                <GameAlchemyDiyAlchemyAction @done="handleDone"></GameAlchemyDiyAlchemyAction>
            </el-tab-pane>
            <el-tab-pane label="图鉴" name="atlas">
                <GameAlchemyAtlas ref="atlas"></GameAlchemyAtlas>
            </el-tab-pane>
        </el-tabs>
    </div>

</template>

<script setup lang="tsx">
import type { AllGameResourceID } from '~/shared/types/gameResource';
import { ref } from 'vue';
import type { GameAlchemyAtlas } from '#components';

const { isMobile } = useDevice()

const atlas = ref<InstanceType<typeof GameAlchemyAtlas> | null>(null);
const activeTab = ref("alchemyAction");

const handleDone = (payload: { expectMainOutput: AllGameResourceID, recipeIndex: number }) => {
    atlas.value?.jumpToSpecialRecipe(payload.expectMainOutput, payload.recipeIndex);
};

onMounted(() => {
    eventBus.on('use-alchemy-recipe', applyRecipe)
})
onUnmounted(() => {
    eventBus.off('use-alchemy-recipe', applyRecipe)
})

const applyRecipe = () => {
    activeTab.value = "alchemyAction";
};
</script>