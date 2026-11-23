import {
  REQUEST_SUCCESS_CODE,
  REQUEST_SUCCESS_MSG,
} from "~/shared/requestResult";
import { prisma } from "~/server/utils/game/db";
import { getAllAccount } from "~/server/utils/game/account";
import { AccountInfo, AccountPlayType } from "~/shared/types/account";

async function getAccountList(uuid: string) {
  let res = await getAllAccount(uuid);

  let list: AccountInfo[] = [];

  list = res.map((account) => {
    return {
      uuid: account.uuid,
      type: account.accountType as AccountInfo["type"],
      playType: account.accountPlayType as AccountInfo["playType"],
    };
  });
  return list;
}

export default defineEventHandler(async (event) => {
  const { targetAccountUuid } = await readBody(event);
  let session = await getUserSession(event);
  let currentUserUuid = session.user?.uuid;

  if (!currentUserUuid) {
    return {
      code: 401,
      msg: "未登录",
    };
  }

  let allUserAccount = await getAccountList(currentUserUuid);

  // 检查目标账号的uuid是否在allUserAccount中
  if (!allUserAccount.find((account) => account.uuid === targetAccountUuid)) {
    return {
      code: 403,
      msg: "你无法切换至此账号",
    };
  }

  let targetUser = await prisma.user.findUnique({
    where: {
      uuid: targetAccountUuid,
      is_banned: false,
    },
  });

  if (!targetUser || targetUser.is_banned) {
    return {
      code: 403,
      msg: "你无法切换至此账号",
    };
  }

  const userSessionData: any = {
    uuid: targetUser.uuid,
    name: targetUser.name,
    isVisitor: false,
    firstResetPassword: true,
    isGm: false,
    accountType: targetUser.accountType,
    isIronCat: targetUser.accountPlayType === AccountPlayType.IRON,
  };
  await setUserSession(
    event,
    {
      user: userSessionData,
    },
    {
      maxAge: 60 * 60 * 24 * 14, // 30 days
    }
  );

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
  };
});
