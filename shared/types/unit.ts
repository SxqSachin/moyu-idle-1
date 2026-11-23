import type { CharacterAffixInstance } from "./affix"
import type { AllBattlePhase } from "./battle"
import type { AllBattleStateId, BattleStateInBattle } from "./BattleState"
import type { CharacterEquipmentInfo, CharacterStatusImprove, CharacterStatusInfo, PlayerState } from "./characterInfo"
import type { AllGameResourceID } from "./gameResource"
import type { AllBattleSkillId, GameBattleSkill, GameBattleLogic, GameCharacterBattleSkillInfo } from "./skill"
import type { LearnedSkillFlatItem } from "./skillTree"

export type UnitStatusDetail = {
    level: number
}

export type BattleLifeStatus = Omit<CharacterStatusInfo, 'battle' | 'strength' | 'dexterity' | 'intelligence' | 'stamina' | 'attacking' | 'defencing'>;

export type BaseUnitStatusInfo = {
  strength: UnitStatusDetail// 力量

  dexterity: UnitStatusDetail      // 敏捷
  intelligence: UnitStatusDetail   // 智力
  stamina: UnitStatusDetail        // 耐力

  attacking: UnitStatusDetail      // 攻击
  defencing: UnitStatusDetail      // 防御

  otherStatus: {
    [key in keyof BattleLifeStatus]?: UnitStatusDetail // 收集
  }
    // 幸运
}


export type BattleSkillInfoItem = {
  level: number
  order: number
  extra?: GameCharacterBattleSkillInfo['extra']
}
export type BattleSkillInfo = {
  [id in AllBattleSkillId]?: BattleSkillInfoItem
}

export type BattleSkillCastLogicInfo = {
  [id in AllBattleSkillId]?: GameBattleLogic[]
}

export type UnitBattleState = {
  [id in AllBattleStateId]?: BattleStateInBattle
}

export type UnitBatleInventoryResourceDetail = {
  prepareCount: number
  remainingCount: number // 数量
  cooldown: number
  ai: GameBattleLogic[] // 使用逻辑
  order: number

  useWhen?: AllBattlePhase[]
}
export type UnitBattleInventoryInfo = {
  [id in AllGameResourceID]?: UnitBatleInventoryResourceDetail 
}

export type BaseBattleUnit = {
    uuid: string; // 单位唯一标识

    id: string; // 单位唯一标识
    name: string; // 名称

    hp: number; // 当前生命值
    maxHp: number; // 最大生命值

    tmpShield: number

    mp: number;
    maxMp: number

    isPlayer: boolean;

    // 是否是玩家的单位，即使是作为敌人生成
    isPlayerUnit?: boolean;

    isBoss?: boolean;

    canUseItem?: boolean
    canGetDropReward?: boolean;
    canGetExpReward?: boolean;

    // 是否是系统生成的，仅作为副本怪物的存在
    // 环境单位不会获得经验
    // 环境单位使用物品时，不会真实消耗库存
    isEnvironmentUnit?: boolean;

    keepWhenNewTurn?: boolean; // 是否在新回合开始时保留该单位（例如玩家单位通常会保留，而敌人单位可能会被清除）

    isSummoned?: boolean; // 是否为召唤单位
    isPermanentSummoned?: boolean; // 是否为永久召唤物
    summonedBy?: string; // 如果是召唤单位，记录召唤者的UUID

    ignoreTurn?: boolean; // 忽略回合

    // attack: number; // 攻击力
    // defense: number; // 防御力
    level: number; // 等级

    description?: string; // 描述（可选）
    
    baseStatus: BaseUnitStatusInfo;

    status: BaseUnitStatusInfo; // 状态信息

    skills: BattleSkillInfo;
    ai: BattleSkillCastLogicInfo;

    state?: UnitBattleState;

    affix?: CharacterAffixInstance[];

    equipment?: CharacterEquipmentInfo

    inventory?: UnitBattleInventoryInfo

    skillColddown?: {[key in AllBattleSkillId]?: number}; // 技能冷却时间，单位为回合数

    tmpOncePreBattleExtraTurnIndexList?: number[];

    triggerMark?: {
      oncePreBattle?: {[key: string]: boolean}

      timesPerBattle?: {[key: string]: number}

      eachSelfTurn?: {[key: string]: any} // 每回合开始时触发

      cleanWhenBattleStart?: {[key: string]: boolean} // 在战斗开始时清除的标记
    }

    ip?: string
    fp?: string

    stateWhenStartEachBattle?: PlayerState["battle"]["stateWhenStartEachBattle"]

    stateWhenStartFirstBattle?: [
      {
        id: AllBattleStateId 
        duration: number // 持续回合数
        value: number
        until: Date      // 持续到什么时候
      }
    ],

    skillTreeNodes?: LearnedSkillFlatItem[]

    // thisBattleInfo
    tbi?: {
      // 是否行动过
      acted?: boolean
    }
}

export type UnitStatisticInfoInSingleBattle = {
  dealDamage: Record<string, number>
  takeDamage: Record<string, number>

  giveHeal: Record<string, number>
  takeHeal: Record<string, number>

  lossMp: Record<string, number>
  restoreMp: Record<string, number>

  addState: Record<string, AllBattleStateId[]>

  castSkill: {[key in AllBattleSkillId]?: number}
}

export type UnitExpRewardInSingleBattle = {
  dealDamageExp: CharacterStatusImprove[];
  takeDamageExp: CharacterStatusImprove[];

  dealDamageExpFromAlly: CharacterStatusImprove[];

  dealDamageExpFromSummonedUnit: CharacterStatusImprove[];

  castSkillExp: CharacterStatusImprove[];

  battleExp: CharacterStatusImprove[];
}
