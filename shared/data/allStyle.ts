export const allBattleStyle = {
    // "default": "default",
    // "soldier": "soldier",
    // "shadow": "shadow",
    "": {
        value: '',
        name: '无',
        description: '',
    },
    'warrior': {
        value: 'warrior',
        name: '战士喵',
        description: '',
    },
    'magical': {
        value: 'magical',
        name: '魔法师喵',
        description: '',
    },
    'cleric': {
        value: 'cleric',
        name: '牧师喵',
        description: '',
    },
    'ninja': {
        value: 'ninja',
        name: '杀手喵',
        description: '',
    },
} as const


export const allProfileStyle = {
    "": {
        value: '',
        name: '无',
        description: '',
    },
    'wangzong': {
        value: 'wangzong',
        name: '王总',
        description: '',
    },
    'yixiao': {
        value: 'yixiao',
        name: 'yixiao',
        description: '',
    },
    'fishing_1': {
        value: 'fishing_1',
        name: '湖畔垂钓的猫咪',
        description: '',
    },
    'night_ninja_1': {
        value: 'night_ninja_1',
        name: '月下的浪人',
        description: '',
    },
    'cute_kitty_1': {
        value: 'cute_kitty_1',
        name: '玩耍中的小猫咪',
        description: '',
    }
} as const


export const allChatBubbleStyle = {
    "": {
        value: '',
        name: '无',
        description: '',
    },
    'cute_cat_1': {
        value: 'cute_cat_1',
        name: '闲趣小猫',
        description: '',
    },
    'cute_cat_2': {
        value: 'cute_cat_2',
        name: '猫咪乐园',
        description: '',
    },
    'dark_mag_1': {
        value: 'dark_mag_1',
        name: '暗月魔法',
        description: '',
    },
    'kitty_1': {
        value: 'kitty_1',
        name: '蝶结萌喵',
        description: '',
    },
    'moon_1': {
        value: 'moon_1',
        name: '月之魔咒',
        description: '',
    },
    'ninja_cat_1': {
        value: 'ninja_cat_1',
        name: '假面猫猫',
        description: '',
    },
    'star_1': {
        value: 'star_1',
        name: '星辉',
        description: '',
    },
} as const


export const allAvatarBorder: {
    [key: string]: {
        value: string;
        name: string;
        description: string;
        avatarScale?: number;
        borderScale?: number;
        offset?: {
            x?: number;
            y?: number;
        };
        isAnim?: boolean;
    }
} = {
    '': {
        value: '',
        name: '无',
        description: '',
    },
    // 'test': {
    //     value: 'test',
    //     name: '测试',
    //     description: '',
    //     avatarScale: 0.9,
    //     borderScale: 1.23 
    // },
    // 'test2': {
    //     value: 'test2',
    //     name: '测试2',
    //     description: '',
    //     avatarScale: 0.9,
    //     borderScale: 1.23 
    // },
    'kitty_head_1': {
        value: 'kitty_head_1',
        name: '铃动猫咪',
        description: '',
        avatarScale: 0.85,
        borderScale: 1.15 
    },
    'bunny_1': {
        value: 'bunny_1',
        name: '可爱小兔叽',
        description: '',
        avatarScale: 0.85,
        borderScale: 1.25 
    },

    'ghostBladeNebula': {
        value: 'ghostBladeNebula',
        name: '幽冥毒刃',
        description: '',
        avatarScale: 0.8,
        borderScale: 1.33
    },

    'mageKitty1': {
        value: 'mageKitty1',
        name: '星弦法师',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.43
    },

    'holyPawsGospel': {
        value: 'holyPawsGospel',
        name: '曦光福音',
        description: '',
        avatarScale: 0.85,
        borderScale: 1.23
    },

    'emberClaw': {
        value: 'emberClaw',
        name: '铁甲征服者',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.23
    },

    axeEnhanceMaster1: {
        value: 'axeEnhanceMaster1',
        name: '斧头强化大师',
        description: '',
        avatarScale: 0.8,
        borderScale: 1.23
    },
    cuteParty: {
        value: 'cuteParty',
        name: '萌宠派对',
        description: '',
        avatarScale: 1,
        borderScale: 1.1
    },
    kittyRing2: {
        value: 'kittyRing2',
        name: '萌铃喵喵',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.1
    },

    '20260203potato': {
        value: '20260203potato',
        name: '新鲜的薯条',
        description: '',
        avatarScale: 0.8,
        borderScale: 1.2,
        offset: {
            x: -1,
        }
    },

    meowQuest: {
        value: 'meowQuest',
        name: '喵将征途',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.15,
        offset: {
            x: -4,
        }
    },

    privateDetective: {
        value: 'privateDetective',
        name: '私家侦探',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.38,
    },


    catVillageOverseer_1: {
        value: 'catVillageOverseer_1',
        name: '猫猫村监管者',
        description: '',
        avatarScale: 1,
        borderScale: 1.28,
    },

    catVillageOverseer_2: {
        value: 'catVillageOverseer_2',
        name: '猫猫村风气监管员',
        description: '',
        avatarScale: 1,
        borderScale: 1.28,
    },

    SpringFestivalLuckyCat2026: {
        value: 'SpringFestivalLuckyCat2026',
        name: '新春招财猫',
        description: '',
        avatarScale: 1,
        borderScale: 1.30,
    },

    SpringFestival2026_1: {
        value: 'SpringFestival2026_1',
        name: '大战年兽',
        description: '',
        avatarScale: 1,
        borderScale: 1.35,
        offset: {
            x: -2,
        }
    },
    SpringFestival2026_12: {
        value: 'SpringFestival2026_12',
        name: '大战年兽！',
        description: '',
        avatarScale: 1.05,
        borderScale: 1.6,
        offset: {
            x: -5,
        },
        isAnim: true,
    },

    SpringFestival2026_LuckyHorseCat: {
        value: 'SpringFestival2026_LuckyHorseCat',
        name: '马上有钱',
        description: '',
        avatarScale: 1,
        borderScale: 1.35,
        offset: {
            x: -2,
        }
    },
    SpringFestival2026_LuckyHorseCat2: {
        value: 'SpringFestival2026_LuckyHorseCat2',
        name: '马上有钱！',
        description: '',
        avatarScale: 0.9,
        borderScale: 1.85,
        isAnim: true,
    },


    slumberCat: {
        value: 'slumberCat',
        name: '酣睡小猫',
        description: '',
        avatarScale: 0.8,
        borderScale: 1.65,
        isAnim: true,
    },

    catMercante: {
        value: 'catMercante',
        name: '行市猫商',
        description: '',
        avatarScale: 1,
        borderScale: 1.55,
        // offset: {
        //     x: -2,
        // },
        isAnim: true,
    }
} as const