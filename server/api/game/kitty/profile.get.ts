import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/game/db'
import { toKitty } from '~/server/utils/game/kitty';
import { allTitles } from '~/shared/data/allTitle';
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { Kitty } from '~/shared/types/kitty';
import { UserProfile } from '~/shared/types/profile'

// Redis缓存相关
const REDIS_PROFILE_KEY_PREFIX = "kittyProfile:";
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
    const res: Kitty = JSON.parse(cache);
    return {
      code: REQUEST_SUCCESS_CODE,
      msg: REQUEST_SUCCESS_MSG,
      data: res,
    };
  }


  const kitty = await prisma.kitty.findUnique({
    where: { uuid },
  })

  if (!kitty) {
    return {
      code: 404,
      msg: "猫咪不存在"
    }
  }

  const kittyCat = toKitty(kitty)

  await redisClient.set(cacheKey, JSON.stringify(kittyCat), {
    EX: PROFILE_CACHE_EXPIRE
  });

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
    data: kittyCat
  }
})