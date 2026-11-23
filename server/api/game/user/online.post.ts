import { defineEventHandler, getRequestIP } from 'h3'
import { prisma } from '~/server/utils/game/db'
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'

export default defineEventHandler(async (event) => {
  const { fp } = await readBody(event)

  const session = await getUserSession(event)

  // @ts-ignore
  const uuid = session?.user?.uuid
  
  if (!uuid) {
    return {
      code: 401,
      msg: '未登录或缺少用户uuid'
    }
  }

  // 如果用户不存在，报错
  const user = await prisma.user.findUnique({
    where: { uuid }
  })
  if (!user) {
    return {
      code: 404,
      msg: '用户不存在'
    }
  }

  const ip = getRequestIP(event, {
    xForwardedFor: true
  })
  await prisma.user.update({
    where: { uuid },
    data: {
      last_online_date: new Date(),
      last_online_ip: ip,
      last_online_fp: fp,
    }
  })

  const userSessionData: any = {
    uuid: user.uuid,
    name: user.name,
    isVisitor: user.is_visitor,
    firstResetPassword: user.first_reset_password,
    isGm: user.is_gm,
  }
  if (user.is_visitor) {
    userSessionData.visitorPwd = user.pwd
  }
  await setUserSession(event, {
    user: userSessionData,
  }, {
    maxAge: 60 * 60 * 24 * 14, // 30 days
  })

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG
  }
})