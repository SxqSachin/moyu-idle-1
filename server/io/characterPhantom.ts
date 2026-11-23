import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from ".";
import {
  createCharacterPhantomListing,
  getListingPhantomByUuid,
  listCharacterPhantomListings,
  createCharacterPhantomBorrow,
  returnCharacterPhantomBorrow,
  cancelCharacterPhantomListing,
  getBorrowByUuid,
  getBorrowByBorrower,
  getPhantomList,
  getBorrowByUuidList,
} from "../utils/game/characterPhantom";
import type {
  CharacterPhantomListingCreateInput,
  CharacterPhantomBorrowCreateInput,
  ListingQueryOptions,
} from "~/shared/types/characterPhantom";

/**
 * 列表查询
 * 请求 payload 可选： ListingQueryOptions
 * 返回事件:
 *  - characterPhantom:list:success { list }
 *  - characterPhantom:list:fail { message }
 */
export async function listCharacterPhantom(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ListingQueryOptions | undefined>
) {
  const user = data.user;
  try {
    const q = (data.data ?? {}) as ListingQueryOptions;
    const list = await listCharacterPhantomListings(q);
    emitEventToUser(user, "characterPhantom:list:success", { list });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:list:fail", { message: e?.message || "unknown" });
  }
}
export async function handleGetCharacterPhantomList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuidList: string[]}>
) {
  const user = data.user;
  try {
    const uuidList = data.data?.uuidList || [];
    const list = await getPhantomList(uuidList);

    emitEventToUser(user, "characterPhantom:getList:success", { list });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:getList:fail", { message: e?.message || "unknown" });
  }
}

/**
 * 读取单个 listing
 * payload: { uuid: string }
 * 返回:
 *  - characterPhantom:get:success { listing }
 *  - characterPhantom:get:fail { message }
 */
export async function getCharacterPhantom(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string }>
) {
  const user = data.user;
  try {
    const uuid = data.data?.uuid;
    if (!uuid) throw new Error("missing uuid");
    const listing = await getListingPhantomByUuid(uuid);
    emitEventToUser(user, "characterPhantom:get:success", { listing });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:get:fail", { message: e?.message || "unknown" });
  }
}

/**
 * 创建上架（listing）
 * payload: CharacterPhantomListingCreateInput (owner 字段会被覆盖为当前用户)
 * 返回:
 *  - characterPhantom:createListing:success { listing }
 *  - characterPhantom:createListing:fail { message }
 */
export async function createCharacterPhantomListingHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Pick<CharacterPhantomListingCreateInput, 'guildUuid' | 'note'>>
) {
  const user = data.user;
  const guildUuid = data.data.guildUuid
  await withUniqueLock(
    `characterPhantom:create:${user.uuid}`,
    async () => {
      try {
        if (!guildUuid) throw new Error("missing guildUuid");

        const input: CharacterPhantomListingCreateInput = {
          guildUuid,
          characterUuid: user.uuid,
          owner: user.uuid,
          note: data.data.note || "",
        };
        const listing = await createCharacterPhantomListing(input);
        emitEventToUser(user, "characterPhantom:createListing:success", {
          listing,
        });
      } catch (e: any) {
        emitEventToUser(user, "characterPhantom:createListing:fail", {
          message: e?.message || "unknown",
        });
      }
    }
  );
}

/**
 * 创建借用（租借）
 * payload: CharacterPhantomBorrowCreateInput
 * 返回:
 *  - characterPhantom:createBorrow:success { borrow }
 *  - characterPhantom:createBorrow:fail { message }
 *
 * 使用唯一锁避免并发超借（与 withUniqueLock 一起使用）
 */
export async function createCharacterPhantomBorrowHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CharacterPhantomBorrowCreateInput>
) {
  const user = data.user;
  const input = (data.data ?? {}) as CharacterPhantomBorrowCreateInput;
  if (!input?.phantomUuid) {
    emitEventToUser(user, "characterPhantom:createBorrow:fail", { message: "missing phantomUuid" });
    return;
  }

  if (!input.guildUuid) {
    emitEventToUser(user, "characterPhantom:createBorrow:fail", { message: "missing guildUuid" });
    return;
  }

  await withUniqueLock(`characterPhantom:borrow:${user.uuid}`, async () => {
    try {
      // 强制借用者为当前用户
      const borrow = await createCharacterPhantomBorrow(user.uuid, input);
      emitEventToUser(user, "characterPhantom:createBorrow:success", { borrow });
    } catch (e: any) {
      emitEventToUser(user, "characterPhantom:createBorrow:fail", { message: e?.message || "unknown" });
    }
  });
}

/**
 * 归还借用
 * payload: { uuid: string }
 * 返回:
 *  - characterPhantom:returnBorrow:success { borrow }
 *  - characterPhantom:returnBorrow:fail { message }
 */
export async function returnCharacterPhantomBorrowHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string }>
) {
  const user = data.user;
  try {
    const uuid = data.data?.uuid;
    if (!uuid) throw new Error("missing uuid");

    // 可选：检查当前用户是否为借用者或房主（略）
    const updated = await returnCharacterPhantomBorrow(uuid, user.uuid);
    emitEventToUser(user, "characterPhantom:returnBorrow:success", { borrow: updated });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:returnBorrow:fail", { message: e?.message || "unknown" });
  }
}

/**
 * 取消/下架 listing（owner 操作）
 * payload: { uuid: string }
 * 返回:
 *  - characterPhantom:cancelListing:success { listing }
 *  - characterPhantom:cancelListing:fail { message }
 */
export async function cancelCharacterPhantomListingHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string }>
) {
  console.log(data);
  const user = data.user;
  try {
    const uuid = data.data.uuid;
    if (!uuid) throw new Error("missing uuid");
    const updated = await cancelCharacterPhantomListing(uuid, user.uuid);
    emitEventToUser(user, "characterPhantom:cancelListing:success", { listing: updated });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:cancelListing:fail", { message: e?.message || "unknown" });
  }
}

/**
 * 查询单个 borrow
 * payload: { uuid: string }
 * 返回:
 */
export async function getSelfBorrowedPhantom(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const user = data.user;
  try {
    const borrows = await getBorrowByBorrower(user.uuid);
    emitEventToUser(user, "characterPhantom:getBorrow:success", { borrows });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:getBorrow:fail", { message: e?.message || "unknown" });
  }
}

export async function handleGetBorrowedPhantomList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuidList: string[]}>
) {
  const user = data.user;
  try {
    const borrows = await getBorrowByUuidList(data.data.uuidList);
    emitEventToUser(user, "characterPhantom:getBorrowedPhantomList:success", { borrows });
  } catch (e: any) {
    emitEventToUser(user, "characterPhantom:getBorrowedPhantomList:fail", { message: e?.message || "unknown" });
  }
}