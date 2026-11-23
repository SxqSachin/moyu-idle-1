import type { GameEffectAction } from "../types/gameEffect";

export const newIncreaseSatietyAction = (value: number): GameEffectAction => {
  return {
    name: "增加饱腹度",
    isBuff: true,
    resourceEffect: [
      {
        resource: "__satiety",
        increase: value,
      },
    ],
  };
};
