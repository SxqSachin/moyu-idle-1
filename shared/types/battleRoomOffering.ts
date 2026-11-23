import type { BattleCallback, BattleInfo } from "./battle";
import type { AllResourceAlchemyTagId } from "./gameAlchemy";
import type { AllGameResourceID } from "./gameResource";

export type BattleRoomOfferingKind =
  | { type: "alchemyTag"; tagId: AllResourceAlchemyTagId }
  | { type: "resource"; resourceId: AllGameResourceID };

export type BattleRoomOfferingConsumeRule = {
  turns: number;
  amount: number;
  stopWhenDepleted?: boolean;
};

export type BattleRoomOfferingEffectTrigger =
  | "onPrepareBattleData"
  | "onBattleStart"
  | "afterBattleStart"
  | "onTurnStart"
  | "onTurnEnd"
  | "onConsume";

// 参数映射：新增 trigger 时只需在此补一行
export type BattleRoomOfferingEffectParamMap = {
  onPrepareBattleData: { 
    baseEnemyCount: number;
    baseBossCount: number;
    offering: BattleRoomOfferingSpec;
  };
  onBattleStart: {
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    offering: BattleRoomOfferingSpec;
  };
  afterBattleStart: BattleRoomOfferingEffectParamMap["onBattleStart"];
  onTurnStart: BattleRoomOfferingEffectParamMap["onBattleStart"];
  onTurnEnd: BattleRoomOfferingEffectParamMap["onBattleStart"];
  onConsume: BattleRoomOfferingEffectParamMap["onBattleStart"];
};

// 返回值映射：对应 trigger 控制返回类型
export type BattleRoomOfferingEffectReturnMap = {
  onPrepareBattleData: { extraEnemyCount?: number; extraBossCount?: number };
  onBattleStart: void;
  afterBattleStart: void;
  onTurnStart: void;
  onTurnEnd: void;
  onConsume: void;
};

// 便捷别名：按 trigger 取入参/返回类型
export type BattleRoomOfferingEffectParam<T extends BattleRoomOfferingEffectTrigger> =
  BattleRoomOfferingEffectParamMap[T];
export type BattleRoomOfferingEffectResult<T extends BattleRoomOfferingEffectTrigger> =
  BattleRoomOfferingEffectReturnMap[T];

export type BattleRoomOfferingEffect<T extends BattleRoomOfferingEffectTrigger> = {
  trigger: T;
  handler: (
    param: BattleRoomOfferingEffectParam<T>
  ) => BattleRoomOfferingEffectResult<T> | Promise<BattleRoomOfferingEffectResult<T>>;
  description?: string;
};

// 便捷联合：允许 effects 同时包含多种 trigger
export type AnyBattleRoomOfferingEffect = {
  [K in BattleRoomOfferingEffectTrigger]: BattleRoomOfferingEffect<K>
}[BattleRoomOfferingEffectTrigger];

export interface BattleRoomOfferingSpec {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  kind: BattleRoomOfferingKind;
  consume: BattleRoomOfferingConsumeRule;
  stackable?: boolean; // 默认允许叠加；为 false 时房间仅保留一个
  effects?: AnyBattleRoomOfferingEffect[];

  disableInNormalBattle?: boolean; // 是否允许在世界Boss战中使用，默认允许
  disableInWorldBossBattle?: boolean; // 是否允许在世界Boss战中使用，默认允许
}

export interface BattleRoomOfferingStack {
  specId: string;
  count: number;
  fromUserUuid?: string;
  resourceId?: AllGameResourceID;
  consumedCount?: number;
  nextConsumeInTurns?: number;
}