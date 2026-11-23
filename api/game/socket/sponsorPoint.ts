import { emitEventToServer, registerSocketEventListener } from "./socket";

// 查询赞助积分
export function emitGetSponsorPoint() {
  emitEventToServer("sponsorPoint:get");
}
export const onGetSponsorPointSuccess = registerSocketEventListener<{ current: number, max: number }>("sponsorPoint:get:success");
export const onGetSponsorPointFail = registerSocketEventListener<{ message: string }>("sponsorPoint:get:fail");

// 查询积分变动记录
export function emitGetSponsorPointRecordList(page = 1, pageSize = 20) {
  emitEventToServer("sponsorPoint:record:list", { page, pageSize });
}
export const onGetSponsorPointRecordListSuccess = registerSocketEventListener<{ records: any[] }>("sponsorPoint:record:list:success");
export const onGetSponsorPointRecordListFail = registerSocketEventListener<{ message: string }>("sponsorPoint:record:list:fail");