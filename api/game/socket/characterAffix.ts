// 角色随机词条（Character Affix）Socket 封装
// - 仅对接后端事件，不做业务缓存
// - 统一从 useUserSession 中读取当前用户，避免外部传入 userUuid

import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { CharacterAffixInstance, CharacterAffixState } from "~/shared/types/affix";

// 列表
export function emitCharacterAffixList(characterUuid: string) {
  emitEventToServer("characterAffix:list", { characterUuid });
}
export const onCharacterAffixListSuccess = registerSocketEventListener<{ list: CharacterAffixInstance[] }>(
  "characterAffix:list:success"
);
export const onCharacterAffixListError = registerSocketEventListener<{ message: string }>(
  "characterAffix:list:error"
);

// 抽取（roll）
export function emitCharacterAffixRoll(payload: {
  characterUuid: string;
  poolId?: string;
  count?: number;
  seed?: string;
}) {
  emitEventToServer("characterAffix:roll", payload);
}
export const onCharacterAffixRollSuccess = registerSocketEventListener<{ created: CharacterAffixInstance[] }>(
  "characterAffix:roll:success"
);
export const onCharacterAffixRollError = registerSocketEventListener<{ message: string }>(
  "characterAffix:roll:error"
);

// 更新状态
export function emitCharacterAffixUpdateState(payload: {
  characterUuid: string;
  id: number;
  newState: CharacterAffixState;
  version?: number;
}) {
  emitEventToServer("characterAffix:updateState", payload);
}
export const onCharacterAffixUpdateStateSuccess = registerSocketEventListener<{ current: CharacterAffixInstance | null }>(
  "characterAffix:updateState:success"
);
export const onCharacterAffixUpdateStateError = registerSocketEventListener<{ message: string }>(
  "characterAffix:updateState:error"
);

// 删除
export function emitCharacterAffixRemove(payload: { characterUuid: string; id: number }) {
  emitEventToServer("characterAffix:remove", payload);
}
export const onCharacterAffixRemoveSuccess = registerSocketEventListener<{ ok: boolean }>(
  "characterAffix:remove:success"
);
export const onCharacterAffixRemoveError = registerSocketEventListener<{ message: string }>(
  "characterAffix:remove:error"
);

// 批量删除
export function emitCharacterAffixRemoveMany(payload: { characterUuid: string; ids: number[] }) {
  emitEventToServer("characterAffix:removeMany", payload);
}
export const onCharacterAffixRemoveManySuccess = registerSocketEventListener<{ ok: boolean; removedIds: number[] }>(
  "characterAffix:removeMany:success"
);
export const onCharacterAffixRemoveManyError = registerSocketEventListener<{ message: string }>(
  "characterAffix:removeMany:error"
);

// 重抽（单个）
export function emitCharacterAffixReroll(payload: {
  characterUuid: string;
  id: number;
  version?: number;
}) {
  emitEventToServer("characterAffix:reroll", payload);
}
export const onCharacterAffixRerollSuccess = registerSocketEventListener<{ current: CharacterAffixInstance | null }>(
  "characterAffix:reroll:success"
);
export const onCharacterAffixRerollError = registerSocketEventListener<{ message: string }>(
  "characterAffix:reroll:error"
);

// 进阶重随（单个）
export function emitCharacterAffixRerollUp(payload: {
  characterUuid: string;
  id: number;
  version?: number;
}) {
  emitEventToServer("characterAffix:rerollUp", payload);
}
export const onCharacterAffixRerollUpSuccess = registerSocketEventListener<{ current: CharacterAffixInstance | null }>(
  "characterAffix:rerollUp:success"
);
export const onCharacterAffixRerollUpError = registerSocketEventListener<{ message: string }>(
  "characterAffix:rerollUp:error"
);

// 稀有度升级（单个）
export function emitCharacterAffixUpgradeRarity(payload: {
  characterUuid: string;
  id: number;
  version?: number;
}) {
  emitEventToServer("characterAffix:upgradeRarity", payload);
}
export const onCharacterAffixUpgradeRaritySuccess = registerSocketEventListener<{ current: CharacterAffixInstance | null }>(
  "characterAffix:upgradeRarity:success"
);
export const onCharacterAffixUpgradeRarityError = registerSocketEventListener<{ message: string }>(
  "characterAffix:upgradeRarity:error"
);

// 限制（上限）信息
export function emitCharacterAffixGetLimits(characterUuid: string) {
  emitEventToServer("characterAffix:getLimits", { characterUuid });
}
export const onCharacterAffixGetLimitsSuccess = registerSocketEventListener<{
  maxActive: number; maxOwned: number; active: number; owned: number;
}>(
  "characterAffix:getLimits:success"
);
export const onCharacterAffixGetLimitsError = registerSocketEventListener<{ message: string }>(
  "characterAffix:getLimits:error"
);

// 扩展词条“持有上限”
export function emitCharacterAffixExpandOwned(payload: { characterUuid: string; schemeId?: 'schemeA' | 'schemeB' | 'schemeC' }) {
  emitEventToServer("characterAffix:expandOwned", payload);
}
export const onCharacterAffixExpandOwnedSuccess = registerSocketEventListener<{
  maxActive: number; maxOwned: number; active: number; owned: number; cost: Record<string, { count: number }>;
}>(
  "characterAffix:expandOwned:success"
);
export const onCharacterAffixExpandOwnedError = registerSocketEventListener<{ message: string }>(
  "characterAffix:expandOwned:error"
);

// 扩展词条“启用上限”（不消耗资源）
export function emitCharacterAffixExpandActive(payload: { characterUuid: string; schemeId?: 'schemeA' | 'schemeB' }) {
  emitEventToServer("characterAffix:expandActive", payload);
}
export const onCharacterAffixExpandActiveSuccess = registerSocketEventListener<{
  maxActive: number; maxOwned: number; active: number; owned: number;
}>("characterAffix:expandActive:success");
export const onCharacterAffixExpandActiveError = registerSocketEventListener<{ message: string }>("characterAffix:expandActive:error");
