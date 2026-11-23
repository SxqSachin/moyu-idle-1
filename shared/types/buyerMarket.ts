import type { AllGameResourceID } from "./gameResource";

export type BuyerMarketTradeInfo = {
  id: number;
  tradeUuid: string;

  buyer: string; // 卖方
  requireResourceId: AllGameResourceID; // 求购资源id
  requireResourceCount: number; // 求购资源数量
  doneResourceCount: number; // 已经获得的资源数量

  payResourceId: AllGameResourceID; // 求购此资源愿意支付的资源id
  payPerUnit: number; // 求购此资源所需的资源数量

  isClosed: boolean;

  createTime: Date;
  closeTime?: Date;
};

export type ListToBuyerMarketInfo = {
  requireResourceId: AllGameResourceID;
  requireResourceCount: number;

  payResourceId: AllGameResourceID;
  payPerUnit: number;
};

export type RemoveFromBuyerMarketResult = {
  tradeUuid: string;

  requireResourceId: AllGameResourceID;
  doneResourceCount: number;

  remainRequireCount: number;
};

export type SellToBuyerMarketInfo = {
  tradeUuid: string;
  sellCount: number;

  sellerUuid: string;
};

export type MarkerTransactionInfo = {
  tradeUuid: string;

  buyerUuid: string;
  sellerUuid: string;

  tradeInfo: BuyerMarketTradeInfo;

  sellCount: number;
};
