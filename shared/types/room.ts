export interface Room {
  uuid: string;
  name: string;
  isPublic: boolean;
  ownerId: string;
  memberIds: string[];
  maxMembers: number;
  createdAt: number;

  viewerMemberUuids: string[];

  lastUpdateAt: number;

  status: "waiting" | "go_to_area" | "started" | "ended" | "battling" | "waiting_for_restart" | "waiting_for_autostart";
  waitingForRestartTime?: number; // 是否等待重启

  waitingForAutoStartTime?: number; // 是否等待自动开始

  arriveAreaTime?: number; // 是否到达战斗区域

  type: "room" | "battle";
  readyMap: Record<string, boolean>; // 新增：记录每个成员的准备状态
}