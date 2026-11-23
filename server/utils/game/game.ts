import { BattleInfo } from "~/shared/types/battle";
import { CharacterInitData } from "~/shared/types/game";
import { getKittyExpeditionTeamsByUser } from "./kittyExpedition";
import { getUserPersonalization } from "~/server/utils/userPersonalization";
import { getUserSponsorPointInfo } from "./sponsorPoint";

export async function getCharacterInitData(userUuid: string): Promise<CharacterInitData> {
  let [
    user,

    inventory,
    tavern,
    quest,

    kittyInfo,

    currentBattleRoom,

    allGameActionDurationDetail,
    allGameActionResourceRequirementDetail,

    workEquipment,
    battleEquipment,

    skills,
    building,
    kittyFurniture,

    guild,

    userStyle,

    villageBuildingInfo,

    uniqueFlag,

    sponsorPoint,

    status,
    kittyExpedition,

    skillNodes,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: {
        uuid: userUuid,
      },
    }),

    getInventoryInfoPreferCache(userUuid),
    getUserTalentCats(userUuid),
    getQuestList(userUuid),

    getAllKittyByOwner(userUuid),

    getBattleRoomByUserId(userUuid),

    getAllActionDuration(userUuid),
    getAllActionResourceRequirement(userUuid),

    getUserEquipment(userUuid, "work"),
    getUserEquipment(userUuid, "battle"),

    getAllCharacterSkills(userUuid),

    getBuildingInfo(userUuid),
    getUserAllFurniture(userUuid),

    getGuildByUserUuid(userUuid),

    getUserCustomStyle(userUuid),

    getNormalStateBaseVillageBuildings(),
    getAllUserUniqueFlags(userUuid),

    getUserSponsorPointInfo(userUuid),

    getCharacterStatusInfo(userUuid),
    getKittyExpeditionTeamsByUser(userUuid),

    listAllLearnedSkillTreeNodes(userUuid),
  ]);

  let battleInfo: BattleInfo | undefined = undefined;
  if (currentBattleRoom?.battleUuid) {
    battleInfo = await getBattleInfoFromRedis(currentBattleRoom?.battleUuid);
  }

  // 创建14天内 
  const isBeginner = user?.create_date && (new Date().getTime() - user.create_date.getTime()) < 14 * 24 * 60 * 60 * 1000;

  let res: CharacterInitData = {
    inventory,
    tavern,
    quest,

    kittyInfo,

    currentBattleRoom: currentBattleRoom ?? null,
    battleInfo,

    allGameActionDurationDetail,
    allGameActionResourceRequirementDetail,

    workEquipment,
    battleEquipment,

    skills,
    building,
    kittyFurniture,

    guild,

    userStyle,

    villageBuildingInfo,

    uniqueFlag,

    sponsorPoint,

    status,

    kittyExpedition,

    lastOnlineDate: user?.last_online_date || new Date(),

    skillNodes,
    userPersonalization: await getUserPersonalization(userUuid),
    
    isBeginner
  };

  return res;
}