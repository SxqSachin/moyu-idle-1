import type { initClientBundle } from "@nuxt/icon/runtime/components/shared.js";
import type { MinMax } from "../types";

export const delay = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const waitUtil = async (condition: () => boolean | Promise<boolean>, interval = 100, timeout = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    let elapsed = 0;
    const timer = setInterval(async () => {
      if (await condition()) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= timeout) {
        clearInterval(timer);
        resolve(false);
      }
      elapsed += interval;
    }, interval);
  });
}


export const formatTimeToStr = (date: Date | string | number | undefined) => {
  if (!date) return '';
  if (typeof date === 'string' || typeof date === 'number') {
    date = new Date(date);
  }
  const now = Date.now();
  const time = (date as Date).getTime();
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return '刚刚';
  } else if (diffMin < 60) {
    return `${diffMin}分钟前`;
  } else if (diffHour < 3) {
    return `${diffHour}小时前`;
  } else {
    return (date as Date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
export const formatTime = (date: Date | string | number | undefined, opt?: {
  hideSecond?: boolean
}) => {
  if (!date) {
    return ''
  }
  if (typeof date == 'string' || typeof date == 'number') {
    date = new Date(date)
  }

  if (opt?.hideSecond) {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
export function randomIntegerInFullCloseRange(min: number, max: number): number
export function randomIntegerInFullCloseRange(range: MinMax): number

export function randomIntegerInFullCloseRange(min: number | MinMax, max?: number): number {
  if (typeof min == 'number' && !!max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled); 
  }

  min = min as MinMax

  const minCeiled = Math.ceil(min.min);
  const maxFloored = Math.floor(min.max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled); 
}


export function randomNumberInFullColseRange(min: number, max: number): number
export function randomNumberInFullColseRange(range: MinMax): number

export function randomNumberInFullColseRange(min: number | MinMax, max?: number): number {
  const getFullClose = (n: number, m: number): number => {
    if (n == 0 && m == 1) {
      return Math.random()
    }

    return Math.random() * (m - n) + n;
  }

  if (typeof min == 'number' && !!max) {
    return getFullClose(min, max)
  }

  min = min as MinMax
  return getFullClose(min.min, min.max)
}

const nativeStructuredClone: typeof structuredClone | undefined = (globalThis as any)?.structuredClone;

const jsonClone = <T>(obj: T): T => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

// 冷启动时决定具体实现，避免每次调用都做 typeof 判断
const cloneImpl: <T>(obj: T) => T = (() => {
  if (nativeStructuredClone) {
    return <T>(obj: T): T => {
      // 原始类型直接返回，避免无谓拷贝
      if (obj === null || typeof obj !== 'object') return obj;
      try {
        return nativeStructuredClone(obj);
      } catch {
        return jsonClone(obj);
      }
    };
  }
  return <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    return jsonClone(obj);
  };
})();

export function clone<T>(obj: T): T {
  return cloneImpl(obj);
}

export function randomString(length: number) {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (var i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function randomElementInCollection<T>(collection: Iterable<T>): T | undefined {
  if (!collection || typeof collection[Symbol.iterator] !== 'function') {
    return undefined
  }

  const arr = Array.from(collection);
  if (arr.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}


export function randomElementsInCollection<T>(collection: Iterable<T>, count: number, option?: {
  // 是否允许重复
  allowDuplicates?: boolean
}): T[] {
  if (!collection || typeof collection[Symbol.iterator] !== 'function') {
    return []
  }

  const arr = Array.from(collection);
  const n = arr.length;
  if (n === 0) return [];

  count = Math.max(0, Math.floor(count));

  // 允许重复：直接随机抽取
  if (option?.allowDuplicates) {
    const res: T[] = [];
    for (let i = 0; i < count; i++) {
      res.push(arr[Math.floor(Math.random() * n)]);
    }
    return res;
  }

  // 不允许重复且请求数 >= 集合大小，返回随机打散的整个数组（避免顺序偏差）
  if (count >= n) {
    const copy = arr.slice();
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // 不允许重复且 count < n：使用部分 Fisher-Yates（O(count) swaps）保证无重复且高效
  const copy = arr.slice();
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (n - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

// @ts-ignore
export function ObjectKeys<Key>(obj: any): Key[] {
  return Object.keys(obj ?? {}) as Key[]
}

export function ObjectKeysTyped<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj ?? {}) as (keyof T)[];
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let result = ''
  if (days > 0) result += `${days}天`
  if (hours > 0) result += `${hours}小时`
  if (minutes > 0) result += `${minutes}分`
  // 只有在前面都没有单位时才显示0秒，否则仅在秒数大于0时显示
  if (seconds > 0 || (!days && !hours && !minutes)) result += `${seconds}秒`
  return result
}



export function groupByIp<T extends {ip?: string, fp?: string}>(arr: T[]): {
  uniqueList: T[],
  groupMap: Record<string, T[]>,
  duplicateGroups: Record<string, T[]>
} {
  const groupMap: Record<string, T[]> = {};
  const uniqueList: T[] = [];
  const seenKey = new Set<string>();
  const duplicateGroups: Record<string, T[]> = {};
  // 认为这些本地/异常IP都算作不重复
  const ignoreIpSet = new Set([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
    ''
  ]);

  for (const item of arr) {
    const ip = item.ip || '';
    const fp = item.fp || '';

    // 如果 ip 或 fp 有一个为空，则跳过该用户的检查，直接加入 uniqueList
    if (!ip || !fp) {
      uniqueList.push(item);
      continue;
    }

    const key = `${ip}__${fp}`;
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(item);

    // 忽略本地/异常IP，始终算作不重复
    if (ignoreIpSet.has(ip)) {
      uniqueList.push(item);
      continue;
    }

    if (!seenKey.has(key)) {
      uniqueList.push(item);
      seenKey.add(key);
    }
  }

  // 归组所有重复ip+fp的数据
  for (const key in groupMap) {
    if (groupMap[key].length > 1) {
      duplicateGroups[key] = groupMap[key];
    }
  }

  return { uniqueList, groupMap, duplicateGroups };
}

export function safeJsonParse<T>(json: string | undefined | null, def?: any): T {
  if (!json) return def;
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.error("JSON parse error:", e);
    return def !== undefined ? def : def;
  }
}

export function formatNumber(num: number | undefined | null) {
    return (num ?? 0).toLocaleString();
}

export const formatCountToStr = (count: number) => {
    if (count >= 1_000_000_000) {
        return (count / 1_000_000_000).toFixed(count % 1_000_000_000 === 0 ? 0 : 1) + 'B';
    } else if (count >= 1_000_000) {
        return (count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1) + 'M';
    } else if (count >= 100_00) {
        return (count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1) + 'k';
    } else {
        return count;
    }
}

export function sanitizeInput(str: string) {
    if (!str) return '';
    let s = str.trim();
    // 移除script等危险标签
    s = s.replace(/<script.*?>.*?<\/script>/gi, '');
    // 移除常见SQL注入关键字和符号
    s = s.replace(/('|;|--|\/\*|\*\/|xp_|exec|union|select|update|delete|insert|drop|alter|create|truncate|declare|sleep|benchmark)/gi, '');
    // 只允许中英文、数字、下划线、@、.、-，其余字符过滤
    s = s.replace(/[^\u4e00-\u9fa5\w@.\-]/g, '');
    // XSS转义
    s = escapeHtml(s);
    // 限制最大长度
    return s.slice(0, 50);
}

export function escapeHtml(str: string) {
    return str.replace(/[&<>"'`=\/]/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#96;',
            '=': '&#61;',
            '/': '&#47;'
        } as any)[s];
    });
}

/**
 * Base62编码工具类
 * 用于将UUID转换为短码，保证唯一性和可逆性
 */
export class Base62 {
  private static readonly chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  
  /**
   * 将UUID转换为Base62短码
   * @param uuid 标准UUID格式 (8-4-4-4-12)
   * @returns Base62编码的短码 (约10-12个字符)
   */
  static encode(uuid: string): string {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error('Invalid UUID format');
    }
    
    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new Error('Invalid UUID format');
    }
    
    // 移除连字符，转为16进制大整数
    const hex = uuid.replace(/-/g, '').toLowerCase();
    const num = BigInt('0x' + hex);
    
    if (num === 0n) return '0';
    
    let result = '';
    let n = num;
    while (n > 0n) {
      result = this.chars[Number(n % 62n)] + result;
      n = n / 62n;
    }
    
    return result;
  }
  
  /**
   * 将Base62短码还原为UUID
   * @param shortCode Base62编码的短码
   * @returns 标准UUID格式
   */
  static decode(shortCode: string): string {
    if (!shortCode || typeof shortCode !== 'string') {
      throw new Error('Invalid short code');
    }
    
    // 验证短码字符是否都在Base62字符集中
    for (let char of shortCode) {
      if (this.chars.indexOf(char) === -1) {
        throw new Error('Invalid characters in short code');
      }
    }
    
    let num = 0n;
    for (let char of shortCode) {
      num = num * 62n + BigInt(this.chars.indexOf(char));
    }
    
    // 转回16进制并补齐32位
    let hex = num.toString(16).padStart(32, '0');
    
    // 重新插入连字符，形成标准UUID格式
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  
  /**
   * 验证短码是否有效
   * @param shortCode 要验证的短码
   * @returns 是否为有效短码
   */
  static isValid(shortCode: string): boolean {
    try {
      const decoded = this.decode(shortCode);
      const reencoded = this.encode(decoded);
      return reencoded === shortCode;
    } catch {
      return false;
    }
  }
}

/**
 * 生成用户推荐码（基于UUID）
 * @param userUuid 用户UUID
 * @returns 推荐短码
 */
export function generateReferralCode(userUuid: string): string {
  try {
    return Base62.encode(userUuid);
  } catch (error) {
    throw new Error(`Failed to generate referral code: ${error}`);
  }
}

/**
 * 从推荐码获取推荐人UUID
 * @param referralCode 推荐短码
 * @returns 推荐人UUID，无效时返回null
 */
export function getReferrerUuidFromCode(referralCode: string): string | null {
  try {
    return Base62.decode(referralCode);
  } catch {
    return null;
  }
}

/**
 * 验证推荐码是否有效
 * @param referralCode 推荐短码
 * @returns 是否有效
 */
export function isValidReferralCode(referralCode: string): boolean {
  return Base62.isValid(referralCode);
}

export function getRandomElementInPoolWithWeight(
  pool: Record<string, number>,
): string {
  const keys = Object.keys(pool);
  const totalWeight = keys.reduce((s, k) => s + (pool[k] || 0), 0);
  let finalKey = "";

  if (totalWeight > 0) {
    // 依据权重随机选取资源
    const r = Math.random() * totalWeight;

    let acc = 0;
    for (const k of keys) {
      acc += pool[k] || 0;

      if (r <= acc) {
        finalKey = k;
        break;
      }
    }
  }

  return finalKey;
}