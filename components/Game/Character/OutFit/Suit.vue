<template>
  <div>
    <div class="grid grid-cols-3 place-items-center gap-3 md:gap-2">
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.cloak]"
        @equip="item => modifyPart(CharacterEquipmentPart.cloak, item)"
        @unequip="modifyPart(CharacterEquipmentPart.cloak, undefined)" :type="type"
        :part="CharacterEquipmentPart.cloak" />

      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.head]"
        @equip="item => modifyPart(CharacterEquipmentPart.head, item)"
        @unequip="modifyPart(CharacterEquipmentPart.head, undefined)" :type="type"
        :part="CharacterEquipmentPart.head" />
      <GameCharacterOutFitSlot :type="type" :part="undefined" />

      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.leftHand]"
        @equip="item => modifyPart(CharacterEquipmentPart.leftHand, item)"
        @unequip="modifyPart(CharacterEquipmentPart.leftHand, undefined)" :type="type"
        :part="CharacterEquipmentPart.leftHand" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.body]"
        @equip="item => modifyPart(CharacterEquipmentPart.body, item)"
        @unequip="modifyPart(CharacterEquipmentPart.body, undefined)" :type="type"
        :part="CharacterEquipmentPart.body" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.rightHand]"
        @equip="item => modifyPart(CharacterEquipmentPart.rightHand, item)"
        @unequip="modifyPart(CharacterEquipmentPart.rightHand, undefined)" :type="type"
        :part="CharacterEquipmentPart.rightHand" />

      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.arm]"
        @equip="item => modifyPart(CharacterEquipmentPart.arm, item)"
        @unequip="modifyPart(CharacterEquipmentPart.arm, undefined)" :type="type" :part="CharacterEquipmentPart.arm" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.leg]"
        @equip="item => modifyPart(CharacterEquipmentPart.leg, item)"
        @unequip="modifyPart(CharacterEquipmentPart.leg, undefined)" :type="type" :part="CharacterEquipmentPart.leg" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.foot]"
        @equip="item => modifyPart(CharacterEquipmentPart.foot, item)"
        @unequip="modifyPart(CharacterEquipmentPart.foot, undefined)" :type="type"
        :part="CharacterEquipmentPart.foot" />
    </div>
    <el-divider class="my-4" content-position="center">饰品</el-divider>
    <div class="grid grid-cols-3  place-items-center gap-3 md:gap-4"
      :class="{
        'md:grid-cols-3': unlockedDecorate9,
        'md:grid-cols-4': !unlockedDecorate9,
      }">
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate1]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate1, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate1, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate1" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate2]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate2, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate2, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate2" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate3]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate3, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate3, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate3" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate4]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate4, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate4, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate4" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate5]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate5, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate5, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate5" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate6]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate6, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate6, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate6" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate7]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate7, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate7, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate7" />
      <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate8]"
        @equip="item => modifyPart(CharacterEquipmentPart.decorate8, item)"
        @unequip="modifyPart(CharacterEquipmentPart.decorate8, undefined)" :type="type"
        :part="CharacterEquipmentPart.decorate8" />

      <template v-if="unlockedDecorate9">
        <GameCharacterOutFitSlot :readonly="readonly" :item-id="outfitData[CharacterEquipmentPart.decorate9]"
          @equip="item => modifyPart(CharacterEquipmentPart.decorate9, item)"
          @unequip="modifyPart(CharacterEquipmentPart.decorate9, undefined)" :type="type"
          :part="CharacterEquipmentPart.decorate9" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GameCharacterOutFitSlot } from '#components';
import { useDecorate9UnlockFlag } from '~/composables/game/useUniqueFlag';
import { CharacterEquipmentPart, type CharacterEquipmentOutfitInGame } from '~/shared/types/characterInfo';
import type { AllGameResourceID } from '~/shared/types/gameResource';
import { getEquipmentActuralId } from '~/shared/utils/game/equipment';

const props = defineProps<{
  outfit: CharacterEquipmentOutfitInGame
  readonly?: boolean
}>();

const outfitData = ref<CharacterEquipmentOutfitInGame>(props.outfit);

const { unlocked: unlockedDecorate9 } = useDecorate9UnlockFlag();


watch(() => props.outfit, (newVal) => {
  outfitData.value = newVal;
});

const type = computed(() => {
  return props.outfit.type;
});

const decoratorParts = ['decorate1', 'decorate2', 'decorate3', 'decorate4', 'decorate5', 'decorate6', 'decorate7', 'decorate8', 'decorate9'] as const
const modifyPart = (part: CharacterEquipmentPart, itemId?: AllGameResourceID) => {
  if (itemId) {
    let oriItemId = getEquipmentActuralId(itemId)
    if (part.startsWith('decorate')) {
      // 检查对应饰品是否已经在其他槽位进行装备
      for (const decoratePart of decoratorParts) {
        if (!outfitData.value[decoratePart]) {
          continue;
        }

        let thisPartOriItemId = getEquipmentActuralId(outfitData.value[decoratePart]);
        if (decoratePart !== part && thisPartOriItemId === oriItemId) {
          ElMessage.error('该饰品已在其他槽位装备');
          return;
        }
      }
    }
  }

  outfitData.value[part] = itemId ?? "";
};


</script>

<style lang="scss" scoped>
.equipment-card {
  background: var(--el-bg-color, #f8fafc);
  //   border-radius: 16px;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);
  //   padding: 32px 24px 24px 24px;
  max-width: 540px;
  margin: 0 auto;
}

.equipment-tabs {
  --el-tabs-header-height: 48px;
}

.equipment-main-grid {
}

.equipment-decorate-grid {
}
</style>