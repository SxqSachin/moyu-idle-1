import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import { type BaseVillageBuildingInfo, type BattlePyreAltarExtraData, VillageBuildingStatus } from "~/shared/types/village/building";
import { safeJsonParse } from "~/shared/utils";
import { redisClient } from "../../redis";
import { prisma } from "../../prisma";
import BattlePyreAltar from "~/components/Game/Village/Building/Effect/BattlePyreAltar.vue";

const VILLAGE_NORMAL_BUILDINGS_CACHE_KEY = "VILLAGE_NORMAL_BUILDINGS_LIST";
const VILLAGE_NORMAL_BUILDINGS_CACHE_TTL = 30 * 60; // 2小时（秒）
export async function getNormalStateBaseVillageBuildings(): Promise<BaseVillageBuildingInfo[]> {
    try {
        // 尝试从缓存获取
        const cached = await redisClient.get(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY);
        if (cached) {
            return safeJsonParse(cached, []);
        }
    } catch (error) {
    }

    const list = await prisma.villageBuilding.findMany({
        where: { 
            status: {
                in: [VillageBuildingStatus.NORMAL, VillageBuildingStatus.UPGRADING, VillageBuildingStatus.PREPARE_UPGRADE]
            }
        } 
    });
    let res = list.map(b => ({
        level: b.level,
        type: b.type as keyof typeof allVillageBuilding,
        extra: b.extra
    }));

    await redisClient.set(
        VILLAGE_NORMAL_BUILDINGS_CACHE_KEY,
        JSON.stringify(res), {
        expiration: {
            type: 'EX',
            value: VILLAGE_NORMAL_BUILDINGS_CACHE_TTL,
        }
    }
    );

    return res;
}


export type VillageBuildingEffectOnBattle = {
    extraExpPercent: number,
    extraDropPercent: number
}
export async function getGameVillageBuildingEffectOnBattle(): Promise<VillageBuildingEffectOnBattle> {
    // 简单进程内缓存（1分钟TTL）
    const now = Date.now();
    if (_villageEffectCache && _villageEffectCacheExpireAt > now) {
        return _villageEffectCache;
    }

    const list = await getNormalStateBaseVillageBuildings();

    let totalExpPercent = 0;
    let totalDropPercent = 0

    const battlePyreAltar = list.find(b => b.type === "battlePyreAltar");

    if (battlePyreAltar && battlePyreAltar?.level > 0) {
        const reward = allVillageBuilding.battlePyreAltar.effect(battlePyreAltar.level);

        totalExpPercent += reward.baseExpPercent;

        if (battlePyreAltar.extra) {
            const t = safeJsonParse<BattlePyreAltarExtraData>(battlePyreAltar.extra)

            if (t.consecrateUntil > Date.now()) {
                totalExpPercent += reward.donateExpPercent
                totalDropPercent += reward.donateExtraDropPercent;
            }
        }
    }

    const result: VillageBuildingEffectOnBattle = {
        extraExpPercent: totalExpPercent,
        extraDropPercent: totalDropPercent
    };
    setVillageEffectCache(result);
    return result;
}

// ===== In-memory cache for village battle effect =====
let _villageEffectCache: VillageBuildingEffectOnBattle | null = null;
let _villageEffectCacheExpireAt = 0;
const FIVE_MINUTES = 1 * 60 * 1000;

// 封装设置缓存的逻辑，便于后续扩展
function setVillageEffectCache(value: VillageBuildingEffectOnBattle) {
    _villageEffectCache = value;
    _villageEffectCacheExpireAt = Date.now() + FIVE_MINUTES;
}

// 对外暴露一个可选的清理方法，以便主动失效（例如有建筑升级/供奉变更时调用）
export function invalidateVillageEffectCache() {
    _villageEffectCache = null;
    _villageEffectCacheExpireAt = 0;
}