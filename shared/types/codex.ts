export type PlayerUnitKillCodex = {
  userUuid: string;
  unitId: string;
  killCount: number;
  firstKillAt: Date | null;
  lastKillAt: Date | null;
};

export type PlayerItemCollectCodex = {
  userUuid: string;
  itemId: string;
  firstAcquiredAt: Date | null;
};

export type RecordUnitKillInput = {
  userUuid: string;
  unitId: string;
  delta?: number; // default 1
  occurredAt?: Date; // default now
};

export type RecordUnitKillResult = {
  record: PlayerUnitKillCodex;
  isFirstKill: boolean;
};

export type TouchItemCollectInput = {
  userUuid: string;
  itemId: string;
  acquiredAt?: Date; // default now
};

export type TouchItemCollectResult = {
  record: PlayerItemCollectCodex;
  isFirstAcquire: boolean;
};
