import { GameUserCustomStyle } from "~/shared/types/style";
import { prisma } from "./db";
import { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from "~/shared/data/allStyle";
import { MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT, MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT, MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT } from "~/shared/data/constant";

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

      diyChatBubbleStyle: undefined,
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

    diyChatBubbleStyle: style.diyChatBubbleStyles ? JSON.parse(style.diyChatBubbleStyles) : null
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
  await setCurrentBattleStyle(userUuid, style.currentBattleCardStyle)

  await setCurrentProfileStyle(userUuid, style.currentProfileStyle);

  await setCurrentChatBubbleStyle(userUuid, style.currentChatBubbleStyle);

  await setDiyChatBubbleStyle(userUuid, style.diyChatBubbleStyle);

  await setCurrentAvatarBorderStyle(userUuid, style.currentAvatarBorder);

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

  if (styleId && !available.includes(styleId)) {
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

  if (styleId && !available.includes(styleId)) {
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

export async function addChatBubbleStyle(userUuid: string, styleId: keyof typeof allChatBubbleStyle) {
  const style = await getUserCustomStyle(userUuid);
  let styles = style?.availableChatBubbleStyles ?? [];
  if (!styles.includes(styleId)) {
    styles.push(styleId);
    let styleStr = styles.join(",")
    await prisma.userCustomStyle.upsert({
      where: { userUuid },
      update: { availableChatBubbleStyles: styleStr },
      create: {
        userUuid,
        availableChatBubbleStyles: styleStr,
      }
    });
    await invalidateUserCustomStyleCache(userUuid);
  }
}

export async function setCurrentChatBubbleStyle(userUuid: string, styleId: keyof typeof allChatBubbleStyle) {
  if (!Object.keys(allChatBubbleStyle).includes(styleId)) {
    throw new Error("无效的个人卡片样式");
  }

  const style = await getUserCustomStyle(userUuid);
  const available = style?.availableChatBubbleStyles ?? [];

  if (styleId && !available.includes(styleId)) {
    throw new Error("该聊天气泡未解锁");
  }
  await prisma.userCustomStyle.upsert({
    where: { userUuid },
    update: { currentChatBubbleStyle: styleId },
    create: {
      userUuid,
      currentChatBubbleStyle: styleId,
    }
  });
  await invalidateUserCustomStyleCache(userUuid);
}

export async function setDiyChatBubbleStyle(userUuid: string, diyChatBubbleStyle?: GameUserCustomStyle['diyChatBubbleStyle']) {

  const uniqueFlag = await getAllUserUniqueFlags(userUuid);
  const canDiy = uniqueFlag.find(u => u.key == 'diy' && u.type == 'chatBubble');

  if (!canDiy && diyChatBubbleStyle) {
    return;
  }

  if (diyChatBubbleStyle) {
    // 校验 bgColor 长度
    if (diyChatBubbleStyle.bgColor && diyChatBubbleStyle.bgColor.length > MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT) {
      throw new Error(`背景色最多只能设置 ${MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT} 个`);
    }
    // 校验 textColor 长度
    if (diyChatBubbleStyle.textColor && diyChatBubbleStyle.textColor.length > MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT) {
      throw new Error(`文字色最多只能设置 ${MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT} 个`);
    }
    // 校验 textShadow 长度和 blur 范围
    if (diyChatBubbleStyle.textShadow && diyChatBubbleStyle.textShadow.length > MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT) {
      throw new Error(`文字阴影最多只能设置 ${MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT} 个`);
    }
    if (diyChatBubbleStyle.textShadow) {
      for (const shadow of diyChatBubbleStyle.textShadow) {
        if (shadow.blur < 1 || shadow.blur > 10) {
          throw new Error("文字阴影模糊度必须在 1-10 之间");
        }
      }
    }
  }

  await prisma.userCustomStyle.upsert({
    where: { userUuid },
    update: { diyChatBubbleStyles: diyChatBubbleStyle ? JSON.stringify(diyChatBubbleStyle) : null },
    create: {
      userUuid,
      diyChatBubbleStyles: diyChatBubbleStyle ? JSON.stringify(diyChatBubbleStyle) : null,
    }
  });
  await invalidateUserCustomStyleCache(userUuid);
}



export async function addAvatarBorderStyle(userUuid: string, styleId: keyof typeof allAvatarBorder) {
  const style = await getUserCustomStyle(userUuid);
  let styles = style?.availableAvatarBorders ?? [];
  if (!styles.includes(styleId)) {
    styles.push(styleId);
    let styleStr = styles.join(",")
    await prisma.userCustomStyle.upsert({
      where: { userUuid },
      update: { availableAvatarBorders: styleStr },
      create: {
        userUuid,
        availableAvatarBorders: styleStr,
      }
    });
    await invalidateUserCustomStyleCache(userUuid);
  }
}

export async function setCurrentAvatarBorderStyle(userUuid: string, styleId: keyof typeof allAvatarBorder) {
  if (!Object.keys(allAvatarBorder).includes(styleId)) {
    throw new Error("无效的头像框样式");
  }

  const style = await getUserCustomStyle(userUuid);
  const available = style?.availableAvatarBorders ?? [];

  if (styleId && !available.includes(styleId)) {
    throw new Error("该头像框样式未解锁");
  }
  await prisma.userCustomStyle.upsert({
    where: { userUuid },
    update: { currentAvatarBorder: styleId },
    create: {
      userUuid,
      currentAvatarBorder: styleId,
    }
  });
  await invalidateUserCustomStyleCache(userUuid);
}