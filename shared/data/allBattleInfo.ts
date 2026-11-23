import { generateEnemyById } from "~/server/utils/game/enemy";
import type { BattleArea, BattleAreaExpeditionInfo } from "../types/battle";
import type { AllGameEnemyID, ItemDrop } from "../types/emeny";
import { clone } from "../utils";
import { allGameEnemies } from "./allGameEnemy";
import type { BaseBattleUnit } from "../types/unit";

/**
 * 所有战斗副本（区域）配置
 */

const generateAllItemDropInArea = (areaId: keyof typeof allBattleAreas): ItemDrop[] => {
  let res: ItemDrop[] = []

  let area = allBattleAreas[areaId] as BattleArea;

  let enemyPool: AllGameEnemyID[] = []

  for (const enemy of area.enemyPool) {
    enemyPool.push(enemy.id as AllGameEnemyID)
  }
  for (const special of area.specialBattles ?? []) {
    for (const enemy of special.enemies) {
      enemyPool.push(enemy.id as AllGameEnemyID)
    }
  }

  for (const enemyId of enemyPool) {
    const enemy = allGameEnemies[enemyId];
    if (enemy && enemy.drops) {
      let thisEnemyDrop = clone(enemy.drops ?? []) as ItemDrop[]
      res.push(...thisEnemyDrop)
    }
  }

  return res;
}

export const allBattleAreas = {
  plain_001: {
    id: "plain_001",
    name: "悠闲平原",
    description:
      "阳光明媚、草地广阔的平原，适合新手猫咪冒险者探索。这里有许多温顺的小动物和丰富的浆果、蘑菇资源。",
    enemyPool: [
      { id: "berry_bird_001", weight: 30 },
      { id: "mushroom_bug_001", weight: 25 },
      { id: "plain_mouse_001", weight: 20 },
      { id: "lazy_rabbit_001", weight: 20 },
      { id: "snail_001", weight: 15 },
      { id: "catnip_kitten_001", weight: 10 },
    ],
    // minLevel: 1,
    // maxLevel: 4,
    minEnemies: 1,
    maxEnemies: 3,
    specialBattles: [
      {
        every: 6,
        maxBossNum: 3,
        enemies: [{ id: "plain_boss_001", weight: 100 }],
        description: "每6次战斗必定遇到平原守护猫",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { plain_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      plain_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },
  forest_001: {
    id: "forest_001",
    name: "幽暗森林",
    description: "一片常年被迷雾笼罩的森林，适合新手冒险者历练。",
    enemyPool: [
      { id: "wolf_001", weight: 10 },
      { id: "mushroom_001", weight: 45 },
      { id: "bat_001", weight: 15 },
      { id: "slime_002", weight: 20 },
      { id: "slime_001", weight: 40 },
      { id: "forest_healer_001", weight: 12 }, // 新增治愈精灵
    ],
    // minLevel: 1,
    // maxLevel: 6,
    minEnemies: 4,
    maxEnemies: 8,
    specialBattles: [
      {
        every: 5,
        maxBossNum: 3,
        enemies: [{ id: "forest_boss_001", weight: 100 }],
        description: "每5次战斗必定遇到森林巨魔",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { forest_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      forest_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },
  cave_001: {
    id: "cave_001",
    name: "黑石洞窟",
    description: "阴暗潮湿的洞窟，哥布林和蝙蝠出没其间。",
    enemyPool: [
      { id: "lizard_001", weight: 15 },
      { id: "skeleton_001", weight: 15 },
      { id: "bat_001", weight: 20 },
      { id: "goblin_002", weight: 20 },
      { id: "goblin_001", weight: 30 },
    ],
    // minLevel: 4,
    // maxLevel: 10,
    minEnemies: 2,
    maxEnemies: 4,
    specialBattles: [
      {
        every: 7,
        maxBossNum: 3,
        enemies: [
          { id: "wolf_001", weight: 20 },
          { id: "cave_boss_001", weight: 100 },
        ],
        description: "每7次战斗大概率遇到洞窟巨蝎，也有机会遇到野狼",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { cave_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      cave_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },
  ruins_001: {
    id: "ruins_001",
    name: "遗迹深处",
    description: "古老遗迹的深处，危险与宝藏并存。",
    enemyPool: [
      { id: "mushroom_001", weight: 10 },
      { id: "lizard_001", weight: 15 },
      { id: "wolf_001", weight: 15 },
      { id: "goblin_002", weight: 15 },
      { id: "spirit_001", weight: 20 },
      { id: "skeleton_001", weight: 25 },
    ],
    // minLevel: 8,
    // maxLevel: 20,
    minEnemies: 2,
    maxEnemies: 5,
    specialBattles: [
      {
        every: 20,
        maxBossNum: 3,
        enemies: [{ id: "dragon_boss_001", weight: 100 }],
        description: "每20次战斗必定遇到熔岩巨龙",
      },
      {
        every: 10,
        maxBossNum: 3,
        enemies: [
          { id: "spirit_001", weight: 20 },
          { id: "ruins_boss_001", weight: 80 },
        ],
        description: "每10次战斗大概率遇到遗迹守卫者，也有机会遇到幽灵",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { ruins_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      ruins_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },
  snowfield_001: {
    id: "snowfield_001",
    name: "极寒雪原",
    description:
      "一片终年被冰雪覆盖的荒原，危机四伏，只有最勇敢的冒险者敢于挑战。",
    enemyPool: [
      { id: "ice_slime_001", weight: 30 },
      { id: "snow_wolf_001", weight: 20 },
      { id: "frost_goblin_001", weight: 18 },
      { id: "ice_bat_001", weight: 15 },
      { id: "snow_rabbit_001", weight: 22 },
      { id: "frost_spirit_001", weight: 10 },
    ],
    // minLevel: 6,
    // maxLevel: 8,
    minEnemies: 2,
    maxEnemies: 5,
    specialBattles: [
      {
        every: 16,
        maxBossNum: 3,
        enemies: [{ id: "snowfield_boss_002", weight: 100 }],
        description: "每16次战斗必定遇到极寒冰灵王",
      },
      {
        every: 8,
        maxBossNum: 3,
        enemies: [{ id: "snowfield_boss_001", weight: 100 }],
        description: "每8次战斗必定遇到雪原巨兽",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { snowfield_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      snowfield_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  cat_dungeon_001: {
    id: "cat_dungeon_001",
    name: "猫影深渊",
    description:
      "传说中猫族先祖封印的地牢，阴影与魔力交织，只有最强的冒险者敢于挑战。",
    enemyPool: [
      { id: "shadow_cat_001", weight: 18 },
      { id: "dungeon_guard_001", weight: 16 },
      { id: "phantom_mouse_001", weight: 15 },
      { id: "curse_bat_001", weight: 14 },
      { id: "iron_golem_001", weight: 12 },
      { id: "witch_cat_001", weight: 10 },
      { id: "shadow_mage_001", weight: 10 },
    ],
    minLevel: 20,
    // maxLevel: 25,
    minEnemies: 3,
    maxEnemies: 6,
    specialBattles: [
      {
        every: 20,
        maxBossNum: 3,
        enemies: [{ id: "cat_ancestor_king_001", weight: 100 }],
        description: "每20次战斗必定遇到猫祖王",
      },
      {
        every: 10,
        maxBossNum: 3,
        enemies: [{ id: "abyssal_lord_001", weight: 100 }],
        description: "每10次战斗必定遇到深渊领主",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { cat_dungeon_001_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      cat_dungeon_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  holy_cat_temple_001: {
    id: "holy_cat_temple_001",
    name: "神圣猫咪神殿",
    description:
      "传说中猫族信仰的圣地，光辉与神秘并存，只有最虔诚的冒险者才能踏足此地。",
    enemyPool: [
      { id: "cat_priest_001", weight: 18 },
      { id: "cat_paladin_001", weight: 15 },
      { id: "cat_sage_001", weight: 12 },
      { id: "cat_guardian_001", weight: 15 },
      { id: "cat_acolyte_001", weight: 20 },
    ],
    minLevel: 30,
    // maxLevel: 22,
    minEnemies: 2,
    maxEnemies: 5,
    specialBattles: [
      {
        every: 12,
        maxBossNum: 2,
        enemies: [{ id: "holy_cat_king_001", weight: 100 }],
        description: "每12次战斗必定遇到神圣猫王",
      },
      {
        every: 6,
        enemies: [
          { id: "cat_paladin_001", weight: 30 },
          { id: "cat_sage_001", weight: 20 },
          { id: "cat_guardian_001", weight: 50 },
        ],
        description: "每6次战斗大概率遇到猫族圣骑士、贤者或守护者",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: {
      holy_cat_temple_001_expedition_map: { count: 1 },
    },
    denseFogModeRequireResource: {
      holy_cat_temple_001_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  shadow_paw_hideout: {
    id: "shadow_paw_hideout",
    name: "影爪巢穴",
    description:
      "传说中只有最敏捷、最隐秘的猫咪刺客才敢踏足的黑暗巢穴。这里聚集着猫族刺客高手，步步杀机，只有最机警的冒险猫才能全身而退。",
    enemyPool: [
      { id: "shadow_paw_apprentice_001", weight: 25 },
      { id: "toxic_claw_001", weight: 20 },
      { id: "silent_whisker_001", weight: 18 },
      { id: "smoke_tail_001", weight: 15 },
      { id: "mirror_paw_001", weight: 12 },
    ],
    minLevel: 30,
    // maxLevel: 32,
    minEnemies: 2,
    maxEnemies: 4,
    specialBattles: [
      {
        every: 8,
        maxBossNum: 2,
        enemies: [{ id: "shadow_paw_master_boss_001", weight: 100 }],
        description: "每8次战斗必定遇到影爪首领",
      },
      {
        every: 4,
        maxBossNum: 2,
        enemies: [
          { id: "mirror_paw_001", weight: 60 },
          { id: "toxic_claw_001", weight: 40 },
        ],
        description: "每4次战斗大概率遇到镜爪刺客或烟尾猫",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: {
      shadow_paw_hideout_expedition_map: { count: 1 },
    },
    denseFogModeRequireResource: {
      shadow_paw_hideout_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  astralEmpressTrial: {
    id: "astralEmpressTrial",
    name: "星辉女帝试炼",
    description:
      "在星辉流转的神秘殿堂，猫族勇者们将接受女帝与其星辉守卫的考验。唯有心怀信仰与勇气，才能在星辰的见证下，获得女帝的认可与祝福。传说通过试炼者，将成为喵界真正的星辉之子。",
    enemyPool: [
      { id: "starguard_001", weight: 18 },
      { id: "astral_mage_001", weight: 15 },
      { id: "clockwork_cat_001", weight: 12 },
      { id: "comet_rogue_001", weight: 15 },
      { id: "starlight_healer_001", weight: 10 }, // 星光治愈猫
      { id: "astral_trap_001", weight: 20 },
      { id: "starguardian_boss_001", weight: 15 },
    ],
    minLevel: 40,
    // maxLevel: 45,
    minEnemies: 2,
    maxEnemies: 4,
    specialBattles: [
      {
        every: 10,
        maxBossNum: 2,
        enemies: [{ id: "astral_empress_boss_001", weight: 100 }],
        description: "每10次战斗均会接受星辉帝王猫的战斗评估",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: {
      astralEmpressTrial_expedition_map: { count: 1 },
    },
    denseFogModeRequireResource: {
      astralEmpressTrial_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  amusement_park: {
    id: "amusement_park",
    name: '"游乐园"',
    description:
      "一座欢乐的猫猫游乐园。旋转木马、糖果小丑、毛绒玩偶常见游乐设施这里都有哦！",
    enemyPool: [
      { id: "stardust_mouse_001", weight: 18 }, // 星尘鼠
      { id: "carousel_cat_001", weight: 15 }, // 旋转木马猫
      { id: "candy_clown_001", weight: 14 }, // 糖果小丑猫
      { id: "plush_guard_001", weight: 12 }, // 毛绒守卫猫
      { id: "starlight_healer_002", weight: 10 }, // 星光治愈猫
      { id: "ghostly_rider_001", weight: 8 }, // 幽灵骑手猫
    ],
    minLevel: 45,
    // maxLevel: 80,
    minEnemies: 4,
    maxEnemies: 8,
    specialBattles: [
      {
        every: 8,
        maxBossNum: 1,
        enemies: [
          { id: "parade_king_boss_001", weight: 100 }, // 游行王猫
        ],
        description:
          "每8次战斗必定遭遇游乐园吉祥物——游行王猫，需团队高强度协作。",
      },
      {
        every: 4,
        maxBossNum: 3,
        enemies: [
          { id: "candy_clown_001", weight: 40 },
          { id: "carousel_cat_001", weight: 30 },
          { id: "ghostly_rider_001", weight: 30 },
        ],
        description:
          "每4次战斗大概率遭遇糖果小丑猫、旋转木马猫和幽灵骑手猫的精英小队。",
      },
    ],
    expeditionRewardInfo: [],
    expeditionRequireResource: { amusement_park_expedition_map: { count: 1 } },
    denseFogModeRequireResource: {
      amusement_park_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  forbidden_library: {
    id: "forbidden_library",
    name: "禁魔图书馆",
    description:
      "传说中，猫猫世界最古老的图书馆，收藏着无数禁忌魔法书籍。远古猫祖用在被禁忌魔法侵蚀之前，使用最后的力量为这里布下了禁魔立场。",
    enemyPool: [
      { id: "silence_tome_001", weight: 18 }, // 沉默魔典
      { id: "forbidden_librarian_001", weight: 16 }, // 禁魔图书管理员猫
      { id: "arcane_lock_001", weight: 24 }, // 秘法锁链
      { id: "watcher_owl_001", weight: 12 }, // 审查猫头鹰
      { id: "living_bookmark_001", weight: 10 }, // 活体书签
      { id: "banished_cat_001", weight: 10 }, // 被放逐的猫
    ],
    minLevel: 50,
    // maxLevel: 200,
    minEnemies: 4,
    maxEnemies: 10,
    specialBattles: [
      {
        every: 12,
        maxBossNum: 1,
        enemies: [
          { id: "library_keeper_boss_001", weight: 100 }, // 禁魔守藏猫王
        ],
        description: "每12次战斗必定遭遇图书馆守护者猫王",
      },
      {
        every: 4,
        maxBossNum: 2,
        enemies: [{ id: "arcane_lock_001", weight: 100 }],
        description: "每4次战斗必定会遇到远古猫祖设下的驱魔锁陷阱。",
      },
    ],
    specialDescription:
      "每回合开始时，随机1-2名猫猫会陷入‘沉默’（无法释放技能）或‘封印’（技能冷却暂停）状态1回合，且所有主动技能冷却时间+1。",
    onEachTurnStart: (battleInfo) => {
      // 伪代码：每回合开始时，随机1-2名单位获得沉默或封印状态
      // 例如：applyRandomForbiddenState(battleInfo)
    },
    onEachBattleStart: (battleInfo) => {
      // 伪代码：每场战斗所有主动技能冷却+1
      // 例如：increaseAllActiveSkillCooldown(battleInfo, 1)
    },
    expeditionRewardInfo: [],
    expeditionRequireResource: {
      forbidden_library_expedition_map: { count: 1 },
    },
    denseFogModeRequireResource: {
      forbidden_library_expedition_denseFog_map: {
        count: 1,
      },
    },
  },

  nightmare_prison: {
    id: "nightmare_prison",
    name: "噩梦监狱",
    description:
      "猫族历史上最黑暗的禁地，传说中关押着无数被封印的恶魔与堕落猫灵。监狱深处弥漫着绝望与疯狂的气息，每一层都有更加可怕的守卫。只有最强大的猫族英雄团队才敢挑战这个噩梦之地。警告：此地的恶意会侵蚀灵魂，弱者勿入！",
    enemyPool: [
      { id: "nightmare_warden_001", weight: 20 }, // 噩梦狱卒
      { id: "soul_eater_demon_001", weight: 18 }, // 噬魂恶魔
      { id: "corrupted_cat_spirit_001", weight: 22 }, // 堕落猫灵
      { id: "despair_phantom_001", weight: 16 }, // 绝望幻影
      { id: "torture_machine_001", weight: 14 }, // 酷刑机器
    ],
    minLevel: 60,
    // maxLevel: 350,
    minEnemies: 8,
    maxEnemies: 12,
    specialBattles: [
      {
        every: 30,
        maxBossNum: 1,
        enemies: [
          { id: "prison_overlord_boss_001", weight: 100 }, // 监狱霸主
        ],
        description: "每30次战斗必定遭遇监狱的最终boss——深层监狱霸主",
      },
      {
        every: 15,
        maxBossNum: 2,
        enemies: [
          { id: "nightmare_cat_lord_001", weight: 100 }, // 噩梦猫王
        ],
        description: "每15次战斗大概率遭遇噩梦猫王",
      },
    ],
    denseFogModeRequireResource: {
      nightmare_prison_expedition_denseFog_map: {
        count: 1,
      },
    },
    specialDescription:
      "战斗开始时，所有玩家猫咪会受到'恐惧'状态影响（攻击力-30%，防御力-20%）持续3回合。每回合结束时，血量最低的猫咪会受到当前生命值10%的真实伤害。每击败一个敌人，剩余敌人的攻击力会增加15%。",
    // onEachTurnStart: (battleInfo) => {
    //   let playerMemberUuids = battleInfo.groups[battleInfo.playerGroupId]

    //   let playerMembers = playerMemberUuids.map(uuid => battleInfo.members.find(m => m.uuid === uuid)).filter(m => m) as BaseBattleUnit[]

    //   let enemyGroupId = Object.keys(battleInfo.groups).find(g => g !== battleInfo.playerGroupId && battleInfo.groups[g].length > 0)

    //   if (!enemyGroupId) {
    //     return;
    //   }

    //   let firstEnemyUuid = battleInfo.groups[enemyGroupId][0]
    //   let firstEnemy = battleInfo.members.find(u => u.uuid == firstEnemyUuid)

    //   if (!firstEnemy) {
    //     return;
    //   }

    // },
    // onEachBattleStart: ({battleInfo, callbacks}) => {

    //   let playerMemberUuids = battleInfo.groups[battleInfo.playerGroupId]

    //   let enemyGroupId = Object.keys(battleInfo.groups).find(g => g !== battleInfo.playerGroupId && battleInfo.groups[g].length > 0)

    //   if (!enemyGroupId) {
    //     return;
    //   }

    //   let firstEnemyUuid = battleInfo.groups[enemyGroupId][0]
    //   let firstEnemy = battleInfo.members.find(u => u.uuid == firstEnemyUuid)

    //   if (!firstEnemy) {
    //     return;
    //   }

    //   for(const uuid of playerMemberUuids) {
    //     let member = battleInfo.members.find(m => m.uuid === uuid)
    //     if (!member) {
    //       continue;
    //     }

    //    await addState('nightmarePrisonFear', 3, firstEnemy, member, {
    //     }, {
    //       callbacks,
    //       battleInfo
    //     })
    //   }
    // },
  },

  cat_dungeon_002: {
    id: "cat_dungeon_002",
    name: "猫影深渊·回响地牢",
    description:
      "猫影深渊更深处的地牢，关押着非常危险的存在，只有真正的猫之贤者，才能在黑暗中保持冷静。",
    enemyPool: [
      // 新增·强壮型
      { id: "cd_br1", weight: 16 }, // 黑岩执盾者
      { id: "cd_wd1", weight: 15 }, // 铁誓狱卫
      { id: "cd_ma1", weight: 16 }, // 碎骨重锤猫
      { id: "cd_ec1", weight: 12 }, // 回声巨像
      { id: "cd_rg1", weight: 15 }, // 裂爪破阵者

      // 新增·高威胁
      { id: "cd_sw1", weight: 12 }, // 静语织咒者
      { id: "cd_nb1", weight: 13 }, // 夜幕噬影者
      { id: "cd_ha1", weight: 12 }, // 咒缚弓手
      { id: "cd_mk1", weight: 11 }, // 镜纹刺客
      { id: "cd_vc1", weight: 10 }, // 虚渊呼唤者

      // 新增·特征/机制怪
      // { id: "cd_et1", weight: 8 }, // 回声图腾
      // { id: "cd_fp1", weight: 9 },  // 分形幻喵
      // { id: "cd_bb1", weight: 8 },  // 咒音炸翼

      // 新增·终极Boss（极低权重，仍建议在 specialBattles 中出现）
      // { id: "cd_qn", weight: 2 },   // 回响女王·寂鸣
      // { id: "cd_hb", weight: 2 },   // 虚渊先驱·无相
      // { id: "cd_kg", weight: 2 },   // 影廷之王·漆冕
      // { id: "cd_oc", weight: 2 },   // 誓约巨像·玄铁
    ],
    // minLevel: 70,
    minEnemies: 10,
    maxEnemies: 14,
    specialBattles: [
      {
        every: 30,
        maxBossNum: 5,
        enemies: [
          { id: "cd_hb", weight: 100 },
          { id: "cd_oc", weight: 100, maxCountPerWave: 1 },
        ],
        description: "每30次战斗必定遭遇‘玄铁巨像’与‘虚渊无相先驱’",
      },
      {
        every: 15,
        maxBossNum: 5,
        enemies: [
          { id: "cd_qn", weight: 100 },
          { id: "cd_kg", weight: 100 },
        ],
        description: "每15次战斗必定遭遇‘寂鸣回响女王’与‘漆冕影廷之王’",
      },
      {
        every: 7,
        maxBossNum: 1,
        enemies: [{ id: "cd_oc", weight: 100 }],
        description: "每5次战斗必定遭遇‘玄铁巨像’",
      },
    ],
    // specialDescription: "环境效果：1) 施法回响：任意单位释放技能时，受到最大生命5%的真实反噬，并有一名友军同受。2) 黑暗偏执：敌人造成的魔法伤害+10%，玩家造成的物理伤害-10%。3) 启战锁喉：战斗开始时，随机1名玩家单位被‘沉默’1回合。",
    requireResourceToEnter: {
      dungeonKey: { count: 1 },
    },
    denseFogModeRequireResource: {
      cat_dungeon_002_expedition_denseFog_map: {
        count: 1,
      },
    },
  },
  // ...existing code...
} as const satisfies Record<string, BattleArea>;

Object.keys(allBattleAreas).forEach((key) => {
  const areaId = key as keyof typeof allBattleAreas;
  const area = allBattleAreas[areaId] as BattleArea;
  if (Object.hasOwn(area, 'expeditionRewardInfo')) {
    area.expeditionRewardInfo = generateAllItemDropInArea(areaId);
  }
})

export const allBattleAreaExpeditionInfo = {
  plain_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  forest_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  cave_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  ruins_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  snowfield_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 120000, // 120秒
    dropRateMultiplier: 1,
  },
  cat_dungeon_001: {
    normalBattleDuration: 60000, // 30秒
    specialBattleDuration: 120000, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  cat_dungeon_002: {
    normalBattleDuration: 1000 * 60 * 1, // 60秒
    specialBattleDuration: 1000 * 60 * 2, // 120秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  holy_cat_temple_001: {
    normalBattleDuration: 1000 * 60 * 1, // 30秒
    specialBattleDuration: 1000 * 60 * 2, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  shadow_paw_hideout: {
    normalBattleDuration: 1000 * 60 * 1, // 30秒
    specialBattleDuration: 1000 * 60 * 3, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  astralEmpressTrial: {
    normalBattleDuration: 1000 * 60 * 1, // 30秒
    specialBattleDuration: 1000 * 60 * 3, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
  amusement_park: {
    normalBattleDuration: 1000 * 60 * 1, // 30秒
    specialBattleDuration: 1000 * 60 * 3, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },

  forbidden_library: {
    normalBattleDuration: 1000 * 60 * 1, // 30秒
    specialBattleDuration: 1000 * 60 * 3, // 60秒
    travelDuration: 60000, // 120秒
    dropRateMultiplier: 1,
  },
} as const satisfies { [area in keyof typeof allBattleAreas]?: BattleAreaExpeditionInfo };