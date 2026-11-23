<template>
    <div v-if="equipment" class="equipment-card py-2" >
        <div class="equipment-main-grid place-items-center gap-3 md:gap-7">
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.cloak">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.head">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="undefined">
            </GameCharacterEquipmentReadonlySlot>


            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.leftHand">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.body">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.rightHand">
            </GameCharacterEquipmentReadonlySlot>

            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.arm">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.leg">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.foot">
            </GameCharacterEquipmentReadonlySlot>
        </div>

        <template v-if="hasSpecialBattleEquipmentSlot">
          <el-divider class="my-4" content-position="center">特殊</el-divider>
          <div v-if="hasRightHand2" class="equipment-main-grid gap-3 md:gap-6 place-items-center">
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.rightHand2" />
          </div>
        </template>

        <el-divider class="my-4" content-position="center">饰品</el-divider>
        <div class="grid grid-cols-3  place-items-center gap-3 md:gap-4"
          :class="{
            'md:grid-cols-3': hasDecorate9,
            'md:grid-cols-4': !hasDecorate9,
          }">
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate1">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate2">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate3">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate4">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate5">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate6">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate7">
            </GameCharacterEquipmentReadonlySlot>
            <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate8">
            </GameCharacterEquipmentReadonlySlot>
            <template v-if="hasDecorate9">
              <GameCharacterEquipmentReadonlySlot :equipment="equipment" :part="CharacterEquipmentPart.decorate9">
              </GameCharacterEquipmentReadonlySlot>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { GameCharacterEquipmentReadonlySlot } from '#components';
import { emitGetOtherPlayerEquipment, onGetOtherPlayerEquipmentSuccess } from '~/api/game/socket/character';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';
import { CharacterEquipmentPart, type CharacterEquipmentInfo } from '~/shared/types/characterInfo';

const props = defineProps<{
    userUuid: string
}>()

const equipment = ref<CharacterEquipmentInfo>()

let unbind: FuncAction
onMounted(async () => {
    await waitUtilConnected()
    emitGetOtherPlayerEquipment(props.userUuid);

    unbind = onGetOtherPlayerEquipmentSuccess((data) => {
        equipment.value = data
    });
})

const hasDecorate9 = computed(() => {
  // 饰品1～9都有物品，则展示9个饰品槽位

  const decoratePosList = [
    equipment.value?.decorate1,
    equipment.value?.decorate2,
    equipment.value?.decorate3,
    equipment.value?.decorate4,
    equipment.value?.decorate5,
    equipment.value?.decorate6,
    equipment.value?.decorate7,
    equipment.value?.decorate8,
    equipment.value?.decorate9,
  ];

  return decoratePosList.every(pos => !!pos);
})

const hasSpecialBattleEquipmentSlot = computed(() => {
  return unref(hasRightHand2);
});

const hasRightHand2 = computed(() => {
  return !!equipment.value?.rightHand2;
});

onUnmounted(() => {
    if (unbind) {
        unbind();
    }
})

</script>

<style lang="scss" scoped>
.equipment-card {
  background: var(--el-bg-color, #f8fafc);
//   border-radius: 16px;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.06);
//   padding: 32px 24px 24px 24px;
  max-width: 540px;
  margin: 0 auto;
}

.equipment-tabs {
  --el-tabs-header-height: 48px;
}

.equipment-main-grid {
  display: grid;
  grid-template-columns: repeat(3, 72px);
  gap: 28px;
  justify-content: center;
  margin-bottom: 12px;
}
</style>