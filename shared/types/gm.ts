import type { MinMax } from ".";

export type GMRestockMarketInput = {
    resourceId: string;
    count: MinMax;
    cost: MinMax;
}