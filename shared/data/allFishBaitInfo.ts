import allFishingBaitsInfo from '~/assets/resource/allFishingBaits.json'
import type { FishBaitInfo } from "../types/fishing";
import { ObjectKeysTyped } from '../utils';

export const allFishingBaitIds = ObjectKeysTyped(allFishingBaitsInfo);

export const allFishingBaits: {[key in typeof allFishingBaitIds[number]]: FishBaitInfo} = allFishingBaitsInfo as any;

export type AllFishingBaitId = keyof typeof allFishingBaits;