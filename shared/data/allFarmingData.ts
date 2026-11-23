import type { AllGameResourceID } from "../types/gameResource";
import type { CropDefinition, FertilizerDefinition, SeedPlantingConfig } from "../types/farming";

import allFarmingDefsJson from "~/assets/resource/allFarmingDefinitions.json";

type FarmingDefsJson = {
  crops?: CropDefinition[];
  fertilizers?: FertilizerDefinition[];
};

const defs = (allFarmingDefsJson as unknown as FarmingDefsJson) || {};

// Deep freeze helper to prevent runtime mutation
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === 'object') {
    const propNames = Object.getOwnPropertyNames(obj as object);
    for (const name of propNames) {
      const value: any = (obj as any)[name];
      if (value && typeof value === 'object') {
        deepFreeze(value);
      }
    }
    return Object.freeze(obj) as Readonly<T>;
  }
  return obj as Readonly<T>;
}

// Convert array of CropDefinition into a map: seedId -> SeedPlantingConfig
export const allFarmingData: Readonly<{ [K in AllGameResourceID]?: Readonly<SeedPlantingConfig> }> = (() => {
  const map = {} as { [K in AllGameResourceID]?: Readonly<SeedPlantingConfig> };
  for (const c of defs.crops ?? []) {
    const seedId = c.seedId as AllGameResourceID;
    const cfg: SeedPlantingConfig = {
      seedId,
      yields: c.yields || [],
      mutationYields: c.mutationYields || undefined,
      fertilizable: !!c.fertilizable,
      fertilizerIds: c.fertilizerIds || undefined,
      baseGrowthSeconds: c.baseGrowthSeconds,
      baseMutationChance: c.baseMutationChance,
      plantCost: c.plantCost || [],
      farmingPlantLevelRequired: c.farmingPlantLevelRequired,
      farmingPlantExpGainWhenHarvest: c.farmingPlantExpGainWhenHarvest,
    };
    map[seedId] = deepFreeze(cfg);
  }
  return deepFreeze(map);
})();

// Convert array of FertilizerDefinition into a map: id -> FertilizerDefinition
export const allFertilizer: Readonly<{ [K in AllGameResourceID]?: Readonly<FertilizerDefinition> }> = (() => {
  const map = {} as { [K in AllGameResourceID]?: Readonly<FertilizerDefinition> };
  for (const f of defs.fertilizers ?? []) {
    const id = f.id as AllGameResourceID;
    map[id] = deepFreeze(f);
  }
  return deepFreeze(map);
})();

export type AllFarmingSeedId = keyof typeof allFarmingData;
export type AllFertilizerId = keyof typeof allFertilizer;
