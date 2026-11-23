import { Server as Engine } from "engine.io";
import { Server } from "socket.io";
import { defineEventHandler, H3Event, toEventHandler } from "h3";
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

import ioRoute, { emitEventToUser } from "@/server/io";

// ================= Rate Limiting (AOP Wrapper) =================
// 可调参数：窗口大小 & 次数上限；触发后的具体惩罚/记录逻辑留给开发者在 onRateLimitTriggered 中自定义。
// 说明：采用固定时间窗口 + Redis INCR，首次数量置 1 并设置 TTL，超过阈值即判定命中。
// 不做自动封禁/断开，仅回调 + 可选发事件，保证最小侵入。根据需要自行扩展。

// 每个事件单独限制（单用户单事件）
const RL_PER_EVENT_WINDOWS: { windowSec: number; limit: number }[] = [
  { windowSec: 5, limit: 300 },
  { windowSec: 10, limit: 450 },
];

// 用户全局总事件频率限制（所有事件合并计数）
const RL_PER_USER_WINDOWS: { windowSec: number; limit: number }[] = [
  { windowSec: 5, limit: 1000 },
  { windowSec: 30, limit: 1500 },
  { windowSec: 60, limit: 20000 },
];

// 白名单事件（不计数/不限制）
const RL_EVENT_WHITELIST = new Set<string>([
  // 'ping', 'heartbeat' 等可以列在这里
]);

// 白名单用户（例如管理员），可根据权限系统动态加载
const RL_USER_WHITELIST = new Set<string>([
  // 'admin-uuid-1'
]);

// 当检测命中时调用；开发者可在此写入日志、埋点、封禁、告警等。
// reason: 'per_event' | 'per_user'
async function onRateLimitTriggered(info: {
  socket: any;
  userUuid: string;
  event: string;
  reason: string;
  windowSec: number;
  limit: number;
  count: number;
}) {
  // TODO: 自行实现处理逻辑（写数据库 / 告警 / 临时封禁等）
  // 这里默认简单回传一个通知事件，前端可选择忽略或提示。
  console.log("Rate limit triggered", info.userUuid, info.event);
  try {
    emitEventToUser(info.userUuid, 'rate_limited')

    // @ts-ignore
    const h3e = new H3Event(info.socket.request, null);
    await clearUserSession(h3e)
  } catch (_) { /* 忽略 */ }
}

async function rlIncrAndCheck(key: string, windowSec: number, limit: number): Promise<{ over: boolean; count: number; }> {
  const count = await redisClient.incr(key);
  await redisClient.expire(key, windowSec);
  return { over: count > limit, count };
}

async function checkRateLimit(userUuid: string, event: string, socket: any): Promise<boolean> { // 返回 true 表示已拦截
  if (!userUuid) return false;
  if (RL_USER_WHITELIST.has(userUuid)) return false;
  if (RL_EVENT_WHITELIST.has(event)) return false;

  // Per-Event 限制
  for (const w of RL_PER_EVENT_WINDOWS) {
    const key = `rl:u:${userUuid}:ev:${event}:${w.windowSec}`;
    const { over, count } = await rlIncrAndCheck(key, w.windowSec, w.limit);
    if (over) {
      onRateLimitTriggered({ socket, userUuid, event, reason: 'per_event', windowSec: w.windowSec, limit: w.limit, count });
      return true;
    }
  }

  // 全局用户限制
  for (const w of RL_PER_USER_WINDOWS) {
    const key = `rl:u:${userUuid}:all:${w.windowSec}`;
    const { over, count } = await rlIncrAndCheck(key, w.windowSec, w.limit);
    if (over) {
      onRateLimitTriggered({ socket, userUuid, event, reason: 'per_user', windowSec: w.windowSec, limit: w.limit, count });
      return true;
    }
  }

  return false;
}

export const engine = new Engine();
export const io = new Server()

const runtimeConfig = useRuntimeConfig();

export default defineNitroPlugin(async (nitroApp: any) => {
  io.bind(engine);

  // 连接到主服务器的 Redis
  const pubClient = createClient({
    url: runtimeConfig.REDIS_URL,
  });
  const subClient = pubClient.duplicate();

  // pubClient.on("error", (err) => console.error("Redis PubClient Error", err));
  // subClient.on("error", (err) => console.error("Redis SubClient Error", err));

  await Promise.all([pubClient.connect(), subClient.connect()])

  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    Object.keys(ioRoute).forEach((event) => {
      // @ts-ignore
      const handler = ioRoute[event];

      socket.on(event, async (data) => {
        // 创建 H3Event 以进行会话验证
        // @ts-ignore
        const h3e = new H3Event(socket.request, null);
        try {
          const session = await getUserSession(h3e);
          if (!(data && data.user && Object.hasOwn(data.user, 'uuid'))) return; // 缺少用户信息直接忽略

          const incomingUuid = data.user.uuid;
          if (incomingUuid !== session.user?.uuid || !session.user?.uuid) {
            throw new Error("Unauthorized");
          }
          // 速率限制（通过后才执行业务逻辑）
          const intercepted = await checkRateLimit(session.user!.uuid, event, socket);
          if (intercepted) {
            return
          } // 命中限流直接返回
          handler(socket, data);
        } catch (err) {
          // 可在此添加日志：console.warn('socket event error', event, err)
        }
      });
    });

    socket.on('disconnecting', async () => {
      let roomId = await redisClient.get(`socket:${socket.id}`);

      if (roomId) {
        socket.leave(roomId);

        let userUuid = roomId?.replace("room-", "");
        if (userUuid) {
          await redisClient.sRem("online-users", userUuid);
          await prisma.user.update({
            where: { uuid: userUuid },
            data: { last_offline_date: new Date() },
          })
        }

        await redisClient.del(`socket:${socket.id}`);
        await redisClient.sRem('battle-panel-users', userUuid);
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    // console.log(err.req);      // the request object
    // console.log(err.code);     // the error code, for example 1
    // console.log(err.message);  // the error message, for example "Session ID unknown"
    // console.log(err.context);  // some additional error context
  });


  nitroApp.router.use("/socket.io/", defineEventHandler({
    handler(event: any) {
      engine.handleRequest(event.node.req, event.node.res);
      event._handled = true;
    },
    websocket: {
      open(peer) {
        // @ts-expect-error private method and property
        engine.prepare(peer._internal.nodeReq);
        // @ts-expect-error private method and property
        engine.onWebSocket(peer._internal.nodeReq, peer._internal.nodeReq.socket, peer.websocket);
      }
    }
  }));
});