<template>
    <div class="relative" :class="{
        'equipment-slot--ph': !part
    }">
        <template v-if="equipment">
            <el-popover :show-after="200" placement="bottom" effect="light" trigger="hover" transition="el-fade-in"
                :width="370">
                <template #reference>
                    <div class="equipment-slot relative flex items-center justify-center w-16 h-16 rounded-xl border-2 transition-colors duration-200
      bg-gray-50 border-gray-200
      dark:bg-gray-800 dark:border-gray-700
      hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-900/30"
                        :class="{ 'equipment-slot--ph': !part }">
                        <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="equipment.id"
                            :show-extra-text="true" :hide-name="true">
                        </GameCommonSimpleResourceIconAndName>
                    </div>
                </template>
                <div>
                    <div class="font-bold text-base mb-1">{{ equipment.name }}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-400  mb-2">{{ equipment.description }}</div>
                    <template v-if="equipment.onEquip?.length">
                        <GameCommonResourceRelativeActionInfo :resource-id="equipmentId!">
                        </GameCommonResourceRelativeActionInfo>
                    </template>
                </div>
            </el-popover>
        </template>
        <template v-else>
            <div class="equipment-slot relative flex items-center justify-center w-16 h-16 rounded-xl border-2 transition-colors duration-200
      bg-gray-50 border-gray-200
      dark:bg-gray-800 dark:border-gray-700
      hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-900/30">
                {{ parseEquimentPartToString(part) }}
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { emitUnequipItem, emitEquipItem } from '~/api/game/socket/equipment';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { CharacterEquipmentPart, type CharacterEquipmentInfo } from '~/shared/types/characterInfo';
import type { AllGameResourceID } from '~/shared/types/gameResource';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';

const props = defineProps<{
    part: CharacterEquipmentPart | undefined
    equipment: CharacterEquipmentInfo
}>()

const equipmentId = computed(() => {
    if (!props.part) {
        return null
    }
    return unref(props.equipment)[props.part]
})

const equipment = computed(() => {
    let id = unref(equipmentId)
    if (!id) {
        return
    }
    return allGameResourceWithInternal[id]
})
</script>

<style lang="scss" scoped>
.equipment-slot {
    width: 64px;
    height: 64px;

    border-radius: 4px;

    display: flex;
    justify-content: center;
    align-items: center;
}

.equipment-slot--ph {
    visibility: hidden;
}
</style>