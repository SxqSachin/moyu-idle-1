// Client-only stub for heavy server battle logic. All functions are no-op or minimal return values
// to satisfy imports without pulling server code into the browser bundle.

const noop = (..._args: any[]) => undefined;
const noopBool = (..._args: any[]) => false;
const noopArray: any[] = [];

export const dealAoeDamage = async (..._args: any[]) => ({}) as any;
export const dealDamage = async (..._args: any[]) => 0 as any;
export const getRandomUnitInCollection = (..._args: any[]) => undefined as any;
export const getRandomUnitsInCollection = (..._args: any[]) => [] as any;
export const healUnit = async (..._args: any[]) => undefined as any;
export const restoreMp = async (..._args: any[]) => undefined as any;
export const summonUnit = async (..._args: any[]) => undefined as any;
export const addState = async (..._args: any[]) => undefined as any;
export const castSkill = async (..._args: any[]) => undefined as any;
export const getUnitStatusInBattle = (..._args: any[]) => 0 as any;
export const lossMp = async (..._args: any[]) => undefined as any;
export const getRandomPercentAboutUnit = (..._args: any[]) => 0 as any;
export const checkRandomPercentAboutUnit = (..._args: any[]) => false as any;
export const iteratorUnitState = (_unit: any, _cb: any) => undefined as any;
export const iteratorUnitStateAsync = async (_unit: any, _cb: any) => undefined as any;
export const iteratorUnitEquipment = (_unit: any, _cb: any) => undefined as any;
export const iteratorUnitEquipmentAsync = async (_unit: any, _cb: any) => undefined as any;
export const iteratorUnitSkillNode = (_unit: any, _cb: any) => undefined as any;
export const iteratorUnitSkillNodeAsync = async (_unit: any, _cb: any) => undefined as any;
export const isEnemy = noopBool;
export const isAlly = noopBool;
export const isUnitSelectable = (..._args: any[]) => true;
export const getEachSelfTurnTriggerMark = noop;
export const getOncePerBattleTriggerMark = noop;
export const setEachSelfTurnTriggerMark = noop;
export const setOncePerBattleTriggerMark = noop;
export const reduceUnitSkillColddown = noop;
export const checkCanLossMp = noopBool;
export const getTimesPerBattleTriggerMark = noop;
export const increaseTimesPerBattleTriggerMark = noop;
export const decreaseTimesPerBattleTriggerMark = noop;
export const setGlobalBattleCallbackGenerator = noop;

export default {};
