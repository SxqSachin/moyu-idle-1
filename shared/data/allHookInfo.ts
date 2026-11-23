
/**
 * allHookInfo.ts
 *
 * 统一维护：状态、装备等所有可用的触发回调名及其中文描述。
 * 用于文档生成、UI展示等场景。
 */

export const allBattleHookDescMap: Record<string, string> = {
	// 状态相关
	onGlobalStatusEffectAttach: '全局增益/减益状态附加时',
	onGlobalActionDurationEffectAttach: '全局动作持续时间修正',
	onCalcTaskDoneExtraRewardPercent: '完成任务时额外奖励概率',
	afterEachOtherUnitAction: '每个其他单位行动后',
	extraHpRegenWhenTurnStart: '回合开始时额外回血',
	extraMpRegenWhenTurnStart: '回合开始时额外回蓝',
	onBattleStart: '战斗开始时',
	effect: '主效果函数',
	onAttach: '状态附加时',
	onDetach: '状态移除时',
	onReduceStack: '状态层数减少时',
	onBeforeLossMp: '损失MP前',
	onNeedModifyOriginDamage: '需要修正原始伤害时',
	onDamageSourceNeedModifyDefenceIgnorePercent: '修正无视防御百分比',
	onBeforeDamageSourceCalcDamage: '伤害源计算伤害前',
	onBeforeTakeDamage: '受到伤害前',
	afterTakeDamage: '受到伤害后',
	afterDealDamage: '造成伤害后',
	afterCastSkill: '释放技能后',
	afterOtherUnitCastSkill: '其他单位释放技能后',
	afterOtherUnitLossMp: '其他单位损失MP后',
	onBeforeTakeHeal: '受到治疗前',
	afterTakeHeal: '受到治疗后',
	afterSimpleAttack: '普通攻击后',
	onBeforeApplyStateToUnit: '应用状态前',
	onBeforeGetState: '获取状态前',
	calcBattleWinRewardExtraDropRate: '战斗胜利额外掉落率',
	calcBattleWinRewardExtraDropCount: '战斗胜利额外掉落数量',
	calcBattleWinExtraExpPercent: '战斗胜利额外经验',
	onRandomPercentPassCheckSuccess: '概率判定成功',
	onRandomPercentPassCheckFailed: '概率判定失败',

	// 装备相关（部分与状态重叠，部分为装备专有）
	onAfterSimpleAttack: '普通攻击后',
	onTurnStart: '回合开始时',
	onTurnEnd: '回合结束时',
	afterEachOtherUnitAction_selfDead: '每个其他单位行动后（自身死亡时）',
	beforeOtherUnitCastSkill: '其他单位释放技能前',
	afterOtherUnitCastSkill_equipment: '其他单位释放技能后（装备）',
	afterOtherUnitLossMp_equipment: '其他单位损失MP后（装备）',
	afterHealUnit: '治疗单位后',
	afterTakeHeal_equipment: '受到治疗后（装备）',
	onAddState: '附加状态时',
	beforeTakeDamage: '受到伤害前',
	beforeOtherUnitTakeDamage: '其他单位受到伤害前',
	beforeDamageSourceCalcDamage: '伤害源计算伤害前',
	beforeDamageSourceCalcDefenceIgnore: '伤害源计算无视防御前',
	beforeDecideDamageType: '决定伤害类型前',
	beforeGetState: '获取状态前',
	afterGetState: '获取状态后',
	beforeApplyStateToUnit: '应用状态前',
	afterApplyStateToUnit: '应用状态后',
	beforeLossMp: '损失MP前',
	onCalcMaxHpModify: '计算最大生命值修正',
	onGetStatus: '获取属性时',
	onGetStatusModify: '获取属性修正',
	onGetRandomPercentModify: '获取概率修正',
	onModifyStateMaxStack: '修正状态最大层数',
	onBattleStart_selfDead: '战斗开始时（自身死亡）',
	skillOverride: '技能重写',
	// ...如有更多装备专用回调可继续补充
};
