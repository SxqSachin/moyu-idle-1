import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/game/db'
import { getUserCustomStyle } from '~/server/utils/game/style';
import { allTitles } from '~/shared/data/allTitle';
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { AccountPlayType } from '~/shared/types/account';
import { UserProfile } from '~/shared/types/profile'
import { GameUserCustomStyle } from '~/shared/types/style';
import { safeJsonParse } from '~/shared/utils';

// Redis缓存相关
const REDIS_PROFILE_KEY_PREFIX = "userProfile:";
const PROFILE_CACHE_EXPIRE = 7200; // 秒

function getProfileCacheKey(uuid: string) {
  return `${REDIS_PROFILE_KEY_PREFIX}${uuid}`;
}

export default defineEventHandler(async (event) => {
  const userSession = await getUserSession(event)
  if (!userSession.user) {
    return {
      code: 400,
      msg: "缺少用户uuid"
    }
  }

  let res: Record<string, UserProfile> = {}
  let needFetchUuidList: string[] = []

  const body = await readBody(event);
  const uuidList = body.uuidList as string[]

  if (!uuidList?.length) {
    return {
      code: REQUEST_SUCCESS_CODE,
      msg: REQUEST_SUCCESS_MSG,
      data: res
    }
  }

  // 批量读取缓存，使用pipeline
  const pipeline = redisClient.multi();
  const cacheKeys = uuidList.map(uuid => getProfileCacheKey(uuid));
  
  // 批量添加GET命令到pipeline
  cacheKeys.forEach(key => {
    pipeline.get(key);
  });
  
  // 执行pipeline批量读取
  const cacheResults = await pipeline.exec();

  const stylePromiseList: Promise<GameUserCustomStyle>[] = []
  
  // 处理缓存结果
  for (let i = 0; i < uuidList.length; i++) {
    const uuid = uuidList[i];
    const cacheResult = cacheResults?.[i];
    
    if (cacheResult) { // pipeline返回[error, result]格式
      // @ts-ignore
      const userRes: UserProfile = safeJsonParse(cacheResult);
      res[uuid] = userRes;
    } else {
      needFetchUuidList.push(uuid);
    }

    stylePromiseList.push(getUserCustomStyle(uuid))
  }

  let styleList = await Promise.all(stylePromiseList)
  let styleMap: Record<string, GameUserCustomStyle> = {}
  styleList.forEach((style, i) => {
    styleMap[uuidList[i]] = style
  })

  // 如果有需要从数据库获取的用户
  if (needFetchUuidList.length) {
    const users = await prisma.user.findMany({
      where: {
        uuid: {
          in: needFetchUuidList
        }
      }
    })

    // 批量写入缓存，使用pipeline
    const writePipeline = redisClient.multi();
    
    for (const user of users) {
      let title = user.current_title as keyof typeof allTitles

      let thisUserProfile = {
        uuid: user.uuid,
        name: user.name,
        avatar: user.avatar,
        title: title ?? '',
        style: styleMap[user.uuid],
        ironcat: user.accountPlayType == AccountPlayType.IRON
      }

      res[user.uuid] = thisUserProfile;
      
      // 添加SET命令到pipeline
      writePipeline.set(
        getProfileCacheKey(user.uuid), 
        JSON.stringify(thisUserProfile), {
          expiration: {
            type: 'EX',
            value: PROFILE_CACHE_EXPIRE
          }
        } 
      );
    }
    
    // 批量执行写入
    await writePipeline.exec();
  }

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
    data: res
  }
})