import { type GameUserCustomStyle } from "~/shared/types/style";
import { allBattleStyle, allProfileStyle } from "~/shared/data/allStyle";
import { prisma } from "../prisma";
import {redisClient} from "../redis"

// Redis 缓存 key 生成
function getStyleCacheKey(userUuid: string) {
  return `userCustomStyle:${userUuid}`;
}

/**
 * 查询玩家自定义风格（带缓存）
 */
export async function getUserCustomStyle(userUuid: string): Promise<GameUserCustomStyle> {
  const cacheKey = getStyleCacheKey(userUuid);
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // ignore parse error
    }
  }
  const style = await prisma.userCustomStyle.findUnique({
    where: { userUuid }
  });
  if (!style) {
    return {
      availableBattleCardStyles: [],
      currentBattleCardStyle: "",
      availableChatContentStyles: [],
      currentChatContentStyle: "",
      availableChatNameStyles: [],
      currentChatNameStyle: "",
      availableProfileStyles: [],
      currentProfileStyle: "",

      availableChatBubbleStyles: [],
      currentChatBubbleStyle: "",

      availableAvatarBorders: [],
      currentAvatarBorder: "",

      diyChatBubbleStyle: {
        bgColor: [],
        textColor: [],
        textShadow: [],
      }
    } as GameUserCustomStyle;
  }
  const result: GameUserCustomStyle = {
    // @ts-expect-error
    availableBattleCardStyles: style.availableBattleCardStyles?.split(",").filter(Boolean) ?? [],
    // @ts-expect-error
    currentBattleCardStyle: style.currentBattleCardStyle ?? "",
    availableChatContentStyles: style.availableChatContentStyles?.split(",").filter(Boolean) ?? [],
    currentChatContentStyle: style.currentChatContentStyle ?? "",
    availableChatNameStyles: style.availableChatNameStyles?.split(",").filter(Boolean) ?? [],
    currentChatNameStyle: style.currentChatNameStyle ?? "",

    // @ts-expect-error
    availableProfileStyles: style.availableProfileStyles?.split(",").filter(Boolean) ?? [],
    // @ts-expect-error
    currentProfileStyle: style.currentProfileStyle ?? "",

    // @ts-expect-error
    availableChatBubbleStyles: style.availableChatBubbleStyles?.split(",").filter(Boolean) ?? [],
    // @ts-expect-error
    currentChatBubbleStyle: style.currentChatBubbleStyle ?? "",

    // @ts-expect-error
    availableAvatarBorders: style.availableAvatarBorders?.split(",").filter(Boolean) ?? [],
    // @ts-expect-error
    currentAvatarBorder: style.currentAvatarBorder ?? "",

    // @ts-expect-error
    diyChatBubbleStyle: style.diyChatBubbleStyle ? JSON.parse(style.diyChatBubbleStyle) : { bgColor: [], textColor: [] }
  };
  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: "EX",
      value: 3600
    }
  });
  return result;
}

/**
 * 完整设置玩家自定义风格（全部字段覆盖，并使缓存失效）
 */
export async function setUserCustomStyle(userUuid: string, style: GameUserCustomStyle) {
  if (style.currentBattleCardStyle) {
    await setCurrentBattleStyle(userUuid, style.currentBattleCardStyle)
  }

  if (style.currentProfileStyle) {
    await setCurrentProfileStyle(userUuid, style.currentProfileStyle);
  }

  await invalidateUserCustomStyleCache(userUuid);
}

/**
 * 使玩家自定义风格缓存失效
 */
async function invalidateUserCustomStyleCache(userUuid: string) {
  const cacheKey = getStyleCacheKey(userUuid);
  await redisClient.del(cacheKey);
}

/**
 * 添加战斗风格（如无数据则新建）
 */
export async function addBattleStyle(userUuid: string, styleId: keyof typeof allBattleStyle) {
  const style = await getUserCustomStyle(userUuid);
  let styles = style?.availableBattleCardStyles ?? [];
  if (!styles.includes(styleId)) {
    styles.push(styleId);
    let styleStr = styles.join(",")
    await prisma.userCustomStyle.upsert({
      where: { userUuid },
      update: { availableBattleCardStyles: styleStr },
      create: {
        userUuid,
        availableBattleCardStyles: styleStr,
      }
    });
    await invalidateUserCustomStyleCache(userUuid);
  }
}

/**
 * 选择当前战斗风格
 */
export async function setCurrentBattleStyle(userUuid: string, styleId: keyof typeof allBattleStyle) {
  if (!Object.keys(allBattleStyle).includes(styleId)) {
    throw new Error("无效的战斗面板样式");
  }

  const style = await getUserCustomStyle(userUuid);
  const available = style?.availableBattleCardStyles ?? [];

  if (!style || !available.includes(styleId)) {
    throw new Error("该战斗风格未解锁");
  }
  await prisma.userCustomStyle.upsert({
    where: { userUuid },
    update: { currentBattleCardStyle: styleId },
    create: {
      userUuid,
      currentBattleCardStyle: styleId,
    }
  });
  await invalidateUserCustomStyleCache(userUuid);
}

/**
 * 添加战斗风格（如无数据则新建）
 */
export async function addProfileStyle(userUuid: string, styleId: keyof typeof allProfileStyle) {
  const style = await getUserCustomStyle(userUuid);
  let styles = style?.availableProfileStyles ?? [];
  if (!styles.includes(styleId)) {
    styles.push(styleId);
    let styleStr = styles.join(",")
    await prisma.userCustomStyle.upsert({
      where: { userUuid },
      update: { availableProfileStyles: styleStr },
      create: {
        userUuid,
        availableProfileStyles: styleStr,
      }
    });
    await invalidateUserCustomStyleCache(userUuid);
  }
}

/**
 * 选择当前战斗风格
 */
export async function setCurrentProfileStyle(userUuid: string, styleId: keyof typeof allProfileStyle) {
  if (!Object.keys(allProfileStyle).includes(styleId)) {
    throw new Error("无效的个人卡片样式");
  }

  const style = await getUserCustomStyle(userUuid);
  const available = style?.availableProfileStyles ?? [];

  if (!style || !available.includes(styleId)) {
    throw new Error("该个人卡片样式未解锁");
  }
  await prisma.userCustomStyle.upsert({
    where: { userUuid },
    update: { currentProfileStyle: styleId },
    create: {
      userUuid,
      currentProfileStyle: styleId,
    }
  });
  await invalidateUserCustomStyleCache(userUuid);
}