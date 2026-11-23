import { computed } from "vue"
import { allCharacterDefaultEquipmentPart, allCharacterEquipmentPart, CharacterEquipmentPart } from "~/shared/types/characterInfo"
import { useLearnedSkillNodes } from "./useLearnedSkillNodes"
import { useUniqueFlag } from "./useUniqueFlag"
import { allSkillTreeNodeMap } from "~/shared/data/skillTrees"

export const useEnabledBattleEquipmentSlots = () => {
  const { allLearned } = useLearnedSkillNodes({ treeIdFilter: "battle" });
  const uniqueKey = useUniqueFlag();

  const enabledSlots = computed<CharacterEquipmentPart[]>(() => {
    const unlockDecorate9 = uniqueKey.value.find(
      (u) => u.key === "unlock_9" && u.type === "decorate_unlock"
    );

    const enabledSlotsFromSkillNodes: Set<CharacterEquipmentPart> = new Set();
    const disabledSlotsFromSkillNodes: Set<CharacterEquipmentPart> = new Set();

    const defaultEnabledSlots: Readonly<CharacterEquipmentPart[]> =
      allCharacterDefaultEquipmentPart;

    for (const nodeInfo of allLearned.value) {
      const nodeId = nodeInfo.nodeId;
      const node = allSkillTreeNodeMap[nodeId];
      if (!node) continue;

      if (node.enableBattleEquipSlot?.length) {
        for (const slot of node.enableBattleEquipSlot) {
          enabledSlotsFromSkillNodes.add(slot);
        }
      }
      if (node.disableBattleEquipSlot?.length) {
        for (const slot of node.disableBattleEquipSlot) {
          disabledSlotsFromSkillNodes.add(slot);
        }
      }
    }

    const finalEnabledSlots: CharacterEquipmentPart[] = [];

    for (const slot of allCharacterEquipmentPart) {
      const isEnabledByDefault = defaultEnabledSlots.includes(slot);
      const isEnabledBySkillNode = enabledSlotsFromSkillNodes.has(slot);
      const isDisabledBySkillNode = disabledSlotsFromSkillNodes.has(slot);

      if ((isEnabledByDefault || isEnabledBySkillNode) && !isDisabledBySkillNode) {
        finalEnabledSlots.push(slot);
      }
    }

    if (unlockDecorate9 && !finalEnabledSlots.includes(CharacterEquipmentPart.decorate9)) {
      finalEnabledSlots.push(CharacterEquipmentPart.decorate9);
    }
    return finalEnabledSlots;
  });

  const disabledSlots = computed<CharacterEquipmentPart[]>(() => {
    return allCharacterEquipmentPart.filter(
      (slot) => !enabledSlots.value.includes(slot)
    );
  })

  return {
    enabledSlots,
    disabledSlots
  };
};