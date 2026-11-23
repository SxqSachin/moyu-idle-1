import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  getKittyTraits,
  addTraitToKitty,
  removeTraitFromKitty,
  addTraitExp,
} from "~/server/utils/game/kittyTraits";
import { withUniqueLock } from "~/server/utils/lock";
import allKittyTraits from "~/shared/data/kittyTraits";

export async function kittyTraitsGet(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid?: string }>
) {
  try {
    const kittyUuid = data.data?.uuid ?? data.user.uuid;
    const list = await getKittyTraits(kittyUuid);
    emitEventToUser(data.user, "kitty:traits:get:success", { list });
  } catch (err: any) {
    emitEventToUser(data.user, "kitty:traits:get:error", { message: err.message });
  }
}

export async function kittyTraitsAdd(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string; traitId: string; }>
) {
  const userUuid = data.user.uuid;
  const user = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!user?.is_gm) {
    emitEventToUser(data.user, "kitty:traits:add:error", { message: "权限不足" });
    return;
  }

  try {
    if (!data.data?.kittyUuid || !data.data.traitId) throw new Error("kittyUuid and traitId are required");

    if (!allKittyTraits[data.data.traitId]) {
      throw new Error("Invalid traitId");
    }

    const row = await withUniqueLock(`kitty:traits:${data.data.kittyUuid}`, async () => {
      return await addTraitToKitty(data.data.kittyUuid, data.data.traitId, 1);
    });
    emitEventToUser(data.user, "kitty:traits:add:success", { row });
  } catch (err: any) {
    emitEventToUser(data.user, "kitty:traits:add:error", { message: err.message });
  }
}

export async function kittyTraitsRemove(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string; traitId: string }>
) {
  try {
    if (!data.data?.kittyUuid || !data.data.traitId) throw new Error("kittyUuid and traitId are required");
    await withUniqueLock(`kitty:traits:${data.data.kittyUuid}`, async () => {
      return await removeTraitFromKitty(data.data.kittyUuid, data.data.traitId);
    });
    emitEventToUser(data.user, "kitty:traits:remove:success", { kittyUuid: data.data.kittyUuid, traitId: data.data.traitId });
  } catch (err: any) {
    emitEventToUser(data.user, "kitty:traits:remove:error", { message: err.message });
  }
}

export async function kittyTraitsAddExp(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string; traitId: string; addExp: number }>
) {
  const userUuid = data.user.uuid;
  const user = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!user?.is_gm) {
    emitEventToUser(data.user, "kitty:traits:addExp:error", { message: "权限不足" });
    return;
  }

  try {
    if (!data.data?.kittyUuid || !data.data.traitId || typeof data.data.addExp !== "number") throw new Error("kittyUuid, traitId and addExp are required");
    const result = await withUniqueLock(`kitty:traits:${data.data.kittyUuid}`, async () => {
      return await addTraitExp(data.data.kittyUuid, data.data.traitId, data.data.addExp);
    });
    emitEventToUser(data.user, "kitty:traits:addExp:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "kitty:traits:addExp:error", { message: err.message });
  }
}

export default {} as const;
