import { v7 } from "uuid";
import { prisma } from "./db";
import { AccountGroupInfo, AccountInfo, AccountPlayType, AccountType } from "~/shared/types/account";
import { User } from "~/generated/prisma";
import { MAX_SUBACCOUNT_COUNT, NEW_ACCOUNT_INITIAL_INVENTORY } from "~/shared/data/constant";
import { increaseItemCount } from "./characterInventory";
import { clone } from "~/shared/utils";

export async function getMainAccountByAccountUuid(accountUuid: string) {
  let thisAccount = await prisma.user.findUnique({
    where: { uuid: accountUuid },
  });

  if (!thisAccount) {
    return null;
  }

  let mainAccountUuid =
    thisAccount.accountType === AccountType.MAIN
      ? thisAccount.uuid
      : thisAccount.mainAccountUuid;

  if (!mainAccountUuid) {
    return null;
  }

  let mainAccount = await prisma.user.findUnique({
    where: { uuid: mainAccountUuid },
  });

  return mainAccount;
}

export async function getAllAccount(accountUuid: string) {

  let mainAccount = await getMainAccountByAccountUuid(accountUuid);

  if (!mainAccount) {
    throw new Error("主账号不存在");
  }

  let res: User[] = [];
  res.push(mainAccount);

  let allSubAccounts = await prisma.user.findMany({
    where: { mainAccountUuid: mainAccount.uuid, accountType: AccountType.SUB, is_banned: false },
  });

  res.push(...allSubAccounts);

  return res.filter((account) => !!account);
}

export async function createSubaccount(accountUuid: string, name: string) {
  let mainAccount = await getMainAccountByAccountUuid(accountUuid)

  if (!mainAccount || mainAccount.is_banned) {
    throw new Error("主账号状态异常，无法创建子账号");
  }

  // 检查name是否可用
  let existingUser = await prisma.user.findFirst({
    where: { name: name },
  });

  if (existingUser) {
    throw new Error("此名称已被占用");
  }

  if (await checkSensitiveWords(name)) {
    throw new Error("名称包含敏感词");
  }

  // 最多只能拥有3个子账号
  let subAccountCount = await prisma.user.count({
    where: { mainAccountUuid: mainAccount.uuid },
  });

  if (subAccountCount >= MAX_SUBACCOUNT_COUNT) {
    throw new Error("子账号数量已达上限");
  }

  let uuid = v7()

  const user = await prisma.user.create({
    data: {
      uuid,
      email: `${uuid}@ironcat.com`,
      pwd: mainAccount?.pwd,
      name: name,
      create_date: new Date(),

      first_reset_password: true,

      mainAccountUuid: mainAccount.uuid,
      accountPlayType: AccountPlayType.IRON,
      accountType: AccountType.SUB,

      is_new_user: true,
      has_seen_onboarding: false,
    },
  });

  const newAccountInitialInventory = clone(NEW_ACCOUNT_INITIAL_INVENTORY);

  // 2026-01-10 日前，额外添加 bell_of_2025
  if (Date.now() < new Date('2026-01-05').getTime()) {
    newAccountInitialInventory['bell_of_2025'] = {
      count: 1
    }
  }

  await increaseItemCount(user.uuid, newAccountInitialInventory)

  return user;
}

export async function isIronCat(accountUuid: string) {
  let account = await prisma.user.findUnique({
    where: { uuid: accountUuid },
  });

  if (!account) {
    return false;
  }

  return account.accountPlayType == AccountPlayType.IRON;
}

export async function isSameAccountPlayType(userUuid: string, targetUuid: string): Promise<{
  isSame: boolean

  myAccountPlayType: AccountPlayType | null
  targetAccountPlayType: AccountPlayType | null
}> {
  let userAccount = await prisma.user.findUnique({
    select: { accountPlayType: true },
    where: { uuid: userUuid },
  });

  let targetAccount = await prisma.user.findUnique({
    select: { accountPlayType: true },
    where: { uuid: targetUuid },
  });

  let userPlayType = userAccount?.accountPlayType as AccountPlayType
  let targetPlayType = targetAccount?.accountPlayType as AccountPlayType

  if (!userAccount || !targetAccount) {
    return {
      isSame: false,
      myAccountPlayType: userPlayType,
      targetAccountPlayType: targetPlayType,
    };
  }

  return {
    isSame: userPlayType == targetPlayType,
    myAccountPlayType: userPlayType,
    targetAccountPlayType: targetPlayType,
  }
}

export async function isAllIronCatOrNot(accountUuids: string[]) {
  let accounts = await prisma.user.findMany({
    select: {
      accountPlayType: true
    },
    where: { uuid: { in: accountUuids } },
  });

  if (!accounts || accounts.length === 0) {
    return true
  }

  if (
    accounts.every(
      (account) => account.accountPlayType == AccountPlayType.IRON
    ) 
  ) {
    return true
  }

  if (
    accounts.every(
      (account) => account.accountPlayType == AccountPlayType.NORMAL
    )
  ) {
    return true
  }

  return false;
}