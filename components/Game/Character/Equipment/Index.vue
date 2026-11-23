<template>
  <el-card class="equipment-card py-2" shadow="hover" body-class="pt-0!">
    <el-tabs v-model="equipmentTypeActiveTab" class="equipment-tabs">
      <el-tab-pane label="生活" :lazy="true" name="work">
        <div class="equipment-main-grid gap-3 md:gap-6 place-items-center">
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.cloak" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.head" />
          <GameCharacterEquipmentSlot type="work" :part="undefined" />

          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.leftHand" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.body" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.rightHand" />

          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.arm" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.leg" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.foot" />
        </div>
        <el-divider class="my-4" content-position="center">饰品</el-divider>
        <div class="grid grid-cols-3 justify-center gap-3 md:gap-4 place-items-center" :class="{
          'md:grid-cols-3': unlockedDecorate9,
          'md:grid-cols-4': !unlockedDecorate9,
        }">
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate1" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate2" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate3" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate4" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate5" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate6" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate7" />
          <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate8" />
          <template v-if="unlockedDecorate9">
            <GameCharacterEquipmentSlot type="work" :part="CharacterEquipmentPart.decorate9" />
          </template>
        </div>
      </el-tab-pane>
      <el-tab-pane label="战斗" :lazy="true" name="battle">
        <div class="equipment-main-grid gap-3 md:gap-6 place-items-center">
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.cloak) ? undefined : CharacterEquipmentPart.cloak" />
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.head) ? undefined : CharacterEquipmentPart.head" />
          <GameCharacterEquipmentSlot type="battle" :part="undefined" />

          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.leftHand) ? undefined : CharacterEquipmentPart.leftHand" />
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.body) ? undefined : CharacterEquipmentPart.body" />
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.rightHand) ? undefined : CharacterEquipmentPart.rightHand" />

          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.arm) ? undefined : CharacterEquipmentPart.arm" />
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.leg) ? undefined : CharacterEquipmentPart.leg" />
          <GameCharacterEquipmentSlot type="battle" :part="disabledSlots.includes(CharacterEquipmentPart.foot) ? undefined : CharacterEquipmentPart.foot" />
        </div>
        <template v-if="hasSpecialBattleEquipmentSlot">
          <el-divider class="my-4" content-position="center">特殊</el-divider>
          <div class="equipment-main-grid gap-3 md:gap-6 place-items-center">
            <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.rightHand2" />
          </div>
        </template>
        <el-divider class="my-4" content-position="center">饰品</el-divider>
        <div class="grid grid-cols-3 justify-center gap-3 md:gap-4 place-items-center" :class="{
          'md:grid-cols-3': unlockedDecorate9,
          'md:grid-cols-4': !unlockedDecorate9,
        }">
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate1" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate2" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate3" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate4" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate5" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate6" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate7" />
          <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate8" />
          <template v-if="unlockedDecorate9">
            <GameCharacterEquipmentSlot type="battle" :part="CharacterEquipmentPart.decorate9" />
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { GameCharacterEquipmentSlot } from '#components';
import { useEnabledBattleEquipmentSlots } from '~/composables/game/useEnabledBattleEquipmentSlots';
import { useDecorate9UnlockFlag } from '~/composables/game/useUniqueFlag';
import { CharacterEquipmentPart } from '~/shared/types/characterInfo';

const equipmentTypeActiveTab = ref<'work' | 'battle'>('work');

const { unlocked: unlockedDecorate9 } = useDecorate9UnlockFlag();
const { enabledSlots, disabledSlots } = useEnabledBattleEquipmentSlots();

const hasSpecialBattleEquipmentSlot = computed(() => {
  return unref(hasRightHand2);
});

const hasRightHand2 = computed(() => {
  return !!enabledSlots.value.includes(CharacterEquipmentPart.rightHand2);
});

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
  display: grid;
  grid-template-columns: repeat(3, 72px);
  // gap: 28px;
  justify-content: center;
  margin-bottom: 12px;
  justify-items: center; // 让每一项水平居中
}
</style>