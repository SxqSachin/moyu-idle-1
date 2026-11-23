import pino from 'pino';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

// 项目根目录 logs/app 路径
const logDir = resolve(process.cwd(), 'logs/server');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// 工厂函数：为每种事件创建专属 logger
export function createEventLogger(eventName: string) {
  const filePath = resolve(logDir, `${eventName}.log`);
  return pino(
    {
      level: process.env.PINO_LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.destination(filePath)
  );
}

// 示例：为 battle 事件和 trade 事件创建 logger
export const tradeLogger = createEventLogger('trade');
export const enhanceLogger = createEventLogger('enhance');
export const inventoryLogger = createEventLogger('inventory');
export const equipmentLogger = createEventLogger('equipment');

// 默认 logger 依然可用
export const logger = pino(
  {
    level: process.env.PINO_LOG_LEVEL || 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  // pino.destination(resolve(logDir, 'app.log'))
);