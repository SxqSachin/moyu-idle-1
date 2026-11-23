import { Prisma } from "~/generated/prisma";

const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 死锁错误码
const DEADLOCK_ERROR_CODE = 'P2034'; // Prisma 死锁错误码
const MYSQL_DEADLOCK_ERRNO = 1213;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 50; // 初始延迟，会指数退避

const isDeadlockError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma 死锁错误码
    if (error.code === DEADLOCK_ERROR_CODE) return true;
    
    // 原生 MySQL 死锁错误
    const meta = error.meta as { code?: string; errno?: number } | undefined;
    if (meta?.errno === MYSQL_DEADLOCK_ERRNO) return true;
    if (meta?.code === 'ER_LOCK_DEADLOCK') return true;
  }
  
  // 检查原始错误消息
  const message = String(error);
  return message.includes('Deadlock found') || 
         message.includes('ER_LOCK_DEADLOCK') ||
         message.includes('1213');
};

export async function dbExecuteWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isDeadlockError(error)) {
        console.error(`[${operationName}] 非死锁错误，停止重试:`, error);
        // 非死锁错误，直接抛出
        throw error;
      }
      
      if (attempt === maxRetries) {
        console.error(
          `[${operationName}] 死锁重试耗尽，共尝试 ${maxRetries} 次:`,
          error
        );
        break;
      }
      
      // 指数退避延迟: 50ms, 100ms, 200ms
      const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[${operationName}] 检测到死锁，第 ${attempt} 次重试，${delayMs}ms 后重试...`,
        { userUuid: (error as any)?.meta?.target || 'unknown' }
      );
      await sleep(delayMs);
    }
  }
  
  throw lastError;
}