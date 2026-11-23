import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { createKitty, getAllKittyByOwner, renameKitty } from "~/server/utils/game/kitty"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<{
    kittyUuid: string,
    newName: string,
}>) {
    if (!data.data.kittyUuid || !data.data.newName) {
        emitEventToUser(data.user, "kitty:rename:error", { message: "小猫咪ID或新名字不能为空" })
        return
    }

    try {
        // validate kitty new name: 1..11 code points; allow CJK/Japanese/Latin/digits/emoji and spaces
        const name = data.data.newName || '';
        const countCodePoints = (s: string) => Array.from(s || '').length;
        const allowedNameRegex = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9\p{Extended_Pictographic}\s]+$/u;
        if (!name || countCodePoints(name) < 1 || countCodePoints(name) >= 12 || !allowedNameRegex.test(name)) {
            emitEventToUser(data.user, "kitty:rename:error", { message: "昵称不合法：长度需1-11，且仅限常见字符" });
            return;
        }
        withUniqueLock(`kitty:rename:${data.user.uuid}`, async () => {
            const kitty = await renameKitty(data.user.uuid, data.data.kittyUuid, data.data.newName)
            emitEventToUser(data.user, "kitty:rename:success", kitty)

            const kittyList = await getAllKittyByOwner(data.user.uuid)

            emitEventToUser(data.user, "kitty:getAll:success", kittyList)
        });
    } catch (e: any) {
        emitEventToUser(data.user, "kitty:rename:error", { message: e.message || "重命名小猫咪失败" })
    }
}