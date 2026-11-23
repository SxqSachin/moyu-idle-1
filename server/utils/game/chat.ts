import { getEquipmentActuralId } from "~/shared/utils/game/equipment"
import { broadcastEvent, exceptBroadcastEvent, emitEventToUser } from "~/server/io"
import { prisma } from "./db"
import { SFXMap, WorkSFXMap } from "~/shared/data/constant"
import { formatTime, safeJsonParse } from "~/shared/utils"
import type { PlayerProfileInfo } from "~/shared/types/characterInfo"
import { getUserCustomStyle } from "./style"
import { AccountPlayType } from "~/shared/types/account"
import { ChatMessage } from "~/shared/types/chat"

const headSFXMap = SFXMap

const contentReplacemap = {
  "你的亲妈": "我的亲妈",
  "你亲妈": "我亲妈",
  "你妈": "我妈",

  "你的全家": "我的全家",
  "你全家": "我全家",

  "他的全家": "他的全家",
  "他全家": "他全家",

  "你的野爹": "我的野爹",
  "你野爹": "我野爹",
  "你亲爹": "我亲爹",
  "你爹": "我爹",

  "他的亲妈": "我的亲妈",
  "他亲妈": "我亲妈",
  "他妈": "我妈",

  "他的老婆": "我的老婆",
  "他老婆": "我老婆",

  "他的女儿": "我的女儿",
  "他女儿": "我女儿",

  "他的野爹": "我的野爹",
  "他野爹": "我野爹",
  "他亲爹": "我亲爹",
  "他爹": "我爹",

  "草你": "草我",
  "草拟": "草我",

  "游戏作者": "我",
  "作者": "我"
}

export const createChatMsg = async (
    senderUuid: string,
    content: string,
    receiverId?: string,
    receiverName?: string,
) => {
    let extraSFX = ""

    const userEquipment = await prisma.characterEquipment.findFirst({
      where: { character_uuid: senderUuid },
    })
    const userWorkEquipment = await prisma.characterWorkEquipment.findFirst({
      where: { character_uuid: senderUuid },
    })

    // 替换敏感词
    Object.keys(contentReplacemap).forEach((key) => {
      const value = contentReplacemap[key as keyof typeof contentReplacemap]
      const regex = new RegExp(key, "g")
      content = content.replace(regex, value)
    })

    if (userEquipment?.head) {
      let equipmentId = getEquipmentActuralId(userEquipment.head)
      if (userEquipment?.head && headSFXMap[equipmentId]) {
        extraSFX = headSFXMap[equipmentId]
      }
    }

    // 特有的工作装覆盖
    if (userWorkEquipment?.head) {
      let equipmentId = getEquipmentActuralId(userWorkEquipment.head)
      if (userWorkEquipment?.head && WorkSFXMap[equipmentId]) {
        extraSFX = WorkSFXMap[equipmentId]
      }
    }

    // NOTE: 生成新 Prisma Client 前先用宽松选择，后面通过索引访问避免类型冲突
    let sender = await prisma.user.findUnique({
      where: { uuid: senderUuid },
      select: {
        uuid: true,
        name: true,
        option: true,
        guildTitle: true,
        accountPlayType: true,
        current_title: true,
        // @ts-ignore 新字段生成后可移除注释
        is_muted: true,
        // @ts-ignore
        mute_until: true,
      } as any
    }) as any

    let senderStyle = await getUserCustomStyle(senderUuid);

    if (!sender) {
        throw new Error("Sender not found")
    }

    // 禁言校验：如果用户被禁言并且未过期，阻止发送
    if (sender["is_muted"]) {
      const now = new Date()
      if (sender["mute_until"] && new Date(sender["mute_until"]).getTime() <= now.getTime()) {
        // 已经过期，自动解除
        // 使用 raw SQL 解除禁言，避免未生成类型时报错
        await prisma.user.update({ where: { uuid: senderUuid }, data: { is_muted: false, mute_until: null } })
        sender["is_muted"] = false
        sender["mute_until"] = null
      } else {
        throw new Error(sender["mute_until"]
          ? `您已被禁言，直到 ${formatTime(sender["mute_until"])}`
          : '您已被永久禁言，请联系管理员')
      }
    }

    let senderOption = safeJsonParse<PlayerProfileInfo['option']>(sender.option, {}) || {}

    let extra: ChatMessage['extra2'] = {
      guildTitle: sender.guildTitle,
    }

    if (sender.accountPlayType == AccountPlayType.IRON) {
      extra.ironcat = true
    }

    if (senderStyle.currentChatNameStyle) {
      extra.nameStyle = senderStyle.currentChatNameStyle;
    }
    if (senderStyle.currentChatContentStyle) {
      extra.contentStyle = senderStyle.currentChatContentStyle;
    }
    if (senderStyle.currentChatBubbleStyle) {
      extra.bubble = senderStyle.currentChatBubbleStyle;
    }

    if (senderStyle.diyChatBubbleStyle) {
      extra.bubbleDiyStyle = senderStyle.diyChatBubbleStyle;
    }

    if (senderOption.hideGuildTitleInChat) {
      delete extra.guildTitle
    }

    // 存储消息
    const msg = await prisma.chatMessage.create({
      data: {
        sender: senderUuid,
        sender_name: sender.name,
        receiver_id: receiverId,
        receiver_name: receiverName,
        content,
        created_at: new Date(),
        is_revoked: false,
        is_deleted: false,
        extra: sender.current_title,
        extra2: JSON.stringify(extra),
        extraSFX,
      }
    })

    return msg
}

export function sanitizeChatContent(content: string): string {
  let sanitized = content.trim()
  if (sanitized.length > 500) sanitized = sanitized.slice(0, 500)
  sanitized = sanitized.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return sanitized
}

// ================== 屏蔽列表通用实现 ==================
// 缓存键与 TTL（与聊天模块中保持一致）
const BLOCK_CACHE_TTL_SECONDS = 60
export const buildBlockCacheKey = (uuid: string) => `chat:blockCache:${uuid}`

/**
 * 刷新指定用户的公屏屏蔽缓存
 * 缓存结构: { all: string[], public: string[] }
 * all:  blockAll=true 的目标玩家
 * public: 仅 blockPublicChat=true (且非 blockAll) 的目标玩家
 */
export async function refreshBlockCache(blockerUuid: string) {
  try {
    const rows = await prisma.userBlock.findMany({
      where: {
        blockerUuid,
        OR: [ { blockAll: true }, { blockPublicChat: true } ]
      },
      select: { targetUuid: true, blockAll: true }
    })
    const payload = {
      all: rows.filter(r => r.blockAll).map(r => r.targetUuid),
      public: rows.filter(r => !r.blockAll).map(r => r.targetUuid)
    }
    await redisClient.set(buildBlockCacheKey(blockerUuid), JSON.stringify(payload), {
      expiration: { type: 'EX', value: BLOCK_CACHE_TTL_SECONDS }
    })
  } catch (e) {
    // 忽略缓存刷新错误
  }
}

/**
 * 获取缓存中的屏蔽列表（若无则回源数据库并写入缓存）
 * 返回结构与缓存一致: { all: string[], public: string[] }
 */
export async function getBlockListCached(blockerUuid: string): Promise<{ all: string[]; public: string[] }> {
  const cacheKey = buildBlockCacheKey(blockerUuid)
  // 读缓存
  try {
    const cacheStr = await redisClient.get(cacheKey)
    if (cacheStr) {
      const parsed = JSON.parse(cacheStr)
      // 兼容性校验
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.all) && Array.isArray(parsed.public)) {
        return parsed
      }
    }
  } catch {}

  // 回源数据库
  try {
    const direct = await prisma.userBlock.findMany({ where: { blockerUuid } })
    const payload = {
      all: direct.filter(d => d.blockAll).map(d => d.targetUuid),
      public: direct.filter(d => d.blockPublicChat && !d.blockAll).map(d => d.targetUuid)
    }
    try {
      await redisClient.set(cacheKey, JSON.stringify(payload), {
        expiration: { type: 'EX', value: BLOCK_CACHE_TTL_SECONDS }
      })
    } catch {}
    return payload
  } catch {
    // 数据库失败时返回空结构
    return { all: [], public: [] }
  }
}

/**
 * 获取用于过滤公屏消息的合并后屏蔽集合 (blockAll + blockPublicChat)
 */
export async function getBlockedPublicChatSet(blockerUuid: string): Promise<Set<string>> {
  // 优先读缓存
  try {
    const cacheStr = await redisClient.get(buildBlockCacheKey(blockerUuid))
    if (cacheStr) {
      const parsed = JSON.parse(cacheStr)
      const merged: string[] = [ ...(parsed.all || []), ...(parsed.public || []) ]
      return new Set(merged)
    }
  } catch {}
  // 缓存缺失 → 直接调用刷新逻辑再取（避免重复代码）
  await refreshBlockCache(blockerUuid)
  try {
    const cacheStr = await redisClient.get(buildBlockCacheKey(blockerUuid))
    if (cacheStr) {
      const parsed = JSON.parse(cacheStr)
      const merged: string[] = [ ...(parsed.all || []), ...(parsed.public || []) ]
      return new Set(merged)
    }
  } catch {}
  // 仍无 → DB 查询最小字段
  try {
    const rows = await prisma.userBlock.findMany({
      where: { blockerUuid, OR: [ { blockAll: true }, { blockPublicChat: true } ] },
      select: { targetUuid: true }
    })
    return new Set(rows.map(r => r.targetUuid))
  } catch {
    return new Set()
  }
}

/**
 * 获取屏蔽了指定发送者(senderUuid)的所有用户（用于公屏广播时排除）
 * - 仅返回在线用户列表（离线用户无需排除）
 * - 条件：这些用户对 senderUuid 设置了 blockAll 或 blockPublicChat
 * - 为减少 DB 压力：
 *    1. 先获取所有在线用户 UUID；
 *    2. 对这些在线用户逐一尝试从缓存读取其公屏屏蔽集合；
 *    3. 命中缓存且包含 senderUuid 即加入结果；
 *    4. 对于缓存未命中的用户，批量一次性查询 DB 过滤，随后可选择刷新缓存（这里懒加载：只处理命中者刷新）。
 *
 * 复杂度：O(OnlineUsers) + 少量命中 DB；适用于在线人数相对可控场景。
 */
export async function getOnlineUsersWhoBlockedSender(senderUuid: string): Promise<string[]> {
  try {
    const online = await redisClient.sMembers('online-users')
    if (!online?.length) return []

    // 并行读取缓存，降低总延迟
    const cacheResults = await Promise.all(online.map(u => redisClient.get(buildBlockCacheKey(u)).catch(()=>null)))
    const blockers: string[] = []
    const missing: string[] = []

    cacheResults.forEach((cacheStr, idx) => {
      const u = online[idx]
      if (!cacheStr) { missing.push(u); return }
      try {
        const parsed = JSON.parse(cacheStr)
        const merged: string[] = [ ...(parsed.all || []), ...(parsed.public || []) ]
        if (merged.includes(senderUuid)) blockers.push(u)
      } catch { /* ignore single parse error */ }
    })

    if (missing.length) {
      try {
        const rows = await prisma.userBlock.findMany({
          where: {
            blockerUuid: { in: missing },
            targetUuid: senderUuid,
            OR: [ { blockAll: true }, { blockPublicChat: true } ]
          },
          select: { blockerUuid: true }
        })
        for (const r of rows) {
          blockers.push(r.blockerUuid)
          refreshBlockCache(r.blockerUuid).catch(()=>{})
        }
      } catch { /* ignore */ }
    }

    return blockers
  } catch { return [] }
}

/**
 * 统一的公屏/铁公屏消息广播逻辑：
 * - 若无人屏蔽发送者：broadcastEvent -> 所有人（包括发送者）
 * - 若有人屏蔽：exceptBroadcastEvent 排除(屏蔽者 + 发送者) 然后 emitEventToUser 给发送者
 */
export async function broadcastPublicLikeChat(
  kind: 'public' | 'ironPublic',
  senderUuid: string,
  chatMsg: any,
): Promise<void> {
  const blockers = await getOnlineUsersWhoBlockedSender(senderUuid)
  const ev = kind === 'public' ? 'chat:newPublicChatMsg' : 'chat:newIronPublicChatMsg'
  if (blockers.length === 0) {
    broadcastEvent(ev, chatMsg)
    return
  }
  const exceptList = Array.from(new Set([...blockers, senderUuid]))
  exceptBroadcastEvent(ev, chatMsg, { except: exceptList })
  emitEventToUser(senderUuid, ev, chatMsg)
}

// ================== 屏蔽功能额外校验与常量 ==================
export const MAX_BLOCK_COUNT = 200
const UUID_REGEX = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/

export function normalizeAndValidateTargetUuid(raw: any): string {
  if (typeof raw !== 'string') throw new Error('targetUuid格式不合法')
  const t = raw.trim()
  if (!t) throw new Error('targetUuid不能为空')
  if (t.length > 64) throw new Error('targetUuid过长')
  if (!UUID_REGEX.test(t)) throw new Error('targetUuid格式不合法')
  return t.toLowerCase()
}

