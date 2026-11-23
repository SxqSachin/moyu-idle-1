import { emitEventToServer, registerSocketEventListener } from "./socket";
import type {
  ReqHarvestBoxList,
  ReqHarvestBoxClaim,
  ReqHarvestBoxClaimItem,
  ResHarvestBoxList,
} from "~/shared/types/harvestBox";

// Emitters
export const emitHarvestBoxList = (payload: ReqHarvestBoxList = {}) =>
  emitEventToServer("harvestBox:list", payload);

export const emitHarvestBoxClaim = (payload: ReqHarvestBoxClaim) =>
  emitEventToServer("harvestBox:claim", payload);

export const emitHarvestBoxClaimItem = (payload: ReqHarvestBoxClaimItem) =>
  emitEventToServer("harvestBox:claimItem", payload);

// Claim all boxes
export const emitHarvestBoxClaimAll = () =>
  emitEventToServer("harvestBox:claimAll", {});

// Listeners
export const onHarvestBoxListSuccess =
  registerSocketEventListener<ResHarvestBoxList>("harvestBox:list:success");
export const onHarvestBoxListFail =
  registerSocketEventListener<{ msg: string }>("harvestBox:list:fail");

export const onHarvestBoxClaimSuccess =
  registerSocketEventListener<{ ok: boolean; alreadyClaimed?: boolean }>(
    "harvestBox:claim:success"
  );
export const onHarvestBoxClaimFail =
  registerSocketEventListener<{ msg: string }>("harvestBox:claim:fail");

export const onHarvestBoxClaimItemSuccess =
  registerSocketEventListener<{ ok: boolean; alreadyClaimed?: boolean }>(
    "harvestBox:claimItem:success"
  );
export const onHarvestBoxClaimItemFail =
  registerSocketEventListener<{ msg: string }>("harvestBox:claimItem:fail");

export const onHarvestBoxClaimAllSuccess =
  registerSocketEventListener<{ ok: boolean; alreadyClaimed?: boolean; claimedItems?: Array<{resourceId:string; amount:number}> }>(
    "harvestBox:claimAll:success"
  );
export const onHarvestBoxClaimAllFail =
  registerSocketEventListener<{ msg: string }>("harvestBox:claimAll:fail");
