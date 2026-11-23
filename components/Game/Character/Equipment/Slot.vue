<template>
  <div class="equipment-slot relative flex items-center justify-center w-16 h-16 rounded-xl border-2 transition-colors duration-200
      bg-gray-50 border-gray-200
      dark:bg-gray-800 dark:border-gray-700
      hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-900/30"
    :class="{ 
      'equipment-slot--ph': !part,
    }">
    <template v-if="equipment">
      <el-popover :show-after="620" placement="bottom" effect="light" trigger="hover" :disabled="isMobile" transition="el-fade-in"
        :width="370">
        <template #reference>
          <div ref="equipmentRef" @click="showDialog = true" class="cursor-pointer">
            <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="equipment.id" :show-extra-text="true"
              :hide-name="true" />
          </div>
        </template>
        <div>
          <div class="flex flex-row items-center mb-2 gap-2">
            <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="equipment.id" :hide-name="true">
            </GameCommonSimpleResourceIconAndName>
            <div class="font-bold text-base">{{ equipment.name }}</div>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ equipment.description }}</div>
          <template v-if="equipment.onEquip?.length">
            <GameCommonResourceRelativeActionInfo :resource-id="equipmentId!" />
          </template>
        </div>
      </el-popover>
      <el-dialog v-model="showDialog" :title="equipment.name" width="350px" align-center>
        <div class="flex flex-col items-center">
          <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="equipment.id" :hide-name="true" />
          <div class="text-sm text-gray-600 dark:text-gray-400">{{ equipment.description }}</div>
          <el-divider class="my-4!" />
          <template v-if="equipment.equipStatusRequirement?.length">
            <div class="text-sm w-full mb-2">
              <div class="font-bold mb-2">装备需求：</div>
              <GameCommonResourceEquipRequirement :resource-id="equipmentId!" />
            </div>
          </template>
          <template v-if="equipment.onEquip?.length">
            <div class="text-sm w-full">
              <div class="font-bold mb-2">装备后：</div>
              <GameCommonResourceEquipInfo :resource-id="equipmentId!" />
            </div>
            <el-divider class="mt-4! mb-0!" />
          </template>
        </div>
        <template #footer>
          <el-button class="w-full" type="primary" :loading="unequipLoading" :disabled="unequipLoading"
            @click="handleUnequip">
            卸下
          </el-button>
        </template>
      </el-dialog>
    </template>
    <template v-else>
      <!-- 空槽位时，点击弹出可装备物品列表 -->
      <el-popover ref="popoverRef" :show-after="620" :visible="showEquipPopover" placement="bottom" width="330"
        popper-class="pb-8!" @after-leave="handlePopoverClose">
        <template #reference>
          <span class="text-sm text-gray-400 dark:text-gray-500 cursor-pointer select-none" @click="handleSlotClick">
            {{ parseEquimentPartToString(part) }}
          </span>
        </template>
        <div v-if="equippableItems.length" class="flex flex-row flex-wrap gap-x-4 gap-y-8">
          <template v-for="item in equippableItems" :key="item.id">
            <component :is="shouldRenderPopover[item.id] ? ElPopover : 'span'" v-bind="popoverProps"
              @mouseenter="() => handleMouseEnter(item.id)" @mouseleave="handleMouseLeave">

              <template v-if="shouldRenderPopover" #reference>
                <div ref="el => itemRefs[item.id] = el"
                  class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                  @click="handleEquip(item.id)">
                  <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="item.id"
                      :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                  </div>
                  <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ item.name }}
                  </div>
                </div>
              </template>

              <!-- 当不是 popover 时的内容 -->
              <template v-if="!shouldRenderPopover[item.id]">
                <div ref="el => itemRefs[item.id] = el"
                  class="item-card relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-transparent bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 shadow-sm transition-all duration-300 ease-out hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-105 hover:from-blue-50 hover:via-white hover:to-purple-50 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700"
                  @click="handleEquip(item.id)">
                  <div class="relative w-full h-full flex items-center justify-center">
                    <GameCommonSimpleResourceIconAndName class="inline-block w-10 h-10 absolute" :resource-id="item.id"
                      :icon-size="8" :show-extra-text="true" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                  </div>
                  <div
                    class="absolute text-center left-0 -bottom-5.5 text-xs w-16 overflow-hidden text-ellipsis whitespace-nowrap break-keep text-gray-600 dark:text-gray-200">
                    {{ item.name }}
                  </div>
                </div>
              </template>

              <template v-if="shouldRenderPopover[item.id]">
                <div>
                  <div class="flex flex-row items-center mb-2 gap-2">
                    <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="item.id" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                    <div class="font-bold text-base">{{ item.name }}</div>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ item.description }}</div>
                  <template v-if="item.onEquip?.length">
                    <GameCommonResourceRelativeActionInfo :resource-id="item.id"></GameCommonResourceRelativeActionInfo>
                  </template>
                </div>
              </template>
            </component>

          </template>

        </div>
        <div v-else class="text-gray-400 dark:text-gray-500 text-center py-2">无可装备物品</div>
      </el-popover>
    </template>
  </div>

  <!-- 长按（移动端）简洁 dialog -->
  <el-dialog v-model="showLongPressDialog" width="320px" align-center>
    <template #header>
    <div class="flex flex-row items-center gap-2">
      <GameCommonSimpleResourceIconAndName :icon-size="14" :resource-id="equipment!.id" :hide-name="true">
      </GameCommonSimpleResourceIconAndName>
      <div class="font-bold text-base">{{ equipment!.name }}</div>
    </div>
    </template>

    <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ equipment!.description }}</div>
    <GameCommonResourceRelativeActionInfo :resource-id="equipmentId!" />
  </el-dialog>
</template>

<script setup lang="ts">
import { ElPopover } from 'element-plus';
import { onLongPress } from '@vueuse/core';
import { onMounted, watch, nextTick } from 'vue';
import { emitUnequipItem, emitEquipItem } from '~/api/game/socket/equipment';
import { useCharacterEquipment, useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { useInventory } from '~/composables/game/useInventory';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { CharacterEquipmentPart, type CharacterEquipmentType } from '~/shared/types/characterInfo';
import type { AllGameResourceID } from '~/shared/types/gameResource';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';

const characterBattleEquipment = useCharacterEquipment()
const characterWorkEquipment = useCharacterWorkEquipment()

const showEquipPopover = ref(false)
const popoverRef = ref<HTMLElement | null>(null)
onMounted(() => {
    document.addEventListener('mousedown', handleDocumentClick)
})

// device
const { isMobile } = useDevice()

// refs for long-press handling on equippable items
const itemRefs = ref<Record<string, HTMLElement | null>>({})
const longPressItem = ref<AllGameResourceID | null>(null)
const showLongPressDialog = ref(false)
const equipmentRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // register long-press for equipment (when equipped)
  if (isMobile) {
    onLongPress(equipmentRef, (e: PointerEvent) => {
      // open concise dialog for equipped item
      showLongPressDialog.value = true
      longPressItem.value = equipmentId.value || null
    }, { modifiers: { prevent: true }, delay: 300 })
  }
})

onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentClick)
})

function handleDocumentClick(event: MouseEvent) {
    if (!showEquipPopover.value) return
    // @ts-ignore
    const popoverEl = popoverRef.value?.$el || popoverRef.value
    if (popoverEl && !popoverEl.contains(event.target as Node)) {
        showEquipPopover.value = false
    }
}


const inventory = useInventory()

const showDialog = ref(false)

const unequipLoading = ref(false)

const props = defineProps<{
    part: CharacterEquipmentPart | undefined
    type: CharacterEquipmentType
}>()

const characterEquipment = computed(() => {
    if (props.type === 'work') {
        return characterWorkEquipment.value
    } else {
        return characterBattleEquipment.value
    }
})

const equipmentId = computed(() => {
    if (!props.part) {
        return null
    }
    return unref(characterEquipment)[props.part]
})

const equipment = computed(() => {
    let id = unref(equipmentId)
    if (!id) {
        return
    }
    return allGameResourceWithInternal[id]
})

// 可装备到该部位且背包有的物品
const decoratorParts = ['decorate1', 'decorate2', 'decorate3', 'decorate4', 'decorate5', 'decorate6', 'decorate7', 'decorate8', 'decorate9']

const equippableItems = computed(() => {
    if (!props.part) return []

    const allowedEquipment = Object.values(allGameResourceWithInternal)
        .filter(item => {
            return (item.equipmentType ?? []).includes(props.type)
        })

    // 如果是饰品槽，允许所有饰品装备
    if (decoratorParts.includes(props.part)) {
        return allowedEquipment.filter(item => {
            return decoratorParts.includes(item.equipPart as string) && (inventory.value[item.id]?.count ?? 0) > 0
        })
    }
    // 其他部位正常判断
    return allowedEquipment.filter(item => {
        return (item.equipPart === props.part || props.part?.startsWith(item.equipPart!)) && (inventory.value[item.id]?.count ?? 0) > 0
    })
})

const handleEquip = async (itemId: AllGameResourceID) => {
    emitEquipItem({ resourceId: itemId, type: props.type })
    showEquipPopover.value = false
}

const handleSlotClick = () => {
    if (equippableItems.value.length > 0) {
        showEquipPopover.value = true
    }
}
const handlePopoverClose = () => {
    showEquipPopover.value = false
}

const handleUnequip = async () => {
    if (props.part && !unequipLoading.value) {
        unequipLoading.value = true
        emitUnequipItem({
            part: props.part,
            type: props.type
        })
        showDialog.value = false
        setTimeout(() => {
            unequipLoading.value = false
        }, 5000)
    }
}

const shouldRenderPopover = ref<{ [key: string]: boolean }>({})
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const popoverProps = computed(() => {
    if (!shouldRenderPopover.value) return {}
    
    return {
        hideAfter: 120,
        showAfter: 200,
        placement: "bottom",
        effect: "light",
        trigger: "hover",
        transition: "el-fade-in",
        width: 370,
    }
})

function handleMouseEnter(id: string) {
  // 在移动端禁用 popover
  if (isMobile) return

  // 延迟渲染 popover，避免快速划过时创建不必要的元素
  hoverTimer.value = setTimeout(() => {
    shouldRenderPopover.value[id] = true
  }, 0) // 620ms 延迟
}

// 鼠标离开事件
function handleMouseLeave() {
    // 清除延迟渲染的定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
}

onUnmounted(() => {
    // 清除定时器
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
    }
    shouldRenderPopover.value = {}
    popoverRef.value = null
})

// 当弹出可装备物品面板时，在移动端为每个 item 注册 long-press
// watch(showEquipPopover, async (val) => {
//   if (!val || !isMobile) return
//   await nextTick()
//   // register long-press for each rendered item
//   equippableItems.value.forEach(item => {
//     const el = itemRefs.value[item.id]
//     if (el) {
//       onLongPress(el, (e: PointerEvent) => {
//         longPressItem.value = item.id
//         showLongPressDialog.value = true
//       }, { modifiers: { prevent: true } })
//     }
//   })
// })

</script>

<style scoped>
.equipment-slot--ph {
  visibility: hidden;
}

</style>