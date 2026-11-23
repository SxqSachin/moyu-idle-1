<template>
    <el-tabs>
        <el-tab-pane :lazy="true" label="工作台">
            <GameLayoutGameActionPanel action-main-type="mysterious"></GameLayoutGameActionPanel>
        </el-tab-pane>
        <el-tab-pane label="炼金台" :lazy="true">
            <template v-if="hasMysteriousCabin">
                <GameAlchemyDiy></GameAlchemyDiy>
            </template>
            <template v-else>
                <div>你需要先建造“神秘小屋”后，才能使用炼金台</div>
            </template>
        </el-tab-pane>
    </el-tabs>
</template>

<script setup lang="tsx">
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
const building = useCharacterBuildingInfo()

const hasMysteriousCabin = computed(() => {
    return building.value?.mysteriousCabin?.status == 'BUILT'
})
</script>