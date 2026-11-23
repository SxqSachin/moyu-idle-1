import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { prisma } from '~/server/utils/game/db'

// 简单：当前版本号从 package.json 或 env 读取，这里直接读取 process.env.APP_VERSION 或 fallback
const CURRENT_VERSION = '0.0.8.26'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user?.uuid) {
    return { code: 401, msg: 'NOT_LOGGED_IN' }
  }
  const uuid = session.user.uuid
  // 查询字段 (已更新 prisma client)
  const user = await prisma.user.findUnique({
    where: { uuid },
    select: { last_seen_app_version: true }
  })
  const lastSeen = user?.last_seen_app_version || ''
  const needsShow = lastSeen !== CURRENT_VERSION

  // 若需要展示，立即写入（避免多次弹出）；也可以放到前端确认后再写
  if (needsShow) {
    try {
      await prisma.user.update({
        where: { uuid },
        data: { last_seen_app_version: CURRENT_VERSION }
      })
    } catch {}
  }

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
    data: {
      currentVersion: CURRENT_VERSION,
      lastSeen,
      showUpdateLog: needsShow
    }
  }
})
