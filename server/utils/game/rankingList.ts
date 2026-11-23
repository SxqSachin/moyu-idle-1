import { RankingList, RankingListItem } from "~/shared/types/rankingList";

export const getAllRankingList = async () => {
  // 先获取基础排行榜
  const baseRankingTypes = [
    'sponsor_ranking_list',
    'gold_ranking_list_normal',
    'cat_paw_coin_ranking_list_normal',
    'cat_paw_stamp_ranking_list_normal',
    'character_total_level_ranking_list_normal',
    'kitty_friendship_ranking_list_normal',
    'kitty_most_friends_ranking_list_normal',
    'axe_enhance_level_ranking_list_normal'
  ];


  const allKeys = [
    "character_cooking_level_ranking_list_normal",
    "character_defencing_level_ranking_list_normal",
    "character_battle_level_ranking_list_normal",
    "character_attacking_level_ranking_list_normal",
    "character_trading_level_ranking_list_normal",
    "character_farmingAnimal_level_ranking_list_normal",
    "character_farmingPlant_level_ranking_list_normal",
    "character_luck_level_ranking_list_normal",
    "character_intelligence_level_ranking_list_normal",
    "character_collecting_level_ranking_list_normal",
    "character_mining_level_ranking_list_normal",
    "character_total_level_ranking_list_normal",
    "character_forging_level_ranking_list_normal",
    "character_dexterity_level_ranking_list_normal",
    "character_mysterious_level_ranking_list_normal",
    "character_exploring_level_ranking_list_normal",
    "character_strength_level_ranking_list_normal",
    "character_enhance_level_ranking_list_normal",
    "character_sewing_level_ranking_list_normal",
    "character_knowledge_level_ranking_list_normal",
    "character_manufacturing_level_ranking_list_normal",
    "character_stamina_level_ranking_list_normal",
    "character_fishing_level_ranking_list_normal",
  ]
  // 排除 character_total_level_ranking_list，避免重复
  const attributeRankingTypes = allKeys.filter(
    key => key !== 'character_total_level_ranking_list_normal'
  );

  const allRankingListType = [...baseRankingTypes, ...attributeRankingTypes];

  let rankingList: RankingList[] = [];

  for (const type of allRankingListType) {
    let res = await redisClient.get(type);

    if (!res) {
      continue;
    }

    let list = JSON.parse(res) as RankingListItem[];

    // 过滤掉不合理的数值
    list = list.filter(item => {
      const value = Number(item.rank);
      return value >= 0
    });

    rankingList.push({
      name: type,
      list: list
    });
  }

  return rankingList;
}

export const getAllIronRankingList = async () => {
  // 先获取基础排行榜
  const baseRankingTypes = [
    'sponsor_ranking_list',
    'gold_ranking_list_iron',
    'cat_paw_coin_ranking_list_iron',
    'cat_paw_stamp_ranking_list_iron',
    'character_total_level_ranking_list_iron',
    'kitty_friendship_ranking_list_iron',
    'kitty_most_friends_ranking_list_iron',
    'axe_enhance_level_ranking_list_iron'
  ];


  const allKeys = [
    "character_cooking_level_ranking_list_iron",
    "character_defencing_level_ranking_list_iron",
    "character_battle_level_ranking_list_iron",
    "character_attacking_level_ranking_list_iron",
    "character_trading_level_ranking_list_iron",
    "character_farmingAnimal_level_ranking_list_iron",
    "character_farmingPlant_level_ranking_list_iron",
    "character_luck_level_ranking_list_iron",
    "character_intelligence_level_ranking_list_iron",
    "character_collecting_level_ranking_list_iron",
    "character_mining_level_ranking_list_iron",
    "character_total_level_ranking_list_iron",
    "character_forging_level_ranking_list_iron",
    "character_dexterity_level_ranking_list_iron",
    "character_mysterious_level_ranking_list_iron",
    "character_exploring_level_ranking_list_iron",
    "character_strength_level_ranking_list_iron",
    "character_enhance_level_ranking_list_iron",
    "character_sewing_level_ranking_list_iron",
    "character_knowledge_level_ranking_list_iron",
    "character_manufacturing_level_ranking_list_iron",
    "character_stamina_level_ranking_list_iron",
    "character_fishing_level_ranking_list_iron",
  ]
  // 排除 character_total_level_ranking_list，避免重复
  const attributeRankingTypes = allKeys.filter(
    key => key !== 'character_total_level_ranking_list_iron'
  );

  const allRankingListType = [...baseRankingTypes, ...attributeRankingTypes];

  let rankingList: RankingList[] = [];

  for (const type of allRankingListType) {
    let res = await redisClient.get(type);

    if (!res) {
      continue;
    }

    let list = JSON.parse(res) as RankingListItem[];

    // 过滤掉不合理的数值
    list = list.filter(item => {
      const value = Number(item.rank);
      return value >= 0
    });

    rankingList.push({
      name: type,
      list: list
    });
  }

  return rankingList;
}