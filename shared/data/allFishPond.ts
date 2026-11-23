import type { FishPond } from "../types/fishing";

export const allFishPond = {
  // 后山湖
  backMountainLake: {
    id: "backMountainLake",

    groundWidth: 4000,
    groundHeight: 3000,
    pondWidth: 4000 * 0.8,
    pondHeight: 3000 * 0.8,

    name: "后山湖",
    fishConfig: [
      { speciesId: "rareThing", weight: 2 },
      { speciesId: "randomThing", weight: 30 },
      { speciesId: "fish", weight: 30 },
      { speciesId: "salmon", weight: 30 },
      { speciesId: "tuna", weight: 30 },

      { speciesId: "rareCatfish", weight: 20 },
      { speciesId: "mysticalKoi", weight: 20 },
      { speciesId: "jadeTuna", weight: 30 },
      { speciesId: "emberEel", weight: 30 },
      { speciesId: "moonlightShrimp", weight: 30 },
      { speciesId: "crystalCarp", weight: 30 },
      { speciesId: "rainbowFish", weight: 20 },
      { speciesId: "darkFish", weight: 20 },
      { speciesId: "fatFish", weight: 20 },
      { speciesId: "flashFish", weight: 20 },

      { speciesId: "carp_common", weight: 10 },
      { speciesId: "carp_big", weight: 10 },
      { speciesId: "trout_mountain", weight: 10 },
      { speciesId: "catfish_night", weight: 10 },
      { speciesId: "golden_tetra", weight: 5 },
      { speciesId: "eel_electric", weight: 5 },
      { speciesId: "koi_ornamental", weight: 5 },
      { speciesId: "puffer_toxic", weight: 5 },
    ],
  },
} as const satisfies Record<string, FishPond>;

export type AllFishPondID = keyof typeof allFishPond;