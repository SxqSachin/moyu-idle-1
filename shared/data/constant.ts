import type { BattleArea } from "../types/battle";
import type { AllGameEnemyID, Enemy } from "../types/emeny";
import type { GameActionResourceRequirementDetail, ResourceRequirement } from "../types/gameAction";
import type { ItemCountInfo } from "../types/gameInventory";
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "../types/gameResource";
import type { BaseBattleUnit } from "../types/unit";
import { ObjectKeysTyped } from "../utils";
import { getAllEnemyIdInBattleArea } from "../utils/game/battle";
import { allBattleAreas } from "./allBattleInfo";
import { allGameEnemies } from "./allGameEnemy";

export const TRADING_EXP_PER_GOLD_IN_MARKET = 0.04; // 每交易(出售、购买)1金币，获得0.01交易经验

export const KITTY_SATIETY_PER_SECOND = +(0.25 / 60).toFixed(4); // 工作状态中的猫咪每秒消耗的饱食度

export const BANNED_RESOURCE_IN_MARKET: AllGameResourceIDWithInternal[] = ['__satiety', 'gold', 'catPawStamp', 'testResource']

export const ENHANCE_PERCENT_MODIFY_PER_LEVEL = 0.125 / 100 // 每强化等级提升0.125%


export const NOTIFY_KET_20250606ShopModify = "20250606ShopModify";
export const NOTIFY_KEY_20250607QuestFix = "20250607QuestFix";
export const NOTIFY_KEY_20250608ExerciseActionModify = "20250608ExerciseActionModify";
export const NOTIFY_KEY_apply20250609GiveHealSkill = 'apply20250609GiveHealSkill';
export const NOTIFY_KEY_apply20250609QQ = 'apply20250609QQ';

export const ATTACK_PER_BATTLE_LEVEL = 0.2;
export const DEFENCE_PER_BATTLE_LEVEL = 0.2;
export const ATTACK_PER_STRENG_LEVEL = 0.25;

export const BATTLE_EXPERIENCE_DROP_PERCENT = 0.04;

export const ATTACK_EXP_PER_DEAL_DAMAGE = 0.01;
export const STRENGTH_EXP_PER_DEAL_DAMAGE = 0.01;
export const DEX_EXP_PER_DEAL_DAMAGE = 0.005;

export const DAMAGE_EXP_SHARE_PERCENT = 0.3;
export const SOMMONER_DAMAGE_EXP_SHARE_PERCENT = 0.6;

export const DEFENCE_EXP_PER_DEAL_DAMAGE = 0.01;
export const STAMINA_EXP_PER_TAKE_DAMAGE = 0.01;
export const INTELLIGENCE_EXP_PRE_CAST_SKILL = 0.25;
export const DEX_EXP_PER_TAKE_DAMAGE = 0.005;

export const QUEST_REROLL_GOLD_COST_PRE = 250

export const KITTY_MAX_SATIETY = 200
export const KITTY_MAX_MOOD = 200

export const KITTY_MAX_MOOD_DECREASE_PER_HOUR = 2; // 每小时最大心情下降值

export const BATTLE_ROOM_PAGE_SIZE = 20;
export const BATTLE_ROOM_MAX_OFFERINGS = 8;

export const LIST_MIN_INTERVAL = 6; // 最小上架间隔（秒）

export const BUY_MIN_INTERVAL = 2; // 最小购买间隔（秒）
export const BUY_WINDOW = 10;      // 统计窗口（秒）
export const BUY_MAX_COUNT = 4;   // 窗口内最大购买次数

export const BUYER_MARKET_RESALE_COOLDOWN_SECONDS = 60 * 60 * 48; // 求购所得物品，必须持有不得转售/求购的秒数（默认1小时）
export const getBuyerMarketResaleCooldownSecondsRedisKey = (userUuid: string, resourceId: string) => `buyerMarket:resale:cooldown:${userUuid}:${resourceId}`;



export const BATCH_BUY_EVENT_WINDOW = 100;
export const BATCH_BUY_EVENT_LIMIT = 4;
export const RESALE_COOLDOWN_SECONDS = 60 * 60 * 48; // 购买后必须持有不得转售/求购的秒数（默认1小时）
export const getMarketResaleCooldownSecondsRedisKey = (userUuid: string, resourceId: string) => `market:resale:cooldown:${userUuid}:${resourceId}`;

export const MIN_BATTLE_ROUND = 10000000;

export const RESOURCE_MODIFY_INFO_LENGTH = 100;

export const CATTY_EXPERT_MIN_HIRE_HOUR = 1;

export const BASE_MAX_BUYER_TRANSACTION_COUNT = 5; // 基础最大买家交易次数
export const BASE_MAX_SELLER_TRANSACTION_COUNT = 8; // 基础最大卖家交易次数

// 市场税
export const SELLER_MARKET_FEE = 0.03; // 上架手续费百分比
export const BUYER_MARKET_FEE = 0.03; // 预扣手续费百分比
export const MIN_LISTING_FEE = 1;

export const PLAYER_SHOP_FEE = 0.03; // 上架手续费百分比


export const BATTLE_ROOM_DIFFICULTY_LEVELS = 6
export const BATTLE_ROOM_DIFFICULTY_LEVELS_INFO = [
    // 难度1: 简单
    {
        hpBase: 200,
        attackBase: 30,
        defenseBase: 50,

        hpPercent: 0.25,
        attackPercent: 0.25,
        defensePercent: 0.25,

        additionalEnemyCount: 2,
        additionalDropPercent: 0.15,

        additionalExpPercent: 0.15
    },
    // 难度2: 普通
    {
        hpBase: 350,
        attackBase: 45,
        defenseBase: 65,

        hpPercent: 0.35,
        attackPercent: 0.35,
        defensePercent: 0.35,

        additionalEnemyCount: 2,
        additionalDropPercent: 0.25,
        additionalExpPercent: 0.23
    },
    // 难度3: 困难
    {
        hpBase: 550,
        attackBase: 60,
        defenseBase: 80,

        hpPercent: 0.5,
        attackPercent: 0.5,
        defensePercent: 0.5,

        additionalEnemyCount: 3,
        additionalDropPercent: 0.40,
        additionalExpPercent: 0.31
    },
    // 难度4: 专家
    {
        hpBase: 800,
        attackBase: 75,
        defenseBase: 95,

        hpPercent: 0.7,
        attackPercent: 0.7,
        defensePercent: 0.7,

        additionalEnemyCount: 3,
        additionalDropPercent: 0.60,
        additionalExpPercent: 0.5
    },
    // 难度5: 地狱
    {
        hpBase: 1100,
        attackBase: 90,
        defenseBase: 110,

        hpPercent: 1.0,
        attackPercent: 1.0,
        defensePercent: 1.0,

        additionalEnemyCount: 4,
        additionalDropPercent: 0.9,
        additionalExpPercent: 0.75
    },

    {
        hpBase: 5500,
        attackBase: 200,
        defenseBase: 300,

        hpPercent: 2.0,
        attackPercent: 2.0,
        defensePercent: 2.0,

        additionalEnemyCount: 4,
        additionalDropPercent: 1.25,
        additionalExpPercent: 1.25
    },
]

export const CREATE_GUILD_RESOURCE_REQUIREMENT: ResourceRequirement[] = [
    { id: 'gold', count: 1000000 },
    { id: 'wood', count: 10000 },
    { id: 'stone', count: 8000 },
    { id: 'iron', count: 2000 },
    { id: 'steel', count: 1000 },
    { id: 'sand', count: 1000 }
]

export const GO_TO_AREA_DURATION = 15 * 1000;

export const EXTRA_DROP_PERCENT_PER_LUCK = 0.01
export const EXTRA_ACTION_REWARD_PERCENT_PER_LUCK = 0.01
export const EXTRA_ENHANCE_PERCENT_PER_LUCK = 0.002

// 每往右一格，战利品掉落概率的乘算系数（用于房间设置的 slider）
export const LOOT_GOLD_DROP_MULTIPLIER_PER_SLIDER = 0.075;
export const MAX_QUEUE_LENGTH = 20;

export const KITTY_BASE_QUEUE_LENGTH = 3;

export const HP_REGEN_PER_TURN_PRE_STAMINA = 0.1;
export const MP_REGEN_PER_TURN_PRE_INTELLIGENCE = 0.05;

export const MAX_OUTFIT_COUNT = 20;


export const SFXMap: Record<string, string> = {
    frostCrown: "forst",
    ancestorCrown: "ancestor",
    starCrown: "star",
    loadOfamusementPark: "loadOfamusementPark",
}

export const WorkSFXMap: Record<string, string> = {
    yixiaosCuteHat: "yixiaosCuteHat",
}

export const BASE_KITTY_EXPEDITION_MEMBER = 4;

export const MAX_USE_ITEM_COUNT = 100000;

export const MARKET_PRICE_STEP_CONFIG = [
  { min: 0, max: 100, step: 1 },         // 0~100金币，步长1
  { min: 100, max: 1000, step: 10 },     // 100~1000金币，步长10
  { min: 1000, max: 10000, step: 50 },   // 1000~10000金币，步长50
  { min: 10000, max: 100000, step: 100 },// 1万~10万金币，步长100
  { min: 100000, max: 1000000, step: 1000 }, // 10万~100万金币，步长1000
  { min: 1000000, max: 10000000, step: 10000 }, // 100万以上，步长1万
  { min: 10000000, max: Infinity, step: 100000 }, // 100万以上，步长1万
] as const;

export const BASE_GUILD_MEMBER_COUNT = 150; // 基础公会成员数量

export const GUILD_INVENTORY_DONATE_ITEM_WHITE_LIST: Readonly<AllGameResourceID[]> = [
    'gold'
]

export const BASE_MAX_QUEST_COUNT = 30;

export const REFERRER_REWARD: Readonly<ItemCountInfo[]> = [
    {
        'guideBadge': {
            count: 1
        },
        cutePoint: {
            count: 3,
        },
        __sponsorPoint: {
            count: 200,
        }
    },
    {
        'pathfinderBadge': {
            count: 1
        },
        cutePoint: {
            count: 3,
        },
        __sponsorPoint: {
            count: 400,
        }
    },
] as const

export const MAX_SUBACCOUNT_COUNT = 6;

export const AUCTION_MAX_AMOUNT = 100_000_000_000
export const AUCTION_BUYOUT_MAX_AMOUNT = 100_000_000_000_0

export const AUCTION_CREATE_FEE = 100000

export const LAST_BATTLE_AREA_ID = 'cat_dungeon_002';
const lastBattleArea = allBattleAreas[LAST_BATTLE_AREA_ID] as BattleArea;

const allEnemyInArea = getAllEnemyIdInBattleArea(lastBattleArea)

let lastAreaAllEnemyTotalHp = 0;
let lastAreaAllEnemyTotalMp = 0;
let lastAreaAllEnemyTotalAttack = 0;
let lastAreaAllEnemyTotalDefence = 0;
let lastAreaAllEnemyTotalStrength = 0;
let lastAreaAllEnemyTotalDexterity = 0;
let lastAreaAllEnemyTotalIntelligence = 0;
let lastAreaAllEnemyTotalStamina = 0;
let lastAreaSimpleEnemyTotalExp = 0;

allEnemyInArea.forEach(enemyId => {
    enemyId = enemyId as keyof typeof allGameEnemies 
    // @ts-ignore
    const enemy = allGameEnemies[enemyId] as Enemy;

    if (enemy) {
        lastAreaAllEnemyTotalHp += enemy.maxHp;
        lastAreaAllEnemyTotalMp += enemy.maxMp;
        lastAreaAllEnemyTotalAttack += enemy.status.attacking.level;
        lastAreaAllEnemyTotalDefence += enemy.status.defencing.level;
        lastAreaAllEnemyTotalStrength += enemy.status.strength.level;
        lastAreaAllEnemyTotalDexterity += enemy.status.dexterity.level;
        lastAreaAllEnemyTotalIntelligence += enemy.status.intelligence.level;
        lastAreaAllEnemyTotalStamina += enemy.status.stamina.level;
        lastAreaSimpleEnemyTotalExp += enemy.expReward
    }
});

export const DENSE_FOG_MODE_BASELINE_STATUS = 
{
    hp: Math.floor(lastAreaAllEnemyTotalHp / allEnemyInArea.length) ?? 3500,
    mp: Math.floor(lastAreaAllEnemyTotalMp / allEnemyInArea.length) ?? 400,
    attack: Math.floor(lastAreaAllEnemyTotalAttack / allEnemyInArea.length) ?? 300,
    defense: Math.floor(lastAreaAllEnemyTotalDefence / allEnemyInArea.length) ?? 180,
    strength: Math.floor(lastAreaAllEnemyTotalStrength / allEnemyInArea.length) ?? 42,
    dexterity: Math.floor(lastAreaAllEnemyTotalDexterity / allEnemyInArea.length) ?? 52,
    intelligence: Math.floor(lastAreaAllEnemyTotalIntelligence / allEnemyInArea.length) ?? 30,
    stamina: Math.floor(lastAreaAllEnemyTotalStamina / allEnemyInArea.length) ?? 40,
    expReward: Math.floor(lastAreaSimpleEnemyTotalExp / (allEnemyInArea.length - 2)) ?? 471,
} as const;
export const DENSE_FOG_MODE_ENEMY_LEVEL_EXP_MULTIPLE = 6;

export const MEOW_SPIRIT_MIRROR_SAVE_COST: ItemCountInfo = {
    denseFogDust: {
        count: 150
    }
} as const

export const MEOW_SPIRIT_MIRROR_BORROW_FREE_LEVEL = 100;
export const MEOW_SPIRIT_MIRROR_BORROW_COST_PER_BATTLE_LEVEL: ItemCountInfo = {
    denseFogDust: {
        count: 20
    }
} as const

// 最大离线时间（小时） 默认3天
export const MAX_OFFLINE_HOUR = 24 * 3;

export const NEW_ACCOUNT_INITIAL_INVENTORY: ItemCountInfo = {
  gold: {
    count: 25000,
  },
  __satiety: {
    count: 1000,
  },
  berry: {
    count: 1000,
  },
  catMint: {
    count: 100,
  },
  catSnack: {
    count: 100,
  },
  woodSword: {
    count: 1,
  },
  sweepSkillBook: {
    count: 1,
  },
  baseHealSkillBook: {
    count: 1,
  },
  bookOfWorkSkillTreePoint: {
    count: 10
  },
  bookOfBattleSkillTreePoint: {
    count: 15,
  },
  doubleActionEfficiency: {
    count: 3
  },
  doubleBattleEfficiency: {
    count: 3
  },
  luckyBoost: {
    count: 3
  },
  safeJourneyToken: {
    count: 1,
  }
};

// Farming (种植) - 田地相关配置
// 每个玩家默认的农田数量上限
// 调整：新增 6 块田地可用，总上限从 12 提升到 18
export const BASE_MAX_FARM_PLOTS_PER_USER = 9;

// 新建一块地的消耗（可根据实际游戏经济调整）
export const FARM_PLOT_CREATE_RESOURCE_REQUIREMENT: ResourceRequirement[] = [
    { id: 'gold', count: 200000 },
    { id: 'wood', count: 2000 },
    { id: 'stone', count: 1500 },
    { id: 'nutrientEssence', count: 2500 },
];


export const BASE_MAX_PLAYER_SHOP_ITEM_SLOT = 3; // 店铺基础最大商品栏位
export const CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT: ItemCountInfo = {
    playerShopLicense: {
        count: 1
    },
}

// 商铺置顶消耗（示例值，可调整）
export const PLAYER_SHOP_PIN_COST: ItemCountInfo = {
    playerShopPinnedLicense: {
        count: 1,
    },
};

// 祝福词条相关常量已迁移至 shared/data/characterAffixConstants.ts，避免污染全局常量文件。


export const CUSTOM_AVATAR_MIN_SPONSOR_POINTS = 500 * 100; // 自定义头像所需最少赞助点数
export const CUSTOM_GIF_AVATAR_MIN_SPONSOR_POINTS = 1000 * 100; // 自定义GIF头像所需最少赞助点数

export const CUSTOM_SPONSOR_POINT_LEVEL_1 = 1000 * 100; // 一件以您用户名命名的装备、一个自定义称号、一个自定义个人背景


export const MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL = 100_000;
export const MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL = 5;
export const MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL = 100_000;
export const MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL = 5;
export const REMOVE_KITTY_TRAIT_RESOURCE_REQUIREMENT: ItemCountInfo = {
    luxuryCatFood: {
        count: 10,
    },
    catPotion: {
        count: 10,
    },
    blessedBell: {
        count: 5,
    }
}

export const SPONSOR_POINT_PACK_TO_SPONSOR_POINT_RATE = 100; // 赞助积分包兑换赞助积分比例

export const SPECIAL_ITEM_20251202 = [
  "goldenEgg",
  "cuteIronBox",
  "reconstructionCommemorative",
  "guideBadge",
  "pathfinderBadge",
  "reconstructionCommemorative+10",
  "guideBadge+10",
  "pathfinderBadge+10",
];

export const MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT = 7;
export const MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT = 7;
export const MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT = 2;


export const INVITE_REWARD_EDIT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const INVITE_REWARD_MAX_ITEM_KINDS = 4;
export const INVITE_REWARD_DEFAULT_ITEM_LIMIT = 20;

export const INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS = 1;
export const INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS = 1;
export const INVITE_REWARD_MAX_EQUIPITEM_LIMIT = 1;

export const INVITE_REWARD_ITEM_LIMITS: Readonly<Record<string, number>> = {
    gold: 5_000_000,
    cutePoint: 100,
} as const;