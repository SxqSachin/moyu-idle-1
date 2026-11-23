export enum AccountType {
  MAIN = "MAIN",
  SUB = "SUB",
}

export enum AccountPlayType {
  NORMAL = "NORMAL",
  IRON = "IRON",
}

export type AccountInfo = {
    uuid: string;
    type: AccountType;
    playType: AccountPlayType;
}

export type AccountGroupInfo = {
  isAllIronCat: boolean
  isAllNormal: boolean
  isMixed: boolean
}