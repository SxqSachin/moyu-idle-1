import { createClient } from "redis";
export const redisClient = await createClient({
    url: process.env.REDIS_URL,
    
    // 连接配置
    socket: {
        connectTimeout: 5000,        // 连接超时
        commandTimeout: 5000,        // 命令超时
        lazyConnect: true,           // 延迟连接
        keepAlive: 30000,           // 保活时间
        noDelay: true,              // 禁用 Nagle 算法
        reconnectStrategy: (retries) => {
            // 重连策略
            if (retries > 10) return new Error('Too many retries');
            return Math.min(retries * 50, 500);
        }
    },
    
    // 命令队列配置
    commandsQueueMaxLength: 100000,   // 命令队列最大长度
    
    // 禁用某些功能以提升性能
    disableOfflineQueue: true,     // 保留离线队列
    
    // Pub/Sub 配置
    pingInterval: 30000,            // ping 间隔
})
    .on("error", (err) => console.log("Redis Client Error", err))
    .connect();

    console.log(Date.now(), "Redis client connected successfully", process.env.REDIS_URL);