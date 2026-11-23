import type { RedisClientType } from "redis";
import type { redisClient } from './redis';

// 尽量使用 UNLINK 异步释放，失败则回退到 DEL；支持批量分片
export async function safeUnlink(
  client: typeof redisClient,
  keys: string | string[],
  batchSize: number = 200
): Promise<void> {
  const arr: string[] = Array.isArray(keys) ? keys : [keys];
  for (let i = 0; i < arr.length; i += batchSize) {
    const chunk = arr.slice(i, i + batchSize);
    try {
      if (typeof client.unlink === 'function') {
        // node-redis v4 uses variadic arguments for unlink/del
        await client.unlink(chunk);
      } else {
        await client.del(chunk);
      }
    } catch {
      await client.del(chunk);
    }
  }
}

// 对超大 keys 数组进行分片 mGet，避免单次调用过大
export async function mGetChunked(
  client: typeof redisClient,
  keys: string[],
  batchSize: number = 500
): Promise<(string | null)[]> {
  if (!keys.length) return [];
  const out: (string | null)[] = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    const slice = keys.slice(i, i + batchSize);
    const part = await client.mGet(slice);
    if (Array.isArray(part)) out.push(...part);
  }
  return out;
}
