import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type {
  CharacterPhantomListingCreateInput,
  CharacterPhantomListingDTO,
  CharacterPhantomBorrowCreateInput,
  CharacterPhantomBorrowDTO,
  ListingQueryOptions,
} from "~/shared/types/characterPhantom";

/* 列表 */
export function emitListCharacterPhantom(payload?: ListingQueryOptions) {
  emitEventToServer("characterPhantom:list", payload ?? null);
}
export const onListCharacterPhantomSuccess = registerSocketEventListener<{ list: CharacterPhantomListingDTO[] }>("characterPhantom:list:success");
export const onListCharacterPhantomFail = registerSocketEventListener<{ message: string }>("characterPhantom:list:fail");

/* 读取单个 listing */
export function emitGetCharacterPhantom(uuid: string) {
  emitEventToServer("characterPhantom:get", { uuid });
}
export const onGetCharacterPhantomSuccess = registerSocketEventListener<{ listing: CharacterPhantomListingDTO | null }>("characterPhantom:get:success");
export const onGetCharacterPhantomFail = registerSocketEventListener<{ message: string }>("characterPhantom:get:fail");

export function emitGetCharacterPhantomList(uuidList: string[]) {
  emitEventToServer("characterPhantom:getList", { uuidList });
}
export const onGetCharacterPhantomListSuccess = registerSocketEventListener<{ list: CharacterPhantomBorrowDTO[] }>("characterPhantom:getList:success");
export const onGetCharacterPhantomListFail = registerSocketEventListener<{ message: string }>("characterPhantom:getList:fail");

/* 创建上架 */
export function emitCreateCharacterPhantomListing(payload: Pick<CharacterPhantomListingCreateInput, 'guildUuid' | 'note'>) {
  emitEventToServer("characterPhantom:createListing", payload);
}
export const onCreateCharacterPhantomListingSuccess = registerSocketEventListener<{ listing: CharacterPhantomListingDTO }>("characterPhantom:createListing:success");
export const onCreateCharacterPhantomListingFail = registerSocketEventListener<{ message: string }>("characterPhantom:createListing:fail");

/* 创建借用 */
export function emitCreateCharacterPhantomBorrow(payload: CharacterPhantomBorrowCreateInput) {
  emitEventToServer("characterPhantom:createBorrow", payload);
}
export const onCreateCharacterPhantomBorrowSuccess = registerSocketEventListener<{ borrow: CharacterPhantomBorrowDTO }>("characterPhantom:createBorrow:success");
export const onCreateCharacterPhantomBorrowFail = registerSocketEventListener<{ message: string }>("characterPhantom:createBorrow:fail");

/* 归还借用 */
export function emitReturnCharacterPhantomBorrow(uuid: string) {
  emitEventToServer("characterPhantom:returnBorrow", { uuid });
}
export const onReturnCharacterPhantomBorrowSuccess = registerSocketEventListener<{ borrow: CharacterPhantomBorrowDTO }>("characterPhantom:returnBorrow:success");
export const onReturnCharacterPhantomBorrowFail = registerSocketEventListener<{ message: string }>("characterPhantom:returnBorrow:fail");

/* 取消/下架 listing */
export function emitCancelCharacterPhantomListing(uuid: string) {
  emitEventToServer("characterPhantom:cancelListing", { uuid });
}
export const onCancelCharacterPhantomListingSuccess = registerSocketEventListener<{ listing: CharacterPhantomListingDTO }>("characterPhantom:cancelListing:success");
export const onCancelCharacterPhantomListingFail = registerSocketEventListener<{ message: string }>("characterPhantom:cancelListing:fail");

/* 查询单个 borrow */
export function emitGetSelfBorrowedPhantomList() {
  emitEventToServer("characterPhantom:getBorrow");
}
export const onGetSelfBorrowedPhantomSuccess = registerSocketEventListener<{ borrows: CharacterPhantomBorrowDTO[] }>("characterPhantom:getBorrow:success");
export const onGetSelfBorrowedPhantomFail = registerSocketEventListener<{ message: string }>("characterPhantom:getBorrow:fail");

export function emitGetBorrowedPhantomList(uuidList: string[]) {
  emitEventToServer("characterPhantom:getBorrowedPhantomList", {uuidList});
}
export const onGetBorrowedPhantomListSuccess = registerSocketEventListener<{ borrows: CharacterPhantomBorrowDTO[] }>("characterPhantom:getBorrowedPhantomList:success");
export const onGetBorrowedPhantomListFail = registerSocketEventListener<{ message: string }>("characterPhantom:getBorrowedPhantomList:fail");
