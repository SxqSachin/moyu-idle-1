import type { GameEffectActionAboutStatus } from "../types/gameEffect";

export type GameTitle = {
    value: string;
    name: string;
    description: string;

    statusModifyEffect?: GameEffectActionAboutStatus[]
    enhanceExtraSuccessPercent?: number

    statusModifyEffectWhenInactive?: GameEffectActionAboutStatus[]

    specDescription?: string
}
export const allTitles = {
    '': {
        value: '',
        name: '',
        description: '',
    },
    'potato': {
        value: 'potato',
        name: '土豆见证者',
        description: '他看到了一个土豆从发芽、成长、成熟再到薯条的全过程',
    },
    'sponsor': {
        value: 'sponsor',
        name: '赞助者',
        description: '感谢您支持了这个项目的开发和维护',
    },
    'bugger_reporter': {
        value: 'bugger_reporter',
        name: '捉虫人',
        description: '感谢您反馈的bug，帮助游戏变得更稳定',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 1
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ]
    },
    // 'topBugPouncer': {
    //     value: 'topBugPouncer',
    //     name: '金牌捕虫人',
    //     description: '感谢您反馈的bug，帮助游戏变得更稳定',
    //     statusModifyEffect: [
    //         {
    //             status: 'luck',
    //             increase: 1.5
    //         }
    //     ],
    //     statusModifyEffectWhenInactive: [
    //         {
    //             status: 'luck',
    //             increase: 0.2
    //         }
    //     ]
    // },
    'idea_reporter': {
        value: 'idea_reporter',
        name: '点子王',
        description: '感谢您提供的创意建议，帮助游戏不断进步',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 1
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ]
    },
    'idea_reporter_a': {
        value: 'idea_reporter_a',
        name: '点子王中王',
        description: '感谢您提供的绝妙创意，帮助游戏不断进步',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 2
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },
    'idea_reporter_b': {
        value: 'idea_reporter_b',
        name: '点子王中王中王',
        description: '感谢您提供的中肯建议，帮助游戏不断进步',
    },
    'veteran': {
        value: 'veteran',
        name: '元老级人物',
        description: ' 见证了游戏的成长与变迁，是最忠实的陪伴者之一',
    },
    'betaCheater': {
        value: 'betaCheater',
        name: '封弊者',
        description: ' 既懂规则又敢于突破极限的先行者',
    },
    'test': {
        value: 'test',
        name: 'test',
        description: '',
    },
    'cheater': {
        value: 'cheater',
        name: '作弊者',
        description: '',
    },
    'banned': {
        value: 'banned',
        name: '已封禁',
        description: '',
    },
    'honest_cat': {
        value: 'honest_cat',
        name: '诚实小猫',
        description: '大家心中的小天使',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 1
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ]
    },
    'sunbeam_keeper': {
        value: 'sunbeam_keeper',
        name: '阳光窗台的主人',
        description: '占据了城堡中最温暖的那扇窗台，享受着专属的午后阳光',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },
    'catnip_aristocrat': {
        value: 'catnip_aristocrat',
        name: '薄荷贵族',
        description: '猫薄荷花园的拥有者，坐拥猫界最珍贵的资源',
    },
    'chaojiwangzong': {
        value: 'chaojiwangzong',
        name: '超级王总',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },
    'enhance_expert_a': {
        value: 'enhance_expert_a',
        name: '强化大师',
        description: '强化的一把好手',
    },
    'collection_expert_a': {
        value: 'collection_expert_a',
        name: '采集大师',
        description: '采集的一把好手',
    },
    'farming_animal_expert_a': {
        value: 'farming_animal_expert_a',
        name: '畜牧大师',
        description: '畜牧的一把好手',
    },
    'mysterious_expert_a': {
        value: 'mysterious_expert_a',
        name: '神秘大师',
        description: '非常神秘',
    },
    'wish_upon_star': {
        value: 'wish_upon_star',
        name: '向星星许愿',
        description: '在无垠的夜空下默默许下心愿，把希望寄托给星辰——温柔且坚定的梦想守护者。',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },

    'hllbcl': {
        value: 'hllbcl',
        name: '贤良淑德秀外慧中沉鱼落雁闭月羞花宇宙无敌霹雳烈焰狐狸狸',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },

    'momono_1': {
        value: 'momono_1',
        name: '进本躺平求别踢乖巧听话会喊666能提供情绪价值(○´･д･)ﾉ',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },

    'hopeful_heart': {
        value: 'hopeful_heart',
        name: '满怀希望',
        description: '即使一无所获，也从不放弃。',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 2
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 1
            }
        ]
    },
    'unlucky_legend': {
        value: 'unlucky_legend',
        name: '倒霉传说猫',
        description: '因运气太差反而成了传奇。',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 1.5
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ],
        enhanceExtraSuccessPercent: 0.02,
        specDescription: '强化成功率额外提升 2%'
    },
    'meow_prophet': {
        value: 'meow_prophet',
        name: '喵言先知',
        description: '能听懂命运的小碎语，也敢对它发牢骚。',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 1
            },
            {
                status: 'knowledge',
                increase: 5
            },
            {
                status: 'mysterious',
                increase: 5
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ],
        enhanceExtraSuccessPercent: 0.01,
        specDescription: '强化成功率额外提升 1%'
    },
    'eternal_luck': {
        value: 'eternal_luck',
        name: '幸运星',
        description: '幸运似乎已经成了你的呼吸节奏。',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ],
    },

    't_warrior': {
        value: 't_warrior',
        name: '守护先锋喵',
        description: '以盾为城，以刃破阵；钢铁意志从不后退。',
        statusModifyEffect: [
            {
                status: 'stamina',
                increase: 30
            },
            {
                status: 'strength',
                increase: 15
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'stamina',
                increase: 10
            },
            {
                status: 'strength',
                increase: 5
            }
        ],
    },
    't_mage': {
        value: 't_mage',
        name: '学者喵',
        description: '借群星之辉执笔，改写战局的秘法书页。',
        statusModifyEffect: [
            {
                status: 'intelligence',
                increase: 45
            },
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'intelligence',
                increase: 15
            }
        ]
    },
    't_berserker': {
        value: 't_berserker',
        name: '热血爪爪',
        description: '伤痕是勋章，怒火为战歌，破阵如摧枯拉朽。',
        statusModifyEffect: [
            {
                status: 'strength',
                increase: 25
            },
            {
                status: 'dexterity',
                increase: 15
            },
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'strength',
                increase: 10
            },
            {
                status: 'dexterity',
                increase: 5
            },
        ]
    },
    't_assassin': {
        value: 't_assassin',
        name: '轻影喵喵',
        description: '影与刃同归一体，胜负在呼吸间定夺。',
        statusModifyEffect: [
            {
                status: 'dexterity',
                increase: 45
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'dexterity',
                increase: 15
            },
        ]
    },

    't_archer': {
        value: 't_archer',
        name: '逐风喵喵',
        description: '风为弦，星为靶，一箭定乾坤。',
        statusModifyEffect: [
            {
                status: 'strength',
                increase: 15
            },
            {
                status: 'dexterity',
                increase: 25
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'strength',
                increase: 5
            },
            {
                status: 'dexterity',
                increase: 10
            }
        ]
    },


    'worldBossKiller_tester': {
        value: 'worldBossKiller_tester',
        name: '“麻烦扫除者”',
        description: '有啥我搞不定的～',
        statusModifyEffect: [
            {
                status: 'attacking',
                increase: 20
            },
            {
                status: 'defencing',
                increase: 20
            },
            {
                status: 'strength',
                increase: 20
            },
            {
                status: 'dexterity',
                increase: 20
            },
            {
                status: 'intelligence',
                increase: 20
            },
            {
                status: 'stamina',
                increase: 20
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'attacking',
                increase: 10
            },
            {
                status: 'defencing',
                increase: 10
            },
            {
                status: 'strength',
                increase: 10
            },
            {
                status: 'dexterity',
                increase: 10
            },
            {
                status: 'intelligence',
                increase: 10
            },
            {
                status: 'stamina',
                increase: 10
            }
        ]
    },

    't_xzuo': {
        value: 't_xzuo',
        name: '逍遥自在',
        description: '逍遥自在',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]
    },
    't_cjmydw': {
        value: 't_cjmydw',
        name: '每天准时上班摸鱼的',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]

    },

    't_youyouzale': {
        value: 't_youyouzale',
        name: 'YouMeow',
        description: 'YouMeow的专属称号',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]

    },

    // 不吃鱼的猫
    'communityEnvoy': {
        value: 'communityEnvoy',
        name: '流光信使',
        description: '流光信使',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.2
            }
        ]

    },

    'primeMentor': {
        value: 'primeMentor',
        name: '暖心守望',
        description: '为新人亮起的一盏灯',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 2
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ]

    },

    'enhance_master_axe_1': {
        value: 'enhance_master_axe_1',
        name: '强化大师',
        description: '强化大师',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 2
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ],
        enhanceExtraSuccessPercent: 0.021,
        specDescription: '强化成功率额外提升 2.1%'
    },

    'ultimateApexBlade': {
        value: 'ultimateApexBlade',
        name: '永恒闪耀的圣剑',
        description: '永恒闪耀的圣剑',
        statusModifyEffect: [
            {
                status: 'attacking',
                increase: 50
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'attacking',
                increase: 25
            }
        ],
    },

    'catVillageOverseer_1': {
        value: 'catVillageOverseer_1',
        name: '猫猫村监督者',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ],
    },
    'catVillageOverseer_2': {
        value: 'catVillageOverseer_2',
        name: '猫猫村风气监督员',
        description: '',
        statusModifyEffect: [
            {
                status: 'luck',
                increase: 3
            }
        ],
        statusModifyEffectWhenInactive: [
            {
                status: 'luck',
                increase: 0.1
            }
        ],
    },
} as const satisfies Record<string, GameTitle>;