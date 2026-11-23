import type { GameUserUniqueFlag } from "~/shared/types/gameEffect";
import { emitEventToServer, registerSocketEventListener } from "./socket";

// 查询用户所有 uniqueFlag（GameUserUniqueFlag[]）
export function emitGetAllUniqueFlag() {
  emitEventToServer("uniqueFlag:all");
}
export const onGetAllUniqueFlagSuccess = registerSocketEventListener<{ flags: GameUserUniqueFlag[] }>("uniqueFlag:all:success");
export const onGetAllUniqueFlagFail = registerSocketEventListener<{ message: string }>("uniqueFlag:all:fail");