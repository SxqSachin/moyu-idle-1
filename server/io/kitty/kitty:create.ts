import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { createKitty, getAllKittyByOwner } from "~/server/utils/game/kitty"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<string>) {
    try {
        // validate kitty name: 1..11 code points; allow CJK/Japanese/Latin/digits/emoji and spaces
        const name = data.data || '';
        const countCodePoints = (s: string) => Array.from(s || '').length;
        const allowedNameRegex = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9\p{Extended_Pictographic}\s]+$/u;
        if (!name || countCodePoints(name) < 1 || countCodePoints(name) >= 12 || !allowedNameRegex.test(name)) {
            emitEventToUser(data.user, "kitty:create:error", { message: "昵称不合法：长度需1-11，且仅限常见字符" });
            return;
        }
        withUniqueLock(`kitty:create:${data.user.uuid}`, async () => {
            const kitty = await createKitty(data.user.uuid, data.data)
            emitEventToUser(data.user, "kitty:create:success", kitty)

            const kittyList = await getAllKittyByOwner(data.user.uuid)

            emitEventToUser(data.user, "kitty:getAll:success", kittyList)
        });
    } catch (e: any) {
        emitEventToUser(data.user, "kitty:create:error", { message: e.message || "创建小猫咪失败" })
    }
}