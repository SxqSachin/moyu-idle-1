import type { AccountInfo } from "~/shared/types/account";
import { emitEventToServer, registerSocketEventListener } from "./socket";

export const emitCreateSubAccount = (name: string) => {
  emitEventToServer("account:createSubAccount", { name });
};
export const onCreateSubaccountError = registerSocketEventListener<{ message: string }>("account:createSub:failed");

export const emitGetAccountList = () => {
  emitEventToServer("account:getList");
};
export const onGetAccountListSuccess = registerSocketEventListener<{list: AccountInfo[]}>("account:getList:success");
export const onGetAccountListError = registerSocketEventListener<{ message: string }>("account:getList:failed");