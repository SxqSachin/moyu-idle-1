import type { MinMax } from "."
import { allGameAction, allGameActionMainType } from "../data/allGameActions"
import type { AllGameBuildingID, BuildActionID } from "./building"
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusImprove } from "./characterInfo"
import type { ItemCountInfo, RewardInfo } from "./gameInventory"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "./gameResource"

/** 产出项（若多选使用 weight 判定） */
export type AlchemyOutputSpec = {
  id: AllGameResourceID

  range: MinMax

  percent: number
}

/** 配方（由图谱解锁或盲配发现） */
export type AlchemyRecipe = {
  recipeId: string
  mainOutputResourceId: string
  name: string
  description: string

  icon: string

  // 输入可以精确资源或者 tag（盲配时用户自由投入）
  inputs: ItemCountInfo

  baseDurationSeconds: number
  baseSuccessChance?: number // 0-1，默认 1

  minSuccessStatusLevel: {[key in AllBaseCharacterStatusType]?: number}

  outputsOnSuccessWhenDay: AlchemyOutputSpec[] // 成功时产出（可为多项按 weight 随机）
  outputsOnFailWhenDay: AlchemyOutputSpec[] // 失败产物
  outputsOnSuccessWhenNight: AlchemyOutputSpec[] // 成功时产出（可为多项按 weight 随机）
  outputsOnFailWhenNight: AlchemyOutputSpec[] // 失败产物

  mutationPercentWhenDay: number;
  mutationPercentWhenNight: number;
  outputsOnMutationWhenDay: AlchemyOutputSpec[];
  outputsOnMutationWhenNight: AlchemyOutputSpec[];

  expReward: {[key in AllBaseCharacterStatusType]?: number}

  alwaysReveal?: boolean // 是否总是解锁图谱
}

/** 图谱/百科条目 */
export type AlchemyAtlasEntry = {
  recipeId: string
  mainOutputResourceId: string

  thisRecipeIndex: number

  inputs: ItemCountInfo

  baseDurationSeconds: number
  baseSuccessChance?: number // 0-1，默认 1

  minSuccessStatusLevel: {[key in AllBaseCharacterStatusType]?: number}

  outputsOnSuccessWhenDay?: AlchemyOutputSpec[] // 成功时产出（可为多项按 weight 随机）
  outputsOnFailWhenDay?: AlchemyOutputSpec[] // 失败产物
  outputsOnSuccessWhenNight?: AlchemyOutputSpec[] // 成功时产出（可为多项按 weight 随机）
  outputsOnFailWhenNight?: AlchemyOutputSpec[] // 失败产物

  mutationPercentWhenDay?: number;
  mutationPercentWhenNight?: number;
  outputsOnMutationWhenDay?: AlchemyOutputSpec[];
  outputsOnMutationWhenNight?: AlchemyOutputSpec[];

  expReward: {[key in AllBaseCharacterStatusType]?: number}
}

export type UserAlchemyAtlas = Record<string, AlchemyAtlasEntry[]>

export const AllResourceAlchemyTag = {
  "gold": {
    "id": "gold",
    "name": "金制品",
    "description": "一种稳定的金属"
  },
  "solid": {
    "id": "solid",
    "name": "固体",
    "description": "坚硬而稳定的物质形态，常用于炼金的基础载体。"
  },
  "liquid": {
    "id": "liquid",
    "name": "液体",
    "description": "流动性强，常作为溶剂或药剂的主要形态。"
  },
  "gas": {
    "id": "gas",
    "name": "气体",
    "description": "易挥发难以捕捉，常蕴含特殊能量。"
  },
  "powder": {
    "id": "powder",
    "name": "粉末",
    "description": "细碎的固态颗粒，常用于混合或催化。"
  },
  "food": {
    "id": "food",
    "name": "食物",
    "description": "可以食用的物质"
  },
  "elixir": {
    "id": "elixir",
    "name": "药剂",
    "description": "具有特别效果的药剂。"
  },
  "crystal": {
    "id": "crystal",
    "name": "晶体",
    "description": "纯净凝结的固态，能够稳定储存能量。"
  },
  "plant": {
    "id": "plant",
    "name": "植物",
    "description": "自然生长的绿色素材，常带有生命力或药效。"
  },
  "mineral": {
    "id": "mineral",
    "name": "矿物",
    "description": "来自大地深处的结晶，坚硬且富含能量。"
  },
  "animal": {
    "id": "animal",
    "name": "动物",
    "description": "来自普通生物的素材，常含有自然活性。"
  },
  "fungi": {
    "id": "fungi",
    "name": "真菌",
    "description": "介于植物与腐朽之间，常有特殊药效或毒性。"
  },
  "insect": {
    "id": "insect",
    "name": "昆虫",
    "description": "小型生物素材，常用作实验或强化剂。"
  },
  "blood": {
    "id": "blood",
    "name": "血液",
    "description": "充满生命力的液体，蕴含生物的本源特质。"
  },
  "bone": {
    "id": "bone",
    "name": "骨骼",
    "description": "坚固的支撑结构，常用于符文刻印或稳定剂。"
  },
  "organ": {
    "id": "organ",
    "name": "器官",
    "description": "生物体内的复杂组织，常具备特殊功能。"
  },
  "hide": {
    "id": "hide",
    "name": "皮毛",
    "description": "能抵御外力，常用于炼金防护。"
  },
  "scale": {
    "id": "scale",
    "name": "鳞片",
    "description": "坚硬的片状物，常带有魔力或抗性。"
  },
  "carapace": {
    "id": "carapace",
    "name": "甲壳",
    "description": "坚硬的外壳，常用于防御或保护。"
  },
  "horn_tooth": {
    "id": "horn_tooth",
    "name": "角与牙齿",
    "description": "生物的武器，蕴含力量或攻击性特质。"
  },
  "viscera": {
    "id": "viscera",
    "name": "内脏",
    "description": "柔软且充满生机的组织，常用于滋补或邪术。"
  },
  "eye": {
    "id": "eye",
    "name": "眼球",
    "description": "凝视之器，常带有神秘的感知力。"
  },
  "spirit": {
    "id": "spirit",
    "name": "灵体",
    "description": "游离于物质之外的存在，常用于灵能炼制。"
  },
  "mana_crystal": {
    "id": "mana_crystal",
    "name": "魔力结晶",
    "description": "纯粹的魔法能量凝结体，极为珍稀。"
  },
  "void": {
    "id": "void",
    "name": "虚无",
    "description": "难以理解的暗物质，蕴含混沌能量。"
  },
  "soul_fragment": {
    "id": "soul_fragment",
    "name": "灵魂碎片",
    "description": "破碎的灵魂片段，危险却强大。"
  },
  "dream_essence": {
    "id": "dream_essence",
    "name": "梦境精华",
    "description": "从幻境中捕捉的精华，充满不确定性。"
  },
  "stardust": {
    "id": "stardust",
    "name": "星尘",
    "description": "来自星辰的微粒，蕴含宇宙之力。"
  },
  "fire": {
    "id": "fire",
    "name": "火焰",
    "description": "炽热而狂暴的元素，常用于攻击性配方。"
  },
  "water": {
    "id": "water",
    "name": "水流",
    "description": "温润而包容的元素，常用于平衡或净化。"
  },
  "earth": {
    "id": "earth",
    "name": "大地",
    "description": "厚重而稳固的元素，常用于防御性炼金。"
  },
  "air": {
    "id": "air",
    "name": "风息",
    "description": "自由而轻盈的元素，常带来速度与灵动。"
  },
  "lightning": {
    "id": "lightning",
    "name": "雷电",
    "description": "瞬间爆发的能量，常用于强化或冲击。"
  },
  "ice": {
    "id": "ice",
    "name": "冰霜",
    "description": "寒冷的元素，能够冻结或保存物质。"
  },
  "poison": {
    "id": "poison",
    "name": "毒素",
    "description": "腐蚀性极强，既可杀敌也可入药。"
  },
  "light": {
    "id": "light",
    "name": "光辉",
    "description": "纯净的能量，常用于治愈或净化。"
  },
  "star": {
    "id": "star",
    "name": "星星",
    "description": "来自星辰的微粒，蕴含宇宙之力。"
  },
  "holy": {
    "id": "holy",
    "name": "神圣",
    "description": "蕴含神圣力量的物质，常用于治愈与保护。"
  },
  "shadow": {
    "id": "shadow",
    "name": "暗影",
    "description": "隐藏与侵蚀的力量，常伴随邪术。"
  },
  "ghost": {
    "id": "ghost",
    "name": "幽灵",
    "description": "游离于物质之外的存在，常用于灵能炼制"
  },
  "artificial": {
    "id": "artificial",
    "name": "制成品",
    "description": "制造出来的物品，常用于各种用途。"
  },
  "slime": {
    "id": "slime",
    "name": "粘液",
    "description": "半流质的奇异物质，常见于魔物体内。"
  },
  "alchemy_binder": {
    "id": "alchemy_binder",
    "name": "炼金粘合剂",
    "description": "用于连接和稳定其他材料的炼金物质，性质非常稳定。"
  },
  "parasite": {
    "id": "parasite",
    "name": "寄生体",
    "description": "依附他物而生的存在，常带来异化效果。"
  },
  "living_metal": {
    "id": "living_metal",
    "name": "活性金属",
    "description": "带有生命特征的金属，能够自我修复。"
  },
  "otherworld_matter": {
    "id": "otherworld_matter",
    "name": "异界物质",
    "description": "来自未知空间的材料，性质难以预测。"
  },
  "chaos_residue": {
    "id": "chaos_residue",
    "name": "混沌残渣",
    "description": "混乱能量凝聚的产物，不稳定且危险。"
  },
  "glass": {
    "id": "glass",
    "name": "玻璃",
    "description": "透明且脆弱的材料，常用于容器或装饰。"
  },
  "mysticScroll": {
    "id": "mysticScroll",
    "name": "图卷",
    "description": "记载着许多知识的卷轴，常用于魔法研究以及物质转化。"
  },
  "container": {
    "id": "container",
    "name": "容器",
    "description": "用于盛放物品的器具，常见于炼金实验。"
  },
  "sewingArtificial": {
    "id": "sewingArtificial",
    "name": "缝纫产物",
    "description": "通过缝纫工艺制作的物品，常用于服装和布料相关的炼金。"
  },
  "monster_essence_lv1": {
    "id": "monster_essence_lv1",
    "name": "一级战利品",
    "description": "由低阶怪物掉落精炼而成，用于入门炼金。"
  },
  "monster_essence_lv2": {
    "id": "monster_essence_lv2",
    "name": "二级战利品",
    "description": "由中高阶怪物掉落提纯，适配大多数配方。"
  },
  "monster_essence_lv3": {
    "id": "monster_essence_lv3",
    "name": "三级战利品",
    "description": "由顶阶怪物掉落压缩而成，仅用于高阶炼金。"
  },
  "monster_essence_lv4": {
    "id": "monster_essence_lv4",
    "name": "四级战利品",
    "description": "由顶阶怪物掉落压缩而成，仅用于高阶炼金。"
  },
  "lv1Food": {
    "id": "lv1Food",
    "name": "一级食物",
    "description": "简单易得的食物。"
  },
  "lv2Food": {
    "id": "lv2Food",
    "name": "二级食物",
    "description": "营养丰富的食物。"
  },
  "lv3Food": {
    "id": "lv3Food",
    "name": "三级食物",
    "description": "高品质的食物。"
  },
  "lv4Food": {
    "id": "lv4Food",
    "name": "四级食物",
    "description": "高品质的食物。"
  },
  "lv1SkillBook": {
    "id": "lv1SkillBook",
    "name": "一级技能书",
    "description": "记载着各种技能的书籍，常用于学习与提升。" 
  },
  "lv2SkillBook": {
    "id": "lv2SkillBook",
    "name": "二级技能书",
    "description": "记载着各种技能的书籍，常用于学习与提升。" 
  },
  "lv3SkillBook": {
    "id": "lv3SkillBook",
    "name": "三级技能书",
    "description": "记载着各种技能的书籍，常用于学习与提升。" 
  },
  "lv4SkillBook": {
    "id": "lv4SkillBook",
    "name": "四级技能书",
    "description": "记载着各种技能的书籍，常用于学习与提升。" 
  },
} as const;
export type AllResourceAlchemyTagId = keyof typeof AllResourceAlchemyTag;