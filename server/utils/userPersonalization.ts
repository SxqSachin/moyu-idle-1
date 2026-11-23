import { prisma } from "~/server/utils/game/db";

export type UserPersonalizationPayload = {
  favoriteItems?: string[];
  categoryOrder?: string[];
}

const MAX_FAVORITE_ITEMS = 500;
const MAX_CATEGORY_ORDER = 200;

function sanitizeStringArray(arr: unknown, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= maxLen) break;
  }
  return out;
}

export async function getUserPersonalization(userUuid: string) {
  const rec = await prisma.userPersonalization.findUnique({ where: { user_uuid: userUuid } });

  if (!rec) {
    return { favoriteItems: [], categoryOrder: [] };
  }

  let favoriteItems: string[] = [];
  let categoryOrder: string[] = [];

  try {
    favoriteItems = rec.favorite_items ? JSON.parse(rec.favorite_items) : [];
    if (!Array.isArray(favoriteItems)) favoriteItems = [];
  } catch (e) {
    favoriteItems = [];
  }

  try {
    categoryOrder = rec.category_order ? JSON.parse(rec.category_order) : [];
    if (!Array.isArray(categoryOrder)) categoryOrder = [];
  } catch (e) {
    categoryOrder = [];
  }

  favoriteItems = sanitizeStringArray(favoriteItems, MAX_FAVORITE_ITEMS);
  categoryOrder = sanitizeStringArray(categoryOrder, MAX_CATEGORY_ORDER);

  return { favoriteItems, categoryOrder };
}

export async function upsertUserPersonalization(userUuid: string, payload: UserPersonalizationPayload) {
  const favoriteItems = sanitizeStringArray(payload.favoriteItems, MAX_FAVORITE_ITEMS);
  const categoryOrder = sanitizeStringArray(payload.categoryOrder, MAX_CATEGORY_ORDER);

  const exists = await prisma.userPersonalization.findUnique({ where: { user_uuid: userUuid } });

  if (!exists) {
    return await prisma.userPersonalization.create({
      data: {
        user_uuid: userUuid,
        favorite_items: JSON.stringify(favoriteItems),
        category_order: JSON.stringify(categoryOrder),
      }
    });
  }

  return await prisma.userPersonalization.update({
    where: { user_uuid: userUuid },
    data: {
      favorite_items: JSON.stringify(favoriteItems),
      category_order: JSON.stringify(categoryOrder),
      updated_at: new Date(),
    }
  });
}

export async function setFavorites(userUuid: string, favorites: unknown) {
  return upsertUserPersonalization(userUuid, { favoriteItems: Array.isArray(favorites) ? favorites as string[] : [] });
}

export async function setCategoryOrder(userUuid: string, order: unknown) {
  return upsertUserPersonalization(userUuid, { categoryOrder: Array.isArray(order) ? order as string[] : [] });
}
