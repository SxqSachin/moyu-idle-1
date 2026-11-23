import type { AllGameResourceID } from "./gameResource";

export type MarketTradeInfo = {
  id: number;
  tradeUuid: string;

  seller: string; // 卖方
  sellResourceId: AllGameResourceID; // 售卖资源id
  sellResourceCount: number; // 售卖资源数量
  selledResourceCount: number; // 已出售的资源数量

  costResourceId: AllGameResourceID; // 购买此资源所需的资源id
  costPerUnit: number; // 购买此资源所需的资源数量

  buyerInfo: any[];

  isClosed: boolean;

  createTime: Date;
  closeTime?: Date;

  // isPayListingFee?: boolean; // 是否支付了上架手续费
};

export type ListToMarketInfo = {
  sellResourceId: AllGameResourceID;
  sellResourceCount: number;

  costResourceId: AllGameResourceID;
  costPerUnit: number;
};

export type RemoveFromMarketResult = {
  tradeUuid: string;

  sellResourceId: AllGameResourceID;
  sellResourceCount: number;

  remainResourceCount: number;
};

export type BuyFromMarketInfo = {
  tradeUuid: string;
  buyCount: number;

  buyerUuid: string;
};

export type MarkerTransactionInfo = {
  tradeUuid: string;

  sellerUuid: string;
  buyerUuid: string;

  tradeInfo: MarketTradeInfo;

  buyCount: number;
};


import type { BuyerMarketTradeInfo } from "./buyerMarket";
export type UnifiedMarketRow =
  | ({ type: "sell" } & MarketTradeInfo)
  | ({ type: "buy" } & BuyerMarketTradeInfo);

export type MarketPriceData = {
  recentPrices: {
    sellOrders: Array<{
      costPerUnit: number;
      count: number;
      date: Date
    }>;
    buyOrders: Array<{
      payPerUnit: number;
      count: number;
      date: Date
    }>;
  };
  // priceStats: {
  //   sellPrices: {
  //     latest: number | null;
  //     average: number | null;
  //     min: number | null;
  //     max: number | null;
  //     count: number;
  //   };
  //   buyPrices: {
  //     latest: number | null;
  //     average: number | null;
  //     min: number | null;
  //     max: number | null;
  //     count: number;
  //   };
  // };
};
// 定义交易记录的类型
export interface SellTradeRecord {
  buyer: string;
  count: number;
  time: Date;
}

export interface BuyTradeRecord {
  seller: string;
  count: number;
  time: Date;
}