import type { AllKittyFurnitureID } from "../data/allKittyFurniture";
import type { ActionRequirement, GameActionResourceRequirementDetail } from "./gameAction";

export interface KittyFurniture {
    id: string;
    name: string;
    description: string;

    icon: string;

    maxLevel: number;

    effectDescription: string[];

    durability: number;
    durabilityLossPerHour: number; // 每小时损耗的耐久度，默认1

    installRequirement: ActionRequirement[]
    repairRequirement: ActionRequirement[];

    hasConfig?: boolean;
}

export interface UserKittyFurnitureInstance {
  id: number;
  uuid: string;
  userUuid: string;
  furnitureId: AllKittyFurnitureID;
  level: number;
  durability: number;
  isActive: boolean;
  installedAt: Date;
  updatedAt: Date;
  config: any
}