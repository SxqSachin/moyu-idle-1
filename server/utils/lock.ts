type UniqueLockOptions = {
    expireSec?: number; // lock ttl
    maxRetry?: number;  // retry attempts
    minDelayMs?: number; // backoff min
    maxDelayMs?: number; // backoff max
};

const DEFAULT_REDIS_LOCK_EXPIRE = 5; // 秒
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

export async function withUniqueLock<T>(lockKey: string, fn: () => Promise<T>, options: UniqueLockOptions = {}): Promise<T> {
    const MAX_RETRY = options.maxRetry ?? 5;
    const EXPIRE_SEC = options.expireSec ?? DEFAULT_REDIS_LOCK_EXPIRE;
    const MIN_DELAY = options.minDelayMs ?? 100;
    const MAX_DELAY = options.maxDelayMs ?? 200;
    let retry = 0;
    let lockValue: string | null = null;
    while (retry < MAX_RETRY) {
        lockValue = await acquireUniqueLock(lockKey, EXPIRE_SEC);
        if (lockValue) break;
        const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
        await new Promise(res => setTimeout(res, delay));
        retry++;
    }

    if (!lockValue) {
      console.error(Date.now(), 'release key failed', lockKey)
      throw new Error("操作过于频繁，请稍后重试");
    }
    try {
        return await fn();
    } finally {
        await releaseUniqueLock(lockKey, lockValue);
    }
}