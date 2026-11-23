import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { FarmPlotDTO, ReqFarmPlots, ReqUnlockPlot, ReqPlantPlot, ReqHarvestPlot, ReqToggleAutoReplant, ReqCreatePlot, ReqShovelPlot } from "~/shared/types/farming";

// Emitters
export const emitFarmGetPlots = (payload: ReqFarmPlots) => emitEventToServer("farm:plots", payload);
export const emitFarmUnlockPlot = (payload: ReqUnlockPlot) => emitEventToServer("farm:plot:unlock", payload);
export const emitFarmPlantPlot = (payload: ReqPlantPlot) => emitEventToServer("farm:plot:plant", payload);
export const emitFarmHarvest = (payload: ReqHarvestPlot) => emitEventToServer("farm:plot:harvest", payload);
export const emitFarmToggleAutoReplant = (payload: ReqToggleAutoReplant) => emitEventToServer("farm:plot:autoReplant", payload);
export const emitFarmCreatePlot = (payload: ReqCreatePlot) => emitEventToServer("farm:plot:create", payload);
export const emitFarmShovel = (payload: ReqShovelPlot) => emitEventToServer("farm:plot:shovel", payload);

// Listeners
export const onFarmPlotsSuccess = registerSocketEventListener<{ list: FarmPlotDTO[] }>("farm:plots:success");
export const onFarmPlotsFail = registerSocketEventListener<{ msg: string }>("farm:plots:fail");

export const onFarmUnlockSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:unlock:success");
export const onFarmUnlockFail = registerSocketEventListener<{ msg: string }>("farm:plot:unlock:fail");

export const onFarmPlantSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:plant:success");
export const onFarmPlantFail = registerSocketEventListener<{ msg: string }>("farm:plot:plant:fail");


export const onFarmHarvestSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:harvest:success");
export const onFarmHarvestFail = registerSocketEventListener<{ msg: string }>("farm:plot:harvest:fail");

export const onFarmAutoReplantSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:autoReplant:success");
export const onFarmAutoReplantFail = registerSocketEventListener<{ msg: string }>("farm:plot:autoReplant:fail");
export const onFarmCreatePlotSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:create:success");
export const onFarmCreatePlotFail = registerSocketEventListener<{ msg: string }>("farm:plot:create:fail");
export const onFarmShovelSuccess = registerSocketEventListener<{ plot: FarmPlotDTO }>("farm:plot:shovel:success");
export const onFarmShovelFail = registerSocketEventListener<{ msg: string }>("farm:plot:shovel:fail");
