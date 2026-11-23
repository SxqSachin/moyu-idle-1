import allFishSpeciesJSON from '~/assets/resource/allFishSpecies.json'
import type { FishSpecies } from '../types/fishing';
import { ObjectKeysTyped } from '../utils';

export const allFishSpeciesIds = ObjectKeysTyped(allFishSpeciesJSON);

export const allFishSpecies: {[key in typeof allFishSpeciesIds[number]]: FishSpecies} = allFishSpeciesJSON as any;

export type AllFishSpeciesID = keyof typeof allFishSpecies;

export const FishSpeciesRarityMap = {
    0: {
        id: 'common',
        name: '普通'
    },
    1: {
        id: 'uncommon',
        name: '罕见'
    },
    2: {
        id: 'rare',
        name: '稀有'
    },
    3: {
        id: 'epic',
        name: '史诗'
    },
    4: {
        id: 'legendary',
        name: '传说'
    }
}

export const FishSpeciesQualityMap = {
    0: {
        id: 'poor',
        name: '劣质'
    },
    1: {
        id: 'normal',
        name: '普通'
    },
    2: {
        id: 'good',
        name: '优质'
    },
    3: {
        id: 'excellent',
        name: '极佳'
    },
    4: {
        id: 'masterpiece',
        name: '杰作'
    }
}