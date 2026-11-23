import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  GameCharacterBattleSkillInfo,
  ChefFlavorKey,
  ChefTargetKey,
  ChefSkillCombinationInfo,
  AllBattleSkillId,
} from "~/shared/types/skill";
import { safeJsonParse } from "~/shared/utils";

const CHEF_SKILL_ID: AllBattleSkillId = "chefSkill";

// 校验：整数 & 非负
function isNonNegativeInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 1e9;
}

const VALID_FLAVORS: ChefFlavorKey[] = [
  "sour",
  "sweet",
  "bitter",
  "spicy",
  "salty",
];
const VALID_TARGETS: ChefTargetKey[] = ["ally", "enemy"];

interface ValidatedCombination {
  flavors: { key: ChefFlavorKey; count: number }[];
  targets: { key: ChefTargetKey; count: number }[];
  totalFlavor: number;
  totalTarget: number;
}

function deriveMaxCounts(chefLevel: number, skillLevel: number) {
  const maxFlavor = Math.max(
    1,
    Math.floor(chefLevel / 5) + Math.floor(skillLevel / 4)
  );
  const maxTarget = Math.floor(chefLevel / 12); // 允许 0
  return { maxFlavor, maxTarget };
}

function validateCombination(
  chefLevel: number,
  skillLevel: number,
  combo: ChefSkillCombinationInfo
): ValidatedCombination {
  if (
    !combo ||
    !Array.isArray(combo.flavors) ||
    !Array.isArray(combo.targets)
  ) {
    throw new Error("无效数据：缺少 flavors 或 targets");
  }
  const { maxFlavor, maxTarget } = deriveMaxCounts(chefLevel, skillLevel);
  const flavorMap = new Map<ChefFlavorKey, number>();
  const targetMap = new Map<ChefTargetKey, number>();

  for (const f of combo.flavors) {
    if (!f || typeof f !== "object") throw new Error("无效口味条目");
    if (!VALID_FLAVORS.includes(f.key as ChefFlavorKey))
      throw new Error("无效口味键: " + f.key);
    if (!isNonNegativeInt(f.count)) throw new Error("无效口味数量: " + f.count);
    flavorMap.set(f.key as ChefFlavorKey, f.count);
  }
  for (const t of combo.targets) {
    if (!t || typeof t !== "object") throw new Error("无效目标条目");
    if (!VALID_TARGETS.includes(t.key as ChefTargetKey))
      throw new Error("无效目标键: " + t.key);
    if (!isNonNegativeInt(t.count)) throw new Error("无效目标数量: " + t.count);
    targetMap.set(t.key as ChefTargetKey, t.count);
  }
  // 缺失的 flavor/target 默认 0，确保结构完整
  VALID_FLAVORS.forEach((k) => {
    if (!flavorMap.has(k)) flavorMap.set(k, 0);
  });
  VALID_TARGETS.forEach((k) => {
    if (!targetMap.has(k)) targetMap.set(k, 0);
  });

  const totalFlavor = [...flavorMap.values()].reduce((a, b) => a + b, 0);
  const totalTarget = [...targetMap.values()].reduce((a, b) => a + b, 0);

  if (totalFlavor > maxFlavor)
    throw new Error(`口味总数超出上限: ${totalFlavor} > ${maxFlavor}`);
  if (totalTarget > maxTarget)
    throw new Error(`目标总数超出上限: ${totalTarget} > ${maxTarget}`);
  if (totalFlavor <= 0) throw new Error("口味总数必须 > 0");
  if (maxTarget > 0 && totalTarget <= 0)
    throw new Error("存在目标上限时，目标总数必须 > 0");

  return {
    flavors: VALID_FLAVORS.map((k) => ({ key: k, count: flavorMap.get(k)! })),
    targets: VALID_TARGETS.map((k) => ({ key: k, count: targetMap.get(k)! })),
    totalFlavor,
    totalTarget,
  };
}

/** 更新厨师技能组合 */
export async function handleUpdateChefSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ info: ChefSkillCombinationInfo }>
) {
  const userUuid = data.user.uuid;
  const payload = data.data.info;

  await withUniqueLock("chefSkill:update:" + userUuid, async () => {
    try {
      await prisma.$transaction(async (tx) => {
        // 读取当前等级（若无则默认 1）
        const existing = await tx.characterSkillInfo.findUnique({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: CHEF_SKILL_ID,
            },
          },
        });

        if (!existing) {
          throw new Error("尚未习得厨师技能");
        }

        const skillLevel = existing?.level || 1;
        let currentExtra: GameCharacterBattleSkillInfo["extra"] =
          safeJsonParse(existing?.extra, {}) || {};

        const characterStatus = await getCharacterStatusInfo(userUuid);
        const chefLevel = characterStatus.cooking.final ?? 1;

        // 校验组合
        const validated = validateCombination(chefLevel, skillLevel, payload);

        if (!currentExtra?.chefSkill) {
          currentExtra.chefSkill = {};
        }

        currentExtra.chefSkill = {
          flavors: validated.flavors,
          targets: validated.targets,
        };

        await tx.characterSkillInfo.update({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: CHEF_SKILL_ID,
            },
          },
          data: {
            extra: JSON.stringify(currentExtra),
          },
        });

        emitEventToUser(userUuid, "chefSkill:update:success");
      });
    } catch (e: any) {
      emitEventToUser(userUuid, "chefSkill:update:failed", {
        message: e.message || "更新失败",
      });
    }
  });
}

/** 获取厨师技能组合 */
export async function handleGetChefSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const res = await prisma.characterSkillInfo.findUnique({
      select: { extra: true, level: true },
      where: {
        character_user_skill_unique: {
          character_uuid: userUuid,
          user_uuid: userUuid,
          skill_id: CHEF_SKILL_ID,
        },
      },
    });
    const extra: GameCharacterBattleSkillInfo["extra"] =
      safeJsonParse(res?.extra, {}) || {};

    if (!extra.chefSkill) {
      emitEventToUser(userUuid, "chefSkill:get:success", {});
      return;
    }

    const resp: ChefSkillCombinationInfo = {
      flavors:
        extra.chefSkill.flavors ||
        VALID_FLAVORS.map((k) => ({ key: k, count: 0 })),
      targets:
        extra.chefSkill.targets ||
        VALID_TARGETS.map((k) => ({ key: k, count: 0 })),
    };
    emitEventToUser(userUuid, "chefSkill:get:success", { info: resp });
  } catch (e: any) {
    emitEventToUser(userUuid, "chefSkill:get:failed", {
      message: e.message || "获取失败",
    });
  }
}
