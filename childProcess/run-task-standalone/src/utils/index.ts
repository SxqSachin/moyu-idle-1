import { redisClient } from "./redis.js";

// Increase default lock expiry to avoid lock expiring during longer operations
const DEFAULT_REDIS_LOCK_EXPIRE = 8; // 秒 — 默认 60s（之前是 5s，可能太短导致锁过早失效）
async function acquireUniqueLock(lockKey: string, expireSec: number): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    // @ts-ignore
    const result = await redisClient.SET(lockKey, lockValue, {
        condition: "NX",
        EX: expireSec,
    });
    if (result === "OK") {
        return lockValue;
    }
    return null;
}

async function releaseUniqueLock(lockKey: string, lockValue: string) {
    // @ts-ignore
    const currentValue = await redisClient.get(lockKey);
    if (currentValue === lockValue) {
        // @ts-ignore
        await redisClient.del(lockKey);
    }
}

export async function withUniqueLock<T>(lockKey: string, fn: () => Promise<T>, options?: { ttlSeconds?: number }): Promise<T> {
    const MAX_RETRY = 5;
    const ttl = options?.ttlSeconds ?? DEFAULT_REDIS_LOCK_EXPIRE;
    let retry = 0;
    let lockValue: string | null = null;
    while (retry < MAX_RETRY) {
        lockValue = await acquireUniqueLock(lockKey, ttl);
        if (lockValue) break;
        await new Promise(res => setTimeout(res, 100 + Math.random() * 100));
        retry++;
    }

    if (!lockValue) {
      console.error(Date.now(), 'acquire lock failed', lockKey)
      throw new Error("操作过于频繁，请稍后重试");
    }
    try {
        return await fn();
    } finally {
        await releaseUniqueLock(lockKey, lockValue);
    }
}