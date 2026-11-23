// 钓鱼模块共享常量
export const FISHING_DUE_ZSET = 'FISHING_DUE_ZSET'

// 默认判定间隔（毫秒）：线上默认 5 - 12 分钟
export const DEFAULT_MIN_TICK_MS = 5 * 60_000
export const DEFAULT_MAX_TICK_MS = 12 * 60_000

// 启动时将活跃会话加入 ZSET 的随机抖动（毫秒），避免雪崩
export const BOOTSTRAP_JITTER_MS = 6_000

// 处理池参数
export const POP_LIMIT = 200
export const LEASE_TTL_MS = 30_000

// Redis 租约前缀
export const FISHING_LEASE_PREFIX = 'fishing_lease:'

// 可见范围（逻辑坐标距离，单位与 pointX/pointY 相同）
export const VISIBLE_RADIUS = 205
