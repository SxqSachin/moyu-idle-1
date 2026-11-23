import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";

// 请求并监听用户个性化数据
export function emitGetUserPersonalization() {
  emitEventToServer("userPersonalization:get");
}

export const onGetUserPersonalizationSuccess = registerSocketEventListener<{ favoriteItems: string[]; categoryOrder: string[] }>("userPersonalization:get:success");

// 设置 favorites
export function emitSetFavorites(favorites: string[]) {
  emitEventToServer("userPersonalization:setFavorites", { favorites });
}
export const onSetFavoritesSuccess = registerSocketEventListener<{ favoriteItems: string[]; categoryOrder: string[] }>("userPersonalization:setFavorites:success");

// 设置 category order
export function emitSetCategoryOrder(order: string[]) {
  emitEventToServer("userPersonalization:setCategoryOrder", { order });
}
export const onSetCategoryOrderSuccess = registerSocketEventListener<{ favoriteItems: string[]; categoryOrder: string[] }>("userPersonalization:setCategoryOrder:success");

// 错误监听
export const onUserPersonalizationError = registerSocketEventListener<{ message: string }>("userPersonalization:error");
