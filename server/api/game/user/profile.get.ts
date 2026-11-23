import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/game/db'
import { getUserCustomStyle } from '~/server/utils/game/style';
import { allTitles } from '~/shared/data/allTitle';
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { AccountPlayType } from '~/shared/types/account';
import { UserProfile } from '~/shared/types/profile'

// Redis缓存相关
const REDIS_PROFILE_KEY_PREFIX = "userProfile:";
const PROFILE_CACHE_EXPIRE = 7200; // 秒

function getProfileCacheKey(uuid: string) {
  return `${REDIS_PROFILE_KEY_PREFIX}${uuid}`;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const uuid = query.uuid as string

  if (!uuid) {
    return {
      code: 400,
      msg: "缺少用户uuid"
    }
  }

  const userSession = await getUserSession(event)

  if (!userSession.user) {
    return {
      code: 400,
      msg: "缺少用户uuid"
    }
  }

  const cacheKey = getProfileCacheKey(uuid);
  // @ts-ignore
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    const res: UserProfile = JSON.parse(cache);
    return {
      code: REQUEST_SUCCESS_CODE,
      msg: REQUEST_SUCCESS_MSG,
      data: res,
    };
  }


  const user = await prisma.user.findUnique({
    where: { uuid },
    select: {
      uuid: true,
      name: true,
      avatar: true,
      email: true,
      current_title: true,
      accountPlayType: true,
      accountType: true,
    //   is_visitor: true,
      // 你可以根据需要添加更多字段
    }
  })

  if (!user) {
    return {
      code: 404,
      msg: "用户不存在"
    }
  }

  let userStyle = await getUserCustomStyle(uuid)

  let title = user.current_title as keyof typeof allTitles
  const res: UserProfile = {
    uuid: user.uuid,
    name: user.name,
    avatar: user.avatar,
    title: title ?? '',
    style: userStyle,
    ironcat: user.accountPlayType == AccountPlayType.IRON
  }

  await redisClient.set(cacheKey, JSON.stringify(res), {
    EX: PROFILE_CACHE_EXPIRE
  });

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
    data: res
  }
})