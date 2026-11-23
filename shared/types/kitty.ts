import type { AllGameActionID, GameActionReward } from "./gameAction"

export type Kitty = {
    uuid: string
    owner: string

    name: string

    satiety: number
    maxSatiety: number

    mood: number
    maxMood: number

    actionId: string

    isWorking: boolean

    isInExpedition?: boolean // 是否在探险中
    traits?: KittyTraitInstance[]
}

/**
 * Kitty Trait types
 * - KittyTrait defines a trait (id, name, description and callbacks)
 * - KittyTraitInstance is what is stored/applied on a particular kitty (trait id + optional level/params)
 */
export type AllKittyTraitId = string

export type KittyTraitCallbackParam = {
    kittyUuid: string
    kittyName: string
    owner: string

   traitLevel: number 

    requestDecreaseMood?: (kittyUuid: string, val: number, reason: string) => Promise<void>;
    requestIncreaseMood?: (kittyUuid: string, val: number, reason: string) => Promise<void>;
}

export type KittyTrait = {
  id: AllKittyTraitId;
  name: string;
  /**
   * Human readable description. Can be a static string or a function accepting context
   * (for example current level) and returning a string. Use this to show dynamic descriptions.
   */
  description?: string | ((ctx: { level?: number }) => string);

  // passive numeric modifiers (optional)
  extraActionDurationDecrease?: (
    param: { actionId: string; oriDuration: number } & KittyTraitCallbackParam
  ) => number;

  onModifyMood?: (
    param: { old: number; delta: number } & KittyTraitCallbackParam
  ) => {
    extraDelta: number;
  };
  onEncounter?: (
    param: {
      targetKittyUuid: string;
    } & KittyTraitCallbackParam
  ) => Promise<void>;

  // additional reward provider when an action finishes
  actionExtraReward?: (
    param: {
      actionId: AllGameActionID;
      oriReward: Readonly<GameActionReward[]>;
    } & KittyTraitCallbackParam
  ) => Readonly<GameActionReward[]> | null;
  extraRewardOnActionFinishPercent?: (
    param: { actionId: AllGameActionID } & KittyTraitCallbackParam
  ) => number;
  extraReturnTaskUsedResourcePercent?: (
    param: { actionId: AllGameActionID } & KittyTraitCallbackParam
  ) => number;

  // human-friendly tags to classify trait (ui, filters)
  tags?: string[];

  // whether trait can be stacked/multiple levels
  stackable?: boolean;

  // function to get required exp to upgrade from `level` -> `level+1`.
  // If omitted, trait is treated as non-upgradeable.
  upgradeExp?: (level: number) => number;

  // maximum level allowed for this trait; if omitted callers may assume a default (e.g. 5)
  maxLevel: number;
  /**
   * Effect type: whether this trait is primarily a buff, debuff, or both.
   * UI can use this to display tag/coloring.
   */
  effectType?: 'buff' | 'debuff' | 'both';
};

export type KittyTraitInstance = {
    traitId: AllKittyTraitId
    // level or count, if trait is stackable
    level?: number
    // current xp in this level; when reaches required exp, level can increase
    currentExp?: number
}

export type KittyTraitRow = {
  id: number
  uuid: string
  kittyUuid: string
  traitId: string
  level: number
  currentExp: number
}

// (traits are embedded in the Kitty type above)