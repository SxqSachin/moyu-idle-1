import { emitEventToServer, registerSocketEventListener } from "./socket";

export type KittyTraitRow = {
  id: number;
  uuid: string;
  kittyUuid: string;
  traitId: string;
  level: number;
  currentExp: number;
}

export const emitGetKittyTraits = (kittyUuid?: string) => {
  emitEventToServer("kitty:traits:get", { uuid: kittyUuid });
}
export const onGetKittyTraitsSuccess = registerSocketEventListener<{ list: KittyTraitRow[] }>("kitty:traits:get:success");
export const onGetKittyTraitsError = registerSocketEventListener<{ message: string }>("kitty:traits:get:error");

export const emitAddKittyTrait = (kittyUuid: string, traitId: string, initialLevel?: number) => {
  emitEventToServer("kitty:traits:add", { kittyUuid, traitId, initialLevel });
}
export const onAddKittyTraitSuccess = registerSocketEventListener<{ row: KittyTraitRow }>("kitty:traits:add:success");
export const onAddKittyTraitError = registerSocketEventListener<{ message: string }>("kitty:traits:add:error");

export const emitRemoveKittyTrait = (kittyUuid: string, traitId: string) => {
  emitEventToServer("kitty:traits:remove", { kittyUuid, traitId });
}
export const onRemoveKittyTraitSuccess = registerSocketEventListener<{ kittyUuid: string; traitId: string }>("kitty:traits:remove:success");
export const onRemoveKittyTraitError = registerSocketEventListener<{ message: string }>("kitty:traits:remove:error");

export const emitAddKittyTraitExp = (kittyUuid: string, traitId: string, addExp: number) => {
  emitEventToServer("kitty:traits:addExp", { kittyUuid, traitId, addExp });
}
export const onAddKittyTraitExpSuccess = registerSocketEventListener<any>("kitty:traits:addExp:success");
export const onAddKittyTraitExpError = registerSocketEventListener<{ message: string }>("kitty:traits:addExp:error");

export default {} as const;
