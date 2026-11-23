import type { GameBuildingInfo } from "../types/building"

const buildingIdList = ["henhouse", "cowshed", "sheepfold", "workshop", "kitchen", "blacksmithShop", "textileWorkshop", "baseCattery", "baseCattery2", "mysteriousCabin", "miningShaft", "hotAirBalloon", "sericultureRoom", "pearlFarm", 'tavern'] as const

export const allGameBuilding: {
    [key in typeof buildingIdList[number]]: GameBuildingInfo
} = {
    henhouse: {
        id: 'henhouse',
        name: '鸡舍',
        icon: '🐔',
        description: '一个鸡舍，允许饲养小鸡🐤',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 1900
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },
    cowshed: {
        id: 'cowshed',
        name: '牛棚',
        icon: '🐄',
        description: '一个牛棚，允许饲养奶牛🐄',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 500
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },
    sheepfold: {
        id: 'sheepfold',
        name: '羊圈',
        icon: '🐑',
        description: '一个羊圈，允许饲养绵羊🐑',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 5000
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },

    sericultureRoom: {
        id: 'sericultureRoom',
        name: '蚕室',
        icon: 'resource:sericultureRoom',
        description: '一间恒温且设备齐全的蚕室，允许你饲养蚕宝宝',
        buildDuration: 900000,

        maxLevel: 1,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 5000
                },
                {
                    id: 'stone',
                    count: 1000,
                },
                {
                    id: 'bamboo',
                    count: 500,
                },
                {
                    id: 'cashmere',
                    count: 100
                }
            ]
        }
    },

    pearlFarm: {
        id: 'pearlFarm',
        name: '珍珠养殖场',
        icon: 'resource:pearlFarm',
        description: '一座清澈的水池养殖场，配备有过滤系统和温控设备，专门用于培育珍贵的珍珠蚌',
        buildDuration: 900000,

        maxLevel: 1,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 8000
                },
                {
                    id: 'stone',
                    count: 3000,
                },
                {
                    id: 'shell',
                    count: 1000,
                },
                {
                    id: 'fish',
                    count: 50,
                },
                {
                    id: 'sand',
                    count: 1000
                }
            ]
        }
    },

    workshop: {
        id: 'workshop',
        name: '工坊',
        icon: '🏭',
        description: '一个工坊，允许你进行一些基础制造工作',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 500
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },
    kitchen: {
        id: 'kitchen',
        name: '厨房',
        icon: '🍳',
        description: '一个设备齐全的厨房，可以制作各种美味的食物',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 800
                },
                {
                    id: 'stone',
                    count: 300
                }
            ]
        }
    },

    textileWorkshop: {
        id: 'textileWorkshop',
        name: '纺织工坊',
        icon: '🏠',
        description: '可以在这里进行纺织，制作布料与衣物', // 可爱的描述
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 3000
                },
                {
                    id: 'catHairball',
                    count: 300
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },

    blacksmithShop: {
        id: 'blacksmithShop',
        name: '铁匠铺',
        icon: '🏠',
        description: '可以在这里进行锻钢，制作武器与防具',
        buildDuration: 600000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 4000
                },
                {
                    id: 'catHairball',
                    count: 100
                },
                {
                    id: 'iron',
                    count: 200
                },
                {
                    id: 'stone',
                    count: 200
                }
            ]
        }
    },

    baseCattery: {
        id: 'baseCattery',
        name: '小猫舍',
        icon: '🐱',
        description: '建造一间小猫舍，允许你饲养小猫咪🐱',
        buildDuration: 1200000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 20000
                },
                {
                    id: 'catHairball',
                    count: 2000
                },
                {
                    id: 'stone',
                    count: 2000
                }
            ]
        }
    },
    baseCattery2: {
        id: 'baseCattery2',
        name: '小猫舍',
        icon: '🐱',
        description: '建造一间小猫舍，允许你饲养小猫咪🐱',
        buildDuration: 1200000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 200000
                },
                {
                    id: 'catHairball',
                    count: 20000
                },
                {
                    id: 'stone',
                    count: 20000
                }
            ]
        }
    },

    // baseCattery3: {
    //     id: 'baseCattery3',
    //     name: '小猫舍',
    //     icon: '🐱',
    //     description: '建造一间小猫舍，允许你饲养小猫咪🐱',
    //     buildDuration: 1200000,

    //     maxLevel: 10,

    //     buildRequirement: {
    //         resource: [
    //             {
    //                 id: 'wood',
    //                 count: 20000
    //             },
    //             {
    //                 id: 'catHairball',
    //                 count: 2000
    //             },
    //             {
    //                 id: 'stone',
    //                 count: 2000
    //             },
    //             {
    //                 id: 'genesisEssence',
    //                 count: 1000,
    //             },
    //             {
    //                 id: 'catStatue',
    //                 count: 100,
    //             }
    //         ]
    //     }
    // },

    mysteriousCabin: {
        id: 'mysteriousCabin',
        name: '神秘小屋',
        icon: '🛖',
        description: '一间神秘的小屋，配备有各种奇怪的设施，你可以在这里进行各种神秘的活动',
        buildDuration: 1200000,

        maxLevel: 10,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 10000
                },
                {
                    id: 'stone',
                    count: 2000
                },
                {
                    id: 'mysticalEssence',
                    count: 10
                },
                {
                    id: 'magicScroll',
                    count: 1
                }
            ]
        }
    },

    miningShaft: {
        id: 'miningShaft',
        name: '采矿井',
        icon: '⛏️',
        description: '一座机械配备齐全的矿井，允许你以较高效率挖掘矿石，并且能够挖掘深层的矿石',
        buildDuration: 60 * 1000 * 30,

        maxLevel: 11,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 5000
                },
                {
                    id: 'stone',
                    count: 3000
                },
                {
                    id: 'iron',
                    count: 500
                },
                {
                    id: 'ancientGear',
                    count: 15
                }
            ]
        }
    },

    hotAirBalloon: {
        id: 'hotAirBalloon',
        name: '热气球',
        icon: 'resource:hotAirBalloon',
        description: '一个热气球，能容纳多只小猫咪，你可以用它在云端进行各种活动',
        buildDuration: 60 * 1000 * 30,

        maxLevel: 11,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 400
                },
                {
                    id: 'sand',
                    count: 200
                },
                {
                    id: 'catHairball',
                    count: 1000
                },
                {
                    id: 'whiskerFeather',
                    count: 1000
                },
                {
                    id: 'plushFur',
                    count: 20
                }
            ]
        }
    },

    tavern: {
        id: 'tavern',
        name: '猫猫小酒馆',
        icon: '🍺',
        description: '一座自建的小酒馆，各行各业的专家都爱去酒馆休息',
        buildDuration: 1000,

        maxLevel: 1,

        buildRequirement: {
            resource: [
                {
                    id: 'wood',
                    count: 400
                },
                {
                    id: 'stone',
                    count: 200
                },
            ]
        }
    },
} as const