import type { Tavern } from "~/generated/prisma"
import type { CharacterInventory } from "./gameInventory"
import type { Quest } from "./quest"
import type { BattleRoom } from "./battleRoom"
import type { BattleInfo } from "./battle"
import type { AllGameActionDurationDetail, AllGameActionResourceRequirementDetail } from "./gameAction"
import type { CharacterEquipmentInfo, CharacterStatusInfo } from "./characterInfo"
import type { GameCharacterBattleSkillInfo } from "./skill"
import type { CharacterBuildingInfo } from "./building"
import type { UserKittyFurnitureInstance } from "./kittyFurniture"
import type { GameGuild } from "./guild"
import type { GameUserUniqueFlag } from "./gameEffect"
import type { GameUserCustomStyle } from "./style"
import type { BaseVillageBuildingInfo } from "./village/building"
import type { KittyExpeditionTeamInGame } from "./kittyExpedition"
import type { Kitty } from "./kitty"
import type { LearnedSkillFlatItem } from "./skillTree"

export type CharacterInitData = {
  inventory: CharacterInventory;
  tavern: Tavern[];
  quest: Quest[];

  isBeginner?: boolean;

  currentBattleRoom: BattleRoom | null;
  battleInfo?: BattleInfo | undefined;

  allGameActionDurationDetail: AllGameActionDurationDetail;
  allGameActionResourceRequirementDetail: AllGameActionResourceRequirementDetail;

  workEquipment: CharacterEquipmentInfo;
  battleEquipment: CharacterEquipmentInfo;

  skills: GameCharacterBattleSkillInfo[];
  building: CharacterBuildingInfo;
  kittyFurniture: UserKittyFurnitureInstance[];

  status: CharacterStatusInfo

  guild: GameGuild | null;

  userStyle: GameUserCustomStyle;

  villageBuildingInfo: BaseVillageBuildingInfo[]

  uniqueFlag: GameUserUniqueFlag[];
  sponsorPoint: {
    current: number;
    max: number;
  };

  kittyInfo: Kitty[]
  kittyExpedition: Record<string, KittyExpeditionTeamInGame | null>

  lastOnlineDate: Date,

  skillNodes: LearnedSkillFlatItem[]
  userPersonalization?: {
    favoriteItems: string[];
    categoryOrder: string[];
  }
};