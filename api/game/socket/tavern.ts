import type { Tavern } from "~/generated/prisma";
import { emitEventToServer, registerSocketEventListener } from "./socket";

// 招募猫咪专家
export const emitTavernHireExpert = (catId: string, hours: number) => {
  emitEventToServer("tavern:hireExpert", { catId, hours });
};
export const onTavernHireExpertSuccess = registerSocketEventListener<any>("tavern:hireExpert:success");
export const onTavernHireExpertError = registerSocketEventListener<{ message: string }>("tavern:hireExpert:error");

// 查询当前招募的所有猫咪专家
export const emitTavernGetMyExperts = () => {
  emitEventToServer("tavern:getMyExperts");
};
export const onTavernGetMyExpertsSuccess = registerSocketEventListener<Tavern[]>("tavern:getMyExperts:success");
export const onTavernGetMyExpertsError = registerSocketEventListener<{ message: string }>("tavern:getMyExperts:error");

// 续约猫咪专家
export const emitTavernRenewExpert = (catId: string, hours: number) => {
  emitEventToServer("tavern:renewExpert", { catId, hours });
};
export const onTavernRenewExpertSuccess = registerSocketEventListener<any>("tavern:renewExpert:success");
export const onTavernRenewExpertError = registerSocketEventListener<{ message: string }>("tavern:renewExpert:error");

export const emitPauseExpert = (catId: string) => {
  emitEventToServer("tavern:pause", { catId });
};
export const onTavernPauseExpertSuccess = registerSocketEventListener<any>("tavern:pause:success");
export const onTavernPauseExpertError = registerSocketEventListener<{ message: string }>("tavern:pause:error");

export const emitResumeExpert = (catId: string) => {
  emitEventToServer("tavern:resume", { catId });
};
export const onTavernResumeExpertSuccess = registerSocketEventListener<any>("tavern:resume:success");
export const onTavernResumeExpertError = registerSocketEventListener<{ message: string }>("tavern:resume:error");
