module.exports = {
  apps: [
    {
      name: "task_local",
      script: "bun",
      args: "--env-file=.env.development ./src/process/runUserTaskProcessZSet.ts",
      instances: 1,
      exec_mode: "fork",
      env: {
        TASK_EXEC_CONCURRENCY: "8",
        TASK_POP_LIMIT: "300",
      },
    },
    {
      name: "battle_outcome_worker_local",
      script: "bun --env-file=.env.development ./src/process/battleOutcomeWorker.ts",
      instances: 1,
      exec_mode: "fork",
      env: {
        BATTLE_OUTCOME_POP_BATCH: "256",
        BATTLE_OUTCOME_WORKER_CONCURRENCY: "8",
        BATTLE_OUTCOME_POP_TIMEOUT_SEC: "5",
      },
    },
    {
      name: "transfer_guild_leader_local",
      script: "bun --env-file=.env.development ./src/cron/transferInactiveGuildLeaders.ts",
    },
    {
      name: "battle_local",
      // script: "bun --env-file=.env.development --enable-source-maps ./dist/runBattleProcess.js --group=0 --groupCount=1",
      script: "bun --env-file=.env.development ./src/process/runBattleProcess.ts --group=0 --groupCount=1",
      // bun build ./src/process/runBattleProcess.ts  --outdir ./.output --env-file=.env.development --env inline --group=0 --groupCount=1 --target node       
    },
    {
      name: "battle_world_boss_local",
      script: "bun --env-file=.env.development ./src/process/runWorldBossBattleProcess.ts --group=0 --groupCount=1",
    },
    {
      name: "kitty_local",
      script: "bun --env-file=.env.development ./src/process/runKittyTaskProcess.ts --group=0 --groupCount=1",
    },
    {
      name: "kitty_local_zset",
      instances: 1,
      exec_mode: "fork",
      script: "bun --env-file=.env.development ./src/process/runKittyTaskProcessZSet.ts",
      env: { KITTY_TASK_EXEC_CONCURRENCY: "16", KITTY_TASK_POP_LIMIT: "300" },
    },
    {
      name: "fishing_zset_local",
      script: "bun --env-file=.env.development ./src/process/runFishingProcess.ts",
      instances: 1,
      exec_mode: "fork",
      // 本地测试：将判定间隔设为较短，便于快速迭代（单位：毫秒）
      env: {
        FISHING_MIN_TICK_MS: String(0.02 * 60_000),
        FISHING_MAX_TICK_MS: String(0.08 * 60_000),
      },
    },
    // 生产环境：钓鱼 zset worker（可按需调整 instances）
    {
      name: "fishing_zset",
      script: "bun --env-file=.env.production ./src/process/runFishingProcess.ts",
      instances: 2,
      exec_mode: "fork",
      env: {
        // 这里保留示例 env，脚本默认使用常量配置；可以用于调优并方便运维
        FISHING_POP_LIMIT: "300",
        // 生产使用分钟级单位（毫秒）——默认 5 到 12 分钟
        FISHING_MIN_TICK_MS: String(2 * 60_000),
        FISHING_MAX_TICK_MS: String(4 * 60_000),
      },
    },
    {
      name: "kitty_furniture_durability_local",
      script: "bun --env-file=.env.development ./src/cron/updateKittyFurnitureDurability.ts",
    },
    {
      name: "kitty_auto_feeder_local",
      script: "bun --env-file=.env.development ./src/cron/kittyAutoFeeder.ts",
    },
    {
      name: "alchemy_auto_local",
      script: "bun --env-file=.env.development ./src/cron/autoAlchemy.ts",
    },
    {
      name: "clear_idle_room_local",
      script: "bun --env-file=.env.development ./src/cron/clearIdleRoom.ts",
    },
    {
      name: "tavern_local",
      script: "bun --env-file=.env.development ./src/cron/updateTavernState.ts",
    },
    {
      name: "ranking_local",
      script: "bun --env-file=.env.development ./src/process/updateRanking.ts",
    },
    {
      name: "kitty_essay_local",
      script: "bun --env-file=.env.development ./src/cron/kittyDiary.ts",
    },
    {
      name: "kitty_encounter_local",
      script: "bun --env-file=.env.development ./src/cron/kittyEncounter.ts",
    },
    {
      name: "kitty_friend_local",
      script: "bun --env-file=.env.development ./src/cron/kittyFriend.ts",
    },
    {
      name: "kitty_expedition_local",
      script: "bun --env-file=.env.development ./src/process/runKittyExpeditionProcess.ts --group=0 --groupCount=1",
    },
    {
      name: "market_local",
      script: "bun --env-file=.env.development ./src/cron/createMarketJSON.ts",
    },
    {
      name: "enhance_local",
      script: "bun --env-file=.env.development ./src/process/runAutoEnhanceProcess.ts --group=0 --groupCount=1",
    },
    {
      name: "dispatch_quest_local",
      script: "bun --env-file=.env.development ./src/cron/dispatchQuest.ts",
    },
    {
      name: "kittyDailyCutePoint_local",
      script: "bun --env-file=.env.development ./src/cron/kittyDailyCutePoint.ts",
    },
    {
      name: "kittyMood_local",
      script: "bun --env-file=.env.development ./src/cron/kittyMood.ts",
      env: {
        KITTY_MOOD_CONCURRENCY: "100",
      },
    },

    {
      name: "cleanBannedUser_local",
      script: "bun --env-file=.env.development ./src/cron/rebanUser.ts",
    },

    {
      name: "guild_building_local",
      script: "bun --env-file=.env.development ./src/cron/updateGuildBuildingState.ts",
    },
    {
      name: "village_building_local",
      script: "bun --env-file=.env.development ./src/cron/updateVillageBuildingState.ts",
    },
    {
      name: "cleanWishingPoolLuckStatus_local",
      script: "bun --env-file=.env.development ./src/cron/cleanWishingPoolLuckStatus.ts",
    },
    {
      name: "cleanPlayerGlobalState_local",
      script: "bun --env-file=.env.development ./src/cron/cleanPlayerGlobalState.ts",
    },
    {
      name: "kittyHomeServiceCenterService_local",
      script: "bun --env-file=.env.development ./src/cron/kittyHomeServiceCenterService.ts",
    },
    {
      name: "auction_local",
      script: "bun --env-file=.env.development ./src/cron/auction.ts",
    },
    {
      name: "distribute_world_boss_rewards_local",
      script: "bun --env-file=.env.development ./src/cron/distributeWorldBossRewards.ts",
    },
    {
      name: "restockMarket_local",
      script: "bun --env-file=.env.development ./src/cron/gmRestockMarket.ts",
    },
    {
      name: "sync_room_keys_local",
      script: "bun --env-file=.env.development ./src/cron/syncRoomKeys.ts",
      autorestart: false,
    },

    {
      name: "sponsor_local",
      script: "bun --env-file=.env.development ./src/cron/updateSponsorList.ts",
      autorestart: false,
    },

    // {
    //   name: "returnAllUntradeableResourceInGuildInventory_local",
    //   script: "bun --env-file=.env.development ./src/process/returnAllUntradeableResourceInGuildInventory.ts",
    //   autorestart: false,
    // },

    // {
    //   name: "backfill_guild_personal_balance_local",
    //   script: "bun --env-file=.env.development ./src/process/procBackfillGuildPersonalBalance.ts",
    //   instances: 1,
    //   exec_mode: "fork",
    //   autorestart: false,
    // },

    {
      name: "updateFarmPlots_local",
      script: "bun --env-file=.env.development ./src/cron/updateFarmPlots.ts",
      autorestart: true,
    },


    {
      name: "task_new",
      // 通过 script=bun + args 方式避免 PM2 对 TS 文件 require 包装导致的 “require() async module” 报错
      script: "bun",
      args: "--env-file=.env.production.heav ./src/process/runUserTaskProcessZSet.ts",
      instances: 4,
      exec_mode: "fork",
    },
    {
      name: "task_new_proxy",
      // 通过 script=bun + args 方式避免 PM2 对 TS 文件 require 包装导致的 “require() async module” 报错
      script: "bun",
      args: "--env-file=.env.production_proxy.heav ./src/process/runUserTaskProcessZSet.ts",
      instances: 4,
      exec_mode: "fork",
    },


    {
      name: "gmMarketBuyer_local",
      script: "bun --env-file=.env.development ./src/cron/gmMarketBuyer.ts",
    },


    // Production: run the prebuilt JS bundle for more stable startup
    {
      name: "battle1",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=0 --groupCount=9",
    },
    {
      name: "battle2",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=1 --groupCount=9",
    },
    {
      name: "battle3",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=2 --groupCount=9",
    },
    {
      name: "battle_b1",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=3 --groupCount=9",
    },
    {
      name: "battle_b2",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=4 --groupCount=9",
    },
    {
      name: "battle_b3",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=5 --groupCount=9",
    },
    {
      name: "battle_c1",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=6 --groupCount=9",
    },
    {
      name: "battle_c2",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=7 --groupCount=9",
    },
    {
      name: "battle_c3",
      script: "bun --env-file=.env.production ./src/process/runBattleProcess.ts --group=8 --groupCount=9",
    },

    {
      name: "battle_world_boss_1",
      script: "bun --env-file=.env.production ./src/process/runWorldBossBattleProcess.ts --group=0 --groupCount=3",
    },
    {
      name: "battle_world_boss_2",
      script: "bun --env-file=.env.production ./src/process/runWorldBossBattleProcess.ts --group=1 --groupCount=3",
    },
    {
      name: "battle_world_boss_3",
      script: "bun --env-file=.env.production ./src/process/runWorldBossBattleProcess.ts --group=2 --groupCount=3",
    },

    {
      name: "kitty_zset",
      script: "bun --env-file=.env.production_proxy.heav ./src/process/runKittyTaskProcessZSet.ts",
      instances: 3,
      exec_mode: "fork",
      // env: { KITTY_TASK_EXEC_CONCURRENCY: "24", KITTY_TASK_POP_LIMIT: "400" },
    },

    {
      name: "kitty_expedition_a",
      script: "bun --env-file=.env.production ./src/process/runKittyExpeditionProcess.ts --group=0 --groupCount=2",
    },
    {
      name: "kitty_expedition_a",
      script: "bun --env-file=.env.production ./src/process/runKittyExpeditionProcess.ts --group=1 --groupCount=2",
    },

    {
      name: "auto_enhance_aa",
      script: "bun --env-file=.env.production ./src/process/runAutoEnhanceProcess.ts --group=0 --groupCount=2",
    },
    {
      name: "auto_enhance_aa",
      script: "bun --env-file=.env.production ./src/process/runAutoEnhanceProcess.ts --group=1 --groupCount=2",
    },

    {
      name: "ranking",
      script: "bun --env-file=.env.production ./src/process/updateRanking.ts",
    },
    {
      name: "kitty_satiety",
      script: "bun --env-file=.env.production ./src/cron/kittySatietyCheck.ts",
    },
    {
      name: "kitty_furniture_durability",
      script: "bun --env-file=.env.production ./src/cron/updateKittyFurnitureDurability.ts",
    },
    {
      name: "kitty_auto_feeder",
      script: "bun --env-file=.env.production ./src/cron/kittyAutoFeeder.ts",
    },
    {
      name: "alchemy_auto",
      script: "bun --env-file=.env.production ./src/cron/autoAlchemy.ts",
    },
    {
      name: "dispatch_quest",
      script: "bun --env-file=.env.production ./src/cron/dispatchQuest.ts",
    },
    {
      name: "clear_idle_room",
      script: "bun --env-file=.env.production ./src/cron/clearIdleRoom.ts",
    },
    {
      name: "tavern",
      script: "bun --env-file=.env.production ./src/cron/updateTavernState.ts",
    },
    {
      name: "kitty_essay",
      script: "bun --env-file=.env.production ./src/cron/kittyDiary.ts",
    },
    {
      name: "kitty_encounter",
      script: "bun --env-file=.env.production ./src/cron/kittyEncounter.ts",
    },
    {
      name: "kitty_friend",
      script: "bun --env-file=.env.production ./src/cron/kittyFriend.ts",
    },
    {
      name: "market",
      script: "bun --env-file=.env.production  ./src/cron/createMarketJSON.ts",
    },
    {
      name: "guild_building",
      script: "bun --env-file=.env.production ./src/cron/updateGuildBuildingState.ts",
    },
    {
      name: "village_building",
      script: "bun --env-file=.env.production ./src/cron/updateVillageBuildingState.ts",
    },
    {
      name: "cleanWishingPoolLuckStatus",
      script: "bun --env-file=.env.production ./src/cron/cleanWishingPoolLuckStatus.ts",
    },
    {
      name: "cleanPlayerGlobalState",
      script: "bun --env-file=.env.production ./src/cron/cleanPlayerGlobalState.ts",
    },
    {
      name: "kittyHomeServiceCenterService",
      script: "bun --env-file=.env.production ./src/cron/kittyHomeServiceCenterService.ts",
    },
    {
      name: "kittyMood",
      script: "bun --env-file=.env.production ./src/cron/kittyMood.ts",
      env: {
        KITTY_MOOD_CONCURRENCY: "100",
      },
    },
    {
      name: "kittyDailyCutePoint",
      script: "bun --env-file=.env.production ./src/cron/kittyDailyCutePoint.ts",
    },
    {
      name: "auction",
      script: "bun --env-file=.env.production ./src/cron/auction.ts",
    },
    {
      name: "distribute_world_boss_rewards",
      script: "bun --env-file=.env.production ./src/cron/distributeWorldBossRewards.ts",
    },
    {
      name: "restockMarket",
      script: "bun --env-file=.env.production ./src/cron/gmRestockMarket.ts",
    },
    {
      name: "sync_room_keys",
      script: "bun --env-file=.env.production ./src/cron/syncRoomKeys.ts",
      autorestart: false,
    },

    {
      name: "cleanBannedUser",
      script: "bun --env-file=.env.production ./src/cron/rebanUser.ts",
      autorestart: false,
    },

    {
      name: "sponsor",
      script: "bun --env-file=.env.production ./src/cron/updateSponsorList.ts",
      autorestart: false,
    },

    {
      name: "clear12_local",
      script: "bun --env-file=.env.development ./src/cron/clear12Room.ts",
      autorestart: false,
    },
    {
      name: "clear12",
      script: "bun --env-file=.env.production ./src/cron/clear12Room.ts",
      autorestart: false,
    },

    // Clear rooms containing banned users
    {
      name: "clear_rooms_with_banned_users_local",
      script: "bun --env-file=.env.development ./src/cron/clearRoomsWithBannedUsers.ts",
      autorestart: false,
    },
    {
      name: "clear_rooms_with_banned_users",
      script: "bun --env-file=.env.production ./src/cron/clearRoomsWithBannedUsers.ts",
      autorestart: false,
    },

    // Clear rooms containing users who haven't logged in since Nov 1
    {
      name: "clear_rooms_with_stale_users_local",
      script: "bun --env-file=.env.development ./src/cron/clearRoomsWithStaleUsers.ts",
      // autorestart: false,
    },
    {
      name: "clear_rooms_with_stale_users",
      script: "bun --env-file=.env.production ./src/cron/clearRoomsWithStaleUsers.ts",
      // autorestart: false,
    },

    // Report rooms containing users who appear in multiple rooms
    {
      name: "find_rooms_with_duplicate_users_local",
      script: "bun --env-file=.env.development ./src/cron/findRoomsWithDuplicateUsers.ts",
      autorestart: false,
    },
    {
      name: "find_rooms_with_duplicate_users",
      script: "bun --env-file=.env.production ./src/cron/findRoomsWithDuplicateUsers.ts",
      autorestart: false,
    },

    // Report abnormal rooms: rooms with duplicate user(s) OR empty member list
    {
      name: "find_abnormal_rooms_local",
      script: "bun --env-file=.env.development ./src/cron/findAbnormalRooms.ts",
      autorestart: false,
    },
    {
      name: "find_abnormal_rooms",
      script: "bun --env-file=.env.production ./src/cron/findAbnormalRooms.ts",
      autorestart: false,
    },

    // Clear players who appear in multiple battling rooms (report-only)
    {
      name: "clear_players_multiple_battles_local",
      script: "bun --env-file=.env.development ./src/cron/clearPlayersInMultipleBattles.ts",
      autorestart: false,
    },
    {
      name: "clear_players_multiple_battles",
      script: "bun --env-file=.env.production ./src/cron/clearPlayersInMultipleBattles.ts",
      autorestart: false,
    },

    // Clear empty rooms (memberIds empty)
    {
      name: "clear_empty_rooms_local",
      script: "bun --env-file=.env.development ./src/cron/clearEmptyRooms.ts",
      autorestart: false,
    },
    {
      name: "clear_empty_rooms",
      script: "bun --env-file=.env.production ./src/cron/clearEmptyRooms.ts",
      autorestart: false,
    },

    // {
    //   name: "returnAllUntradeableResourceInGuildInventory",
    //   script: "bun --env-file=.env.production ./src/process/returnAllUntradeableResourceInGuildInventory.ts",
    //   autorestart: false,
    // },


    {
      name: "updateFarmPlots",
      script: "bun --env-file=.env.production.heav ./src/cron/updateFarmPlots.ts",
      autorestart: true,
    },


    {
      name: "gmMarketBuyer",
      script: "bun --env-file=.env.production ./src/cron/gmMarketBuyer.ts",
    },
    {
      name: "transfer_guild_leader",
      script: "bun --env-file=.env.production ./src/cron/transferInactiveGuildLeaders.ts",
    },

    {
      name: "battle_outcome_worker_for_main",
      script: "bun --env-file=.env.production ./src/process/battleOutcomeWorker.ts",
      instances: 2,
      exec_mode: "fork",
      env: {
        // Adjusted for lower CPU usage
        BATTLE_OUTCOME_POP_BATCH: "1000", // Reduced batch size
        BATTLE_OUTCOME_WORKER_CONCURRENCY: "400", // Reduced concurrency
        BATTLE_OUTCOME_POP_TIMEOUT_SEC: "1", // Increased timeout for less frequent polling
        BATTLE_OUTCOME_POLL_DELAY_MS: "200" // Added delay to reduce CPU pressure
      },
    },
    {
      name: "battle_outcome_worker",
      script: "bun --env-file=.env.production.heav ./src/process/battleOutcomeWorker.ts",
      instances: 4,
      exec_mode: "fork",
      env: {
        // tune for production throughput
        BATTLE_OUTCOME_POP_BATCH: "512",
        BATTLE_OUTCOME_WORKER_CONCURRENCY: "10",
        BATTLE_OUTCOME_POP_TIMEOUT_SEC: "0.5",
        BATTLE_OUTCOME_POLL_DELAY_MS: "100" // Added delay to reduce CPU pressure
      },
    },
    {
      name: "battle_outcome_worker_proxy",
      script: "bun --env-file=.env.production_proxy.heav ./src/process/battleOutcomeWorker.ts",
      instances: 4,
      exec_mode: "fork",
      env: {
        // tune for production throughput
        BATTLE_OUTCOME_POP_BATCH: "512",
        BATTLE_OUTCOME_WORKER_CONCURRENCY: "10",
        BATTLE_OUTCOME_POP_TIMEOUT_SEC: "0.5",
        BATTLE_OUTCOME_POLL_DELAY_MS: "100" // Added delay to reduce CPU pressure
      },
    },

    // Production one-off backfill (guarded to run only on empty table)
    // {
    //   name: "backfill_guild_personal_balance",
    //   script: "bun --env-file=.env.production ./src/process/procBackfillGuildPersonalBalance.ts",
    //   instances: 1,
    //   exec_mode: "fork",
    //   autorestart: false,
    // },

    // Init player item codex from CharacterNewInventory (one-off)
    {
      name: "init_codex_item_collect_local",
      script: "bun --env-file=.env.development ./src/process/initCodexItemCollect.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      env: {
        CODEX_INIT_BATCH: "2000",
      },
    },
  ],
};