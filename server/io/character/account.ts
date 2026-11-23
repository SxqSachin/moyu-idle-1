import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { withUniqueLock } from "~/server/utils/lock";
import { createSubaccount, getAllAccount } from "~/server/utils/game/account";
import { emitEventToUser } from "..";
import { AccountInfo } from "~/shared/types/account";

// 分布式锁 key 生成方法
function getUserLockKey(userUuid: string) {
  return `account:modify:${userUuid}`;
}

async function getAccountList(uuid: string) {
  let res = await getAllAccount(uuid);

  let list: AccountInfo[] = []

  list = res.filter(a => !!a).map((account) => {
    return {
      uuid: account.uuid,
      type: account.accountType as AccountInfo['type'],
      playType: account.accountPlayType as AccountInfo['playType'],
    };
  });
  return list;
}

// 创建配装方案
export async function handleCreateSubaccount(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ name: string }>
) {
  const userUuid = data.user.uuid;
  let { name } = data.data;

  // Name validation: 1..11 code points; allowed scripts: Han, Hiragana, Katakana, Latin letters, digits, emoji
  const countCodePoints = (s: string) => Array.from(s || '').length;
  const allowedNameRegex = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9\p{Extended_Pictographic}\s]+$/u;
  if (!name || countCodePoints(name) < 1 || countCodePoints(name) >= 12 || !allowedNameRegex.test(name)) {
    emitEventToUser(userUuid, "account:createSub:failed", {
      message: "昵称不合法：长度需1-11，且仅限常见字符",
    });
    return;
  }

  await withUniqueLock(getUserLockKey(userUuid), async () => {
    try {
      await createSubaccount(userUuid, name);

      const list = await getAccountList(userUuid);
      emitEventToUser(userUuid, "account:getList:success", {
        list: list,
      });
    } catch (error: any) {
      emitEventToUser(userUuid, "account:createSub:failed", {
        message: error.message,
      });
    }
  });
}

export async function handleGetAccountList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock(getUserLockKey(userUuid), async () => {
    try {
      const list = await getAccountList(userUuid);

      emitEventToUser(userUuid, "account:getList:success", {
        list: list,
      });
    } catch (error: any) {
      emitEventToUser(userUuid, "account:getList:failed", {
        message: error.message,
      });
    }
  });
}