import type { UnitStatusDesc, CharacterStatusInfo, AllCharacterStatusType, CharacterStatusDetail, AllBaseCharacterStatusType } from "../types/characterInfo"
import { ATTACK_PER_BATTLE_LEVEL, ATTACK_PER_STRENG_LEVEL, DEFENCE_PER_BATTLE_LEVEL, ENHANCE_PERCENT_MODIFY_PER_LEVEL, EXTRA_ACTION_REWARD_PERCENT_PER_LUCK, EXTRA_DROP_PERCENT_PER_LUCK, EXTRA_ENHANCE_PERCENT_PER_LUCK, HP_REGEN_PER_TURN_PRE_STAMINA, MP_REGEN_PER_TURN_PRE_INTELLIGENCE } from "./constant"

export const allWorkStatus = [
    'farmingPlant',
    'collecting',
    'fishing',
    'mining',
    'farmingAnimal',
    'cooking',
    'forging',
    'sewing',
    'manufacturing',
    'trading',
    'knowledge',
    'mysterious',
    'enhance',
    'exploring',
    'luck'
] as const satisfies AllBaseCharacterStatusType[] 

export const allBattleStatus = [
    'battle',
    'attacking',
    'defencing',
    'strength',
    'dexterity',
    'intelligence',
    'stamina'
] as const satisfies AllBaseCharacterStatusType[]

// @ts-expect-error
export const allCharacterStatus: {
    [key in AllCharacterStatusType]: UnitStatusDesc
} = {
    farmingPlant: {
        id: "farmingPlant",
        name: "种植",
        description: "种植和收获农作物。",
        icon: "🌱"
    },
    collecting: {
        id: "collecting",
        name: "采集",
        description: "采集自然资源，如木材、草药等。",
        icon: "👋"
    },
    fishing: {
        id: "fishing",
        name: "钓鱼",
        description: "钓鱼。",
        icon: "🎣"
    },
    mining: {
        id: "mining",
        name: "挖掘",
        description: "挖掘矿石和其他地下资源。",
        icon: "⛏️"
    },
    farmingAnimal: {
        id: "farmingAnimal",
        name: "畜牧",
        description: "饲养和管理动物，获取肉类、奶制品等。",
        icon: "🐄"
    },
    cooking: {
        id: "cooking",
        name: "烹饪",
        description: "制作和加工食物，提高食物品质。",
        icon: "🍳"
    },
    forging: {
        id: "forging",
        name: "锻造",
        description: "锻造材料和装备。",
        icon: "🔨"
    },
    sewing: {
        id: "sewing",
        name: "缝纫",
        description: "制作衣服和其他材料。",
        icon: "👔"
    },
    manufacturing: {
        id: "manufacturing",
        name: "制造",
        description: "加工原材料，制造工具和装备。",
        icon: "⚒️"
    },
    trading: {
        id: "trading",
        name: "交易",
        description: "与他人进行物品交换和买卖。",
        icon: "💱"
    },
    mysterious: {
        id: "mysterious",
        name: "神秘",
        description: "天知道小猫咪从哪里了解到这些的。",
        icon: "🧙‍♀️"
    },
    enhance: {
        id: "enhance",
        name: "强化",
        description: "小猫咪怎么什么都懂啊。",
        icon: "⬆️",
        levelDesc: `每提升1级，给予${ENHANCE_PERCENT_MODIFY_PER_LEVEL * 100}强化成功率`,
        calc: (info: CharacterStatusDetail) => {
            let enhanceExtraPercent = ((info.final ?? 0) * ENHANCE_PERCENT_MODIFY_PER_LEVEL * 100).toFixed(2)

            return {
                '强化基础成功率': `${enhanceExtraPercent}% (+${enhanceExtraPercent}%)`,
            }
        }
    },
    knowledge: {
        id: "knowledge",
        name: "学识",
        description: "学习新知识，提高技能水平。",
        icon: "📚"
    },
    exploring: {
        id: "exploring",
        name: "探索",
        description: "探索未知区域，发现新资源。",
        icon: "🧭"
    },
    luck: {
        id: "luck",
        name: "幸运",
        description: "你的运势。",
        icon: "🍀",
        levelDesc: `每提升1级，基础强化成功率提升${EXTRA_ENHANCE_PERCENT_PER_LUCK * 100}%；通过动作获得物品的概率提升${EXTRA_ACTION_REWARD_PERCENT_PER_LUCK * 100}%；战利品掉落率提升${EXTRA_DROP_PERCENT_PER_LUCK * 100}%`,
        calc: (info: CharacterStatusDetail) => {
            let enhanceExtraPercent = +(((info.final ?? 1) - 1) * EXTRA_ENHANCE_PERCENT_PER_LUCK * 100).toFixed(2)
            let actionReward = +(((info.final ?? 1) - 1) * EXTRA_ACTION_REWARD_PERCENT_PER_LUCK * 100).toFixed(2)
            let dropPercent = +(((info.final ?? 1) - 1) * EXTRA_DROP_PERCENT_PER_LUCK * 100).toFixed(2)

            return {
            '强化基础成功率': `${enhanceExtraPercent}% (+${enhanceExtraPercent}%)`,
            '通过动作获得物品的概率': `${actionReward}% (*${100 + actionReward}%)`,
            '战利品掉落率': `${dropPercent}% (*${100 + dropPercent}%)`
            }
        }
    },

    battle: {
        id: "battle",
        name: "战斗",
        description: "猫猫在冒险中磨炼出的战斗技巧，决定了它在危险时刻的勇气与反应。",
        icon: "🤺",
        levelDesc: `每提升1级，给予${ATTACK_PER_BATTLE_LEVEL}的攻击、${DEFENCE_PER_BATTLE_LEVEL}的防御(仅在战斗内显示)`,
        calc: (info: CharacterStatusDetail) => ({
            '攻击': (info.final ?? 0) * ATTACK_PER_BATTLE_LEVEL,
            '防御': (info.final ?? 0) * DEFENCE_PER_BATTLE_LEVEL
        })
    },
    strength: {
        id: "strength",
        name: "力量",
        description: "提升角色的物理攻击和负重能力。",
        icon: "💪",
        levelDesc: `每提升1级，给予${ATTACK_PER_STRENG_LEVEL}的攻击(仅在战斗内显示)`,
        calc: (info: CharacterStatusDetail) => ({
            '攻击': (info.final ?? 0) * ATTACK_PER_STRENG_LEVEL
        })
    },
    dexterity: {
        id: "dexterity",
        name: "敏捷",
        description: "提升角色的速度和灵活性。",
        icon: "🤸"
    },
    intelligence: {
        id: "intelligence",
        name: "智力",
        description: "提升角色的学习和魔法能力。",
        icon: "🧠",
        levelDesc: `每提升1级，提升5点最大魔法值，每回合开始时回复${MP_REGEN_PER_TURN_PRE_INTELLIGENCE}魔法值`,
        calc: (info: CharacterStatusDetail) => ({
            '最大魔法值': (info.final ?? 0) * 5,
            '魔法值恢复': (info.final ?? 0) * MP_REGEN_PER_TURN_PRE_INTELLIGENCE
        })
    },
    stamina: {
        id: "stamina",
        name: "耐力",
        description: "提升角色的生命值。",
        icon: "🏃",
        levelDesc: `每提升1级，每点提升5点最大生命值，每回合开始时回复${HP_REGEN_PER_TURN_PRE_STAMINA}生命值`,
        calc: (info: CharacterStatusDetail) => ({
            '最大生命值': (info.final ?? 0) * 5,
            '生命值恢复': (info.final ?? 0) * HP_REGEN_PER_TURN_PRE_STAMINA
        })
    },
    attacking: {
        id: "attacking",
        name: "攻击",
        description: "提升角色的攻击能力。",
        icon: "⚔️"
    },
    defencing: {
        id: "defencing",
        name: "防御",
        description: "提升角色的防御能力。",
        icon: "🛡️",
        calc: (info: CharacterStatusDetail) => {
            let effectiveDefence = info.final ?? 0;

            // 伤害减免比例 = (0.0065 * 有效防御) / (1 + 0.0065 * 有效防御)
            let damageReductionRatio = (0.0065 * effectiveDefence) / (1 + 0.0065 * effectiveDefence);

            // 有效防御 < 0 时，伤害增幅 = 1 - |(0.0065 * 有效防御) / (1 - 0.0065 * 有效防御}|
            if (effectiveDefence < 0) {
                damageReductionRatio =  -Math.abs((0.0065 * effectiveDefence) / (1 - 0.0065 * effectiveDefence));
            }
            return {
                '伤害减免': (damageReductionRatio * 100).toFixed(2) + `%`,
            }
        }
    }
} as const


export const internalCharacterStatus = {
    hp: {
        id: "hp",
        name: "生命值",
        description: "提升角色的生命值。",
        icon: "️❤️"
    },
    mp: {
        id: "mp",
        name: "魔法值",
        description: "提升角色的魔法值。",
        icon: "🪄"
    }
} as const

export const allCharacterStatusType: AllCharacterStatusType[] = Object.keys(allCharacterStatus) as AllCharacterStatusType[];
export const allCharacterBaseStatusType = allCharacterStatusType.filter(status => status !== 'hp' && status !== 'mp');

export const emptyCharacterStatus: CharacterStatusInfo = {
    collecting: { level: 1, currentExp: 0 },
    mining: { level: 1, currentExp: 0 },
    fishing: { level: 1, currentExp: 0 },
    farmingAnimal: { level: 1, currentExp: 0 },
    farmingPlant: { level: 1, currentExp: 0 },
    cooking: { level: 1, currentExp: 0 },
    forging: { level: 1, currentExp: 0 },
    sewing: { level: 1, currentExp: 0 },
    manufacturing: { level: 1, currentExp: 0 },
    trading: { level: 1, currentExp: 0 },
    knowledge: { level: 1, currentExp: 0 },
    mysterious: { level: 1, currentExp: 0 },
    enhance: { level: 1, currentExp: 0 },
    exploring: { level: 1, currentExp: 0 },
    luck: { level: 1, currentExp: 0 },

    battle: { level: 1, currentExp: 0 },
    strength: { level: 1, currentExp: 0 },
    dexterity: { level: 1, currentExp: 0 },
    intelligence: { level: 1, currentExp: 0 },
    stamina: { level: 1, currentExp: 0 },
    attacking: { level: 1, currentExp: 0 },
    defencing: { level: 1, currentExp: 0 }
} as const