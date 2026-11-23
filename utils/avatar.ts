import avatar1 from "~/assets/avatar/avatar_1.png";
import avatar2 from "~/assets/avatar/avatar_2.png";
import avatar3 from "~/assets/avatar/avatar_3.png";
import avatar4 from "~/assets/avatar/avatar_4.png";
import avatar5 from "~/assets/avatar/avatar_5.png";
import avatar6 from "~/assets/avatar/avatar_6.png";
import avatar7 from "~/assets/avatar/avatar_7.png";
import avatar8 from "~/assets/avatar/avatar_8.png";
import avatar9 from "~/assets/avatar/avatar_9.png";
import avatar10 from "~/assets/avatar/avatar_10.png";
import avatar11 from "~/assets/avatar/avatar_11.png";
import avatar12 from "~/assets/avatar/avatar_12.png";
import avatar13 from "~/assets/avatar/avatar_13.png";
import avatar14 from "~/assets/avatar/avatar_14.png";
import avatar15 from "~/assets/avatar/avatar_15.png";
import avatar16 from "~/assets/avatar/avatar_16.png";
import avatar17 from "~/assets/avatar/avatar_17.png";

import avatarAlchemist from "~/assets/avatar/avatar_alchemist.gif";


import avatarBattleUnitCard_Warrior from "~/assets/avatar/avatarBattleUnitCard_Warrior.png";
import avatarBattleUnitCard_WarriorAnim from "~/assets/avatar/avatarBattleUnitCard_WarriorAnim.gif";

import avatarBattleUnitCard_Magical from "~/assets/avatar/avatarBattleUnitCard_Magical.png";
import avatarBattleUnitCard_MagicalAnim from "~/assets/avatar/avatarBattleUnitCard_MagicalAnim.gif";

import avatarBattleUnitCard_Cleric from "~/assets/avatar/avatarBattleUnitCard_Cleric.png";
import avatarBattleUnitCard_ClericAnim from "~/assets/avatar/avatarBattleUnitCard_ClericAnim.gif";

import avatarBattleUnitCard_Ninja from "~/assets/avatar/avatarBattleUnitCard_Ninja.png";

import { avatarCheck } from "~/shared/utils/game/avatarCheck";

// NOTE: Static avatarMap for predefined game avatars & unlockables.
// User-uploaded custom avatars will not be present in this map; they will be
// resolved dynamically by resolveAvatarUrl().

export const avatarMap: Record<keyof typeof avatarCheck, string> = {
  "avatar_1.png": avatar1,
  "avatar_2.png": avatar2,
  "avatar_3.png": avatar3,
  "avatar_4.png": avatar4,
  "avatar_5.png": avatar5,
  "avatar_6.png": avatar6,
  "avatar_7.png": avatar7,
  "avatar_8.png": avatar8,
  "avatar_9.png": avatar9,
  "avatar_10.png": avatar10,
  "avatar_11.png": avatar11,
  "avatar_12.png": avatar12,
  "avatar_13.png": avatar13,
  "avatar_14.png": avatar14,
  "avatar_15.png": avatar15,
  "avatar_16.png": avatar16,
  "avatar_17.png": avatar17,

  "avatarAlchemist.gif": avatarAlchemist,

  "avatarBattleUnitCard_Warrior.png": avatarBattleUnitCard_Warrior,
  "avatarBattleUnitCard_WarriorAnim.gif": avatarBattleUnitCard_WarriorAnim,
  "avatarBattleUnitCard_Magical.png": avatarBattleUnitCard_Magical,
  "avatarBattleUnitCard_MagicalAnim.gif": avatarBattleUnitCard_MagicalAnim,
  "avatarBattleUnitCard_Cleric.png": avatarBattleUnitCard_Cleric,
  "avatarBattleUnitCard_ClericAnim.gif": avatarBattleUnitCard_ClericAnim,

  "avatarBattleUnitCard_Ninja.png": avatarBattleUnitCard_Ninja,
};

/**
 * Resolve an avatar identifier to a usable URL.
 * Priority:
 * 1. If key exists in predefined avatarMap -> return mapped asset path.
 * 2. If value looks like an absolute HTTP(S) URL -> return as-is.
 * 3. If value starts with user_ -> treat as uploaded custom avatar stored under /uploads/avatars.
 * 4. Fallback to default avatar_1.png.
 */
export function resolveAvatarUrl(avatar: string | undefined | null): string {
  if (!avatar) {
    return avatarMap['avatar_1.png'];
  }
  // predefined static
  if ((avatar as keyof typeof avatarMap) in avatarMap) {
    return avatarMap[avatar as keyof typeof avatarMap];
  }
  // absolute url
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }
  // user uploaded pattern -> served via dedicated API endpoint for persistence & auth flexibility
  if (/^user_/.test(avatar)) {
    return `/api/game/user/avatar/${avatar}`;
  }
  return avatarMap['avatar_1.png'];
}
