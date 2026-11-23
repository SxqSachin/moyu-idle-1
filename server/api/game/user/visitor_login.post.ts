import { PrismaClient } from '@/generated/prisma'
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { CAPTCHA_CHECK_FAILED_CODE, CAPTCHA_CHECK_FAILED_MSG, CREATE_USER_FAILED_CODE, CREATE_USER_FAILED_MSG, EMAIL_PASSWORD_ERROR_CODE, EMAIL_PASSWORD_ERROR_MSG, NAME_EXIST_CODE, NAME_EXIST_MSG } from '~/shared/requestResult/login'
import { z } from 'zod'
import { remoteCheckRecaptcha } from '~/server/utils/recaptcha'
import { v4 as uuidv4 } from 'uuid';
import { randomString, sanitizeInput } from '~/shared/utils'
import { prisma } from '~/server/utils/game/db'
import { increaseItemCount } from '~/server/utils/game/characterInventory'
import { NEW_ACCOUNT_INITIAL_INVENTORY } from '~/shared/data/constant'

const bodySchema = z.object({
  name: z.string().min(2).max(20),
  token: z.string(),
  fp: z.string()
})

let ipBlackList: string[] = [
  '61.156.194.104'
];

export default defineEventHandler(async (event) => {
  return;
  let { name, token, fp } = await readValidatedBody(event, bodySchema.parse);

  name = sanitizeInput(name); 

  if (await checkSensitiveWords(name)) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "昵称包含敏感词",
    };
  }


  const ip = getRequestIP(event, {
    xForwardedFor: true
  })

  if (ip && ipBlackList.includes(ip)) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  // 防爆破：IP限流
  const ipKey = `visitor_login:ip:${ip}`;
  const ipCount = await redisClient.incr(ipKey);
  if (ipCount === 1) {
    await redisClient.expire(ipKey, 600); // 10分钟
  }
  if (ipCount > 10) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "登录过于频繁，请稍后再试",
    };
  }

  if (!fp) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  // 在数据库中检查ip和指纹是否存在多个
  const existingUsers = await prisma.user.findMany({
    where: {
      last_online_ip: ip,
      last_online_fp: fp,
    },
  });

  if (existingUsers.length > 1) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  if (process.env.NODE_ENV != 'development') {
    if (!(await remoteCheckRecaptcha(token))) {
      return {
        code: CAPTCHA_CHECK_FAILED_CODE,
        msg: CAPTCHA_CHECK_FAILED_MSG,
      };
    }
  }

  const existedUser = await prisma.user.findFirst({
    where: {
      name,
    },
  });

  if (existedUser) {
    return {
      code: NAME_EXIST_CODE,
      msg: NAME_EXIST_MSG,
    };
  }

  const pwd = randomString(16);
  const uuid = uuidv4()
  const user = await prisma.user.create({
    data: {
      uuid,
      email: name + '@' + uuid + '.com',
      pwd,
      name: name,
      create_date: new Date(),
      is_visitor: true,
    },
  });

  await setUserSession(event, {
    user: {
      uuid: user.uuid,
      name: user.name,
      isVisitor: user.is_visitor,
      visitorPwd: pwd
    },
  });

  await prisma.user.update({
    where: {
      uuid: user.uuid,
    },
    data: {
      last_login_date: new Date(),
    },
  });

  await increaseItemCount(user.uuid, NEW_ACCOUNT_INITIAL_INVENTORY)

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
  };
});