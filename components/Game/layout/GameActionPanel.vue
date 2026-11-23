<template>
    <el-tabs v-model="activeTab" class="mb-4">
        <el-tab-pane v-for="tab in tabs" :key="tab" :label="tab === 'base' ? '通用' : tab" :name="tab" :lazy="true">

            <div class="grid gap-x-4 gap-y-12 action-grid mb-12">
                <template v-for="action in groupedActions[tab]" :key="action.id">
                    <template v-if="device.isMobile">
                        <GameActionCard :action="action" class="cursor-pointer"></GameActionCard>
                    </template>
                    <template v-else>
                        <el-popover width="400" class="pb-0!" trigger="hover" :show-after="620">
                            <template #reference>
                                <GameActionCard :action="action" class="cursor-pointer"></GameActionCard>
                            </template>
                            <GameActionCardInfo :action="action" :building-info="buildingInfo" :status-info="statusInfo"
                                :inventory="inventory"></GameActionCardInfo>
                        </el-popover>
                    </template>
                </template>
            </div>
        </el-tab-pane>
    </el-tabs>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { useInventory } from '~/composables/game/useInventory';
import { allGameAction, allGameActionMainType } from '~/shared/data/allGameActions';
import type { AllGameActionMainType } from '~/shared/types/gameAction';

const props = defineProps<{
    actionMainType: AllGameActionMainType
}>()

const inventory = useInventory()
const statusInfo = useCharacterStatusInfo()
const buildingInfo = useCharacterBuildingInfo()

const device = useDevice()

// 取出本面板所有action
const thisPanelActions = computed(() => {
    return allGameActionMainType[props.actionMainType].actions.map(actionId => {
        return allGameAction[actionId]
    })
})

// 按secondaryClassification分组
const groupedActions = computed(() => {
    const groups: Record<string, typeof allGameAction[keyof typeof allGameAction][]> = {}
    let hasSecondary = false
    for (const action of thisPanelActions.value) {
        if (!action || action?.hidden) {
            continue // 跳过隐藏的action
        }

        const sec = action.secondaryClassification
        if (sec) {
            hasSecondary = true
            if (!groups[sec]) groups[sec] = []
            groups[sec].push(action)
        } else {
            if (!groups.base) groups.base = []
            groups.base.push(action)
        }
    }
    // 如果没有任何secondary，则全部放base
    if (!hasSecondary) {
        return { base: thisPanelActions.value }
    }
    return groups
})

// tab列表
const tabs = computed(() => Object.keys(groupedActions.value))

const activeTab = ref(tabs.value[0] || 'base')

</script>
<style lang="scss" scoped>
.action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
}
</style>