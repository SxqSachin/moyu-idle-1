// @ts-nocheck

import { defineEventHandler, readMultipartFormData } from 'h3'
import { prisma } from '~/server/utils/game/db'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { statSync } from 'node:fs'
import crypto from 'node:crypto'
// @ts-ignore runtime dependency, types provided after install
import sharp from 'sharp'
import { checkCanUseCustomAvatar } from '~/server/utils/game/character'
import { invoke as invokeImageModeration } from '~/server/utils/aliyun/gwf'

// Max raw upload file size (bytes)
const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_DIMENSION = 512 // pixels (will be resized to 256x256)
const OUTPUT_SIZE = 256
// 允许的基础类型（已禁用 GIF 上传）
const ALLOWED_MIME = new Set(['image/png','image/jpeg','image/jpg'])

// ---- Helpers ----
const respond = (code: number, msg: string, data: any = undefined) => ({ code, msg, ...(data !== undefined ? { data } : {}) })

const randomSuffix = () => Math.random().toString(36).slice(2,10)

function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'image/png'
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) return 'image/gif'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  return null
}

async function rateLimit(uuid: string) {
  try {
    // 10分钟窗口内最多允许5次
    // @ts-ignore
    const key = `avatar:upload:count:${uuid}`
    // @ts-ignore node-redis v5 incr
    const count = await redisClient.incr(key)
    if (count === 1) {
      // 首次设置过期时间 600 秒
      // @ts-ignore
      await redisClient.expire(key, 600)
    }
    if (count > 5) {
      // @ts-ignore
      const ttl = await redisClient.ttl(key)
      const remain = ttl > 0 ? ttl : 600
      return respond(429, `上传过于频繁，请 ${Math.ceil(remain/60)} 分钟后再试`)
    }
  } catch (e) {
    console.warn('[upload-avatar] rate-limit check failed', e)
  }
  return null
}

async function readFileField(event: any) {
  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) return respond(400, '缺少上传文件')
  let fileField = form.find((f: any) => f.name === 'file') as (typeof form)[number] | undefined
  if (!fileField) fileField = form.find((f: any) => f.type === 'file') as (typeof form)[number] | undefined
  if (!fileField || !fileField.data || fileField.data.length === 0) return respond(400, '文件字段无效')
  return fileField
}

function validateMimeAndSize(buf: Buffer) {
  const mime = detectImageMime(buf)
  if (!mime) return { error: respond(400, '无法识别的图片格式') }
  if (!ALLOWED_MIME.has(mime)) return { error: respond(400, '不支持的文件类型') }
  const size = buf.length
  if (size > MAX_IMAGE_SIZE) return { error: respond(400, '图片文件过大 (<=4MB)') }
  return { mime }
}

async function ipRateLimit(ip: string) {
  try {
    // @ts-ignore
    const key = `avatar:upload:ip:${ip}`
    // @ts-ignore
    const count = await redisClient.incr(key)
    if (count === 1) {
      // @ts-ignore
      await redisClient.expire(key, 600)
    }
    if (count > 20) {
      // @ts-ignore
      const ttl = await redisClient.ttl(key)
      const remain = ttl > 0 ? ttl : 600
      return respond(429, `IP 上传过于频繁，请 ${Math.ceil(remain/60)} 分钟后再试`)
    }
  } catch (e) {
    console.warn('[upload-avatar] ip rate-limit failed', e)
  }
  return null
}

async function duplicateHashCheck(buf: Buffer) {
  const hash = crypto.createHash('sha256').update(buf).digest('hex')
  // @ts-ignore
  const key = `avatar:upload:hash:${hash}`
  try {
    // @ts-ignore
    const exists = await redisClient.get(key)
    if (exists) return respond(409, '检测到重复内容，请更换图片后再试')
    // @ts-ignore
    await redisClient.set(key, '1', { EX: 600 })
  } catch (e) {
    console.warn('[upload-avatar] duplicate hash check failed', e)
  }
  return null
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label + ' timeout')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
  })
}

async function auditLog(entry: any) {
  const logDir = path.resolve(process.cwd(), 'logs/app')
  try { await fs.mkdir(logDir, { recursive: true }) } catch {}
  const line = JSON.stringify(entry)
  try { await fs.appendFile(path.join(logDir, 'avatar-upload.log'), line + '\n') } catch (e) { console.warn('[upload-avatar] audit log failed', e) }
}

async function processImage(buf: Buffer) {
  try {
    const image = sharp(buf, { failOn: 'none' })
    const meta = await image.metadata()
    if (!meta.format) return { error: respond(400, '图片解码失败') }
    if (meta.width && meta.height && (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION)) {
      await image.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' })
    }
    const resized = image.resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' })
    const outputBuffer = await resized.png({ compressionLevel: 9 }).toBuffer()
    const outMime = detectImageMime(outputBuffer)
    if (outMime !== 'image/png') return { error: respond(500, '输出格式校验失败') }
    return { outputBuffer, outputExt: 'png' }
  } catch (e) {
    console.error('[upload-avatar] image process failed', e)
    return { error: respond(500, '图片处理失败') }
  }
}

async function savePendingAvatar(pendingDir: string, uuid: string, buffer: Buffer, ext: string) {
  const filename = `user_${uuid}_${Date.now()}_${randomSuffix()}.${ext}`
  const filePath = path.join(pendingDir, filename)
  try {
    await fs.writeFile(filePath, buffer)
  } catch (e) {
    console.error('[upload-avatar] save pending failed', e)
    return { error: respond(500, '保存临时文件失败') }
  }
  return { filename, filePath }
}

async function publishAvatar(pendingPath: string, publicDir: string, filename: string) {
  const finalPath = path.join(publicDir, filename)
  try {
    await fs.rename(pendingPath, finalPath)
  } catch (e) {
    console.error('[upload-avatar] publish rename failed', e)
    try { await fs.unlink(pendingPath) } catch {}
    return { error: respond(500, '发布头像失败') }
  }
  return { filePath: finalPath }
}

async function moderate(filePath: string) {
  try {
    const res = await invokeImageModeration(filePath)
    return res
  } catch (e) {
    console.warn('[upload-avatar] moderation invoke failed', e)
    return {
      Code: 'InvokeError',
      Message: '内容安全检测调用失败',
      Error: (e as any)?.message || String(e),
      Stack: (e as any)?.stack || undefined,
    }
  }
}

async function updateUserAvatar(uuid: string, filename: string) {
  try {
    await prisma.user.update({ where: { uuid }, data: { avatar: filename } })
  } catch (e) {
    console.error('[upload-avatar] db update failed', e)
    return respond(500, '更新头像失败')
  }
  return null
}

async function cleanupOld(uploadDir: string, uuid: string, keep: string) {
  try {
    const files = await fs.readdir(uploadDir)
    const prefix = `user_${uuid}_`
    await Promise.all(files.filter(f => f.startsWith(prefix) && f !== keep).map(async f => { try { await fs.unlink(path.join(uploadDir, f)) } catch {} }))
  } catch (e) {
    console.warn('[upload-avatar] cleanup old files failed', e)
  }
}

async function invalidateProfile(uuid: string) {
  try {
    // @ts-ignore
    await redisClient.del('userProfile:' + uuid)
  } catch (e) {
    console.warn('[upload-avatar] redis cache invalidate failed', e)
  }
}

/** Resolve the correct public uploads directory.
 * In dev: Nitro serves from project ./public
 * In production build: Nitro serves from ./.output/public
 */
function resolvePersistentUploadsDir() {
  // Store outside .output so redeploy won't wipe it.
  // Served via nitro publicAssets (nuxt.config.ts) mapping runtime-uploads -> /uploads
  return path.resolve(process.cwd(), 'runtime-uploads/avatars')
}

export default defineEventHandler(async (event) => {
  const start = Date.now()
  const session = await getUserSession(event)
  // @ts-ignore
  const uuid = session?.user?.uuid
  if (!uuid) return respond(401, '未登录或缺少用户uuid')

  const user = await prisma.user.findUnique({ where: { uuid }, select: { uuid: true, avatar: true } })
  if (!user) return respond(404, '用户不存在')

  const canUseCustomAvatar = await checkCanUseCustomAvatar(uuid)
  // 仅需普通头像权限；GIF 权限暂不使用
  if (!canUseCustomAvatar.normal) {
    return respond(403, '你暂无权限使用自定义头像')
  }

  const ip = getRequestIP(event, {
    xForwardedFor: true,
  })
  const ipRL = await ipRateLimit(ip)
  if (ipRL) { await auditLog({ at: Date.now(), uuid, ip, code: ipRL.code, msg: ipRL.msg, success: false, stage: 'ipRateLimit', durationMs: Date.now()-start }) ; return ipRL }
  const rl = await rateLimit(uuid)
  if (rl) { await auditLog({ at: Date.now(), uuid, ip, code: rl.code, msg: rl.msg, success: false, stage: 'userRateLimit', durationMs: Date.now()-start }) ; return rl }

  const fileField = await readFileField(event)
  // If error object
  // @ts-ignore
  if (fileField.code) return fileField

  const { mime, error: mimeError } = validateMimeAndSize(fileField.data)
  if (mimeError) { await auditLog({ at: Date.now(), uuid, ip, code: mimeError.code, msg: mimeError.msg, success: false, stage: 'validateMime', durationMs: Date.now()-start }) ; return mimeError }

  const dup = await duplicateHashCheck(fileField.data)
  if (dup) { await auditLog({ at: Date.now(), uuid, ip, code: dup.code, msg: dup.msg, success: false, stage: 'duplicateHash', durationMs: Date.now()-start }) ; return dup }
  // 仅校验普通权限；GIF 已被关闭（不在允许集合中会在前面被判定为不支持的文件类型）
  if (!canUseCustomAvatar.normal) {
    return respond(403, '你暂无权限上传自定义头像')
  }

  const publicDir = resolvePersistentUploadsDir()
  const pendingDir = path.resolve(process.cwd(), 'uploads-pending/avatars')
  await fs.mkdir(publicDir, { recursive: true })
  await fs.mkdir(pendingDir, { recursive: true })

  let processed
  try {
    processed = await withTimeout(processImage(fileField.data), 5000, 'image-process')
  } catch (e) {
    await auditLog({ at: Date.now(), uuid, ip, code: 500, msg: '图片处理超时', success: false, stage: 'processTimeout', durationMs: Date.now()-start })
    return respond(500, '图片处理超时')
  }
  const { outputBuffer, outputExt, error: processError } = processed
  if (processError) { await auditLog({ at: Date.now(), uuid, ip, code: processError.code, msg: processError.msg, success: false, stage: 'processImage', durationMs: Date.now()-start }) ; return processError }

  const saved = await savePendingAvatar(pendingDir, uuid, outputBuffer!, outputExt!)
  if ('error' in saved) return saved.error
  const { filename, filePath: pendingPath } = saved

  let moderationResult
  try {
    moderationResult = await withTimeout(moderate(pendingPath), 5000, 'moderation')
  } catch (e) {
    try { await fs.unlink(pendingPath) } catch {}
    await auditLog({ at: Date.now(), uuid, ip, mime, size: fileField.data.length, code: 400, msg: '审核超时', success: false, stage: 'moderationTimeout', durationMs: Date.now()-start, error: (e as any)?.message || String(e), stack: (e as any)?.stack || undefined })
    return respond(400, '头像审核服务超时，请稍后重试')
  }
  // 审核异常或风险直接拒绝（严格模式）
  if (!moderationResult || moderationResult.Code === 'InvokeError') {
    try { await fs.unlink(pendingPath) } catch {}
    await auditLog({
      at: Date.now(),
      uuid,
      ip,
      mime,
      size: fileField.data.length,
      code: 400,
      msg: '审核调用失败',
      success: false,
      stage: 'moderationInvoke',
      durationMs: Date.now()-start,
      moderationDetail: moderationResult,
      moderationError: moderationResult?.Error || moderationResult?.Message || null,
      moderationStack: moderationResult?.Stack || null,
    })
    return respond(400, '头像审核服务异常，请稍后重试')
  }
  if (moderationResult?.Data?.RiskLevel && moderationResult.Data.RiskLevel !== 'none') {
    try { await fs.unlink(pendingPath) } catch {}
    await auditLog({ at: Date.now(), uuid, ip, mime, size: fileField.data.length, riskLevel: moderationResult.Data.RiskLevel, code: 400, msg: '风险图片拒绝', success: false, stage: 'moderationRisk', durationMs: Date.now()-start })
    return respond(400, '头像未通过审核，请选择其他图片')
  }

  const published = await publishAvatar(pendingPath, publicDir, filename)
  if ('error' in published) { await auditLog({ at: Date.now(), uuid, ip, mime, size: fileField.data.length, code: published.error.code, msg: published.error.msg, success: false, stage: 'publishAvatar', durationMs: Date.now()-start }) ; return published.error }
  const finalPath = published.filePath

  const updateErr = await updateUserAvatar(uuid, filename)
  if (updateErr) { await auditLog({ at: Date.now(), uuid, ip, mime, size: fileField.data.length, code: updateErr.code, msg: updateErr.msg, success: false, stage: 'updateDB', durationMs: Date.now()-start }) ; return updateErr }

  cleanupOld(publicDir, uuid, filename)
  invalidateProfile(uuid)
  const durationMs = Date.now() - start
  await auditLog({ at: Date.now(), uuid, ip, mime, size: fileField.data.length, riskLevel: moderationResult?.Data?.RiskLevel || 'none', success: true, code: 200, msg: '上传成功', durationMs })
  return respond(200, '上传成功', { avatar: filename, moderation: moderationResult })
})
