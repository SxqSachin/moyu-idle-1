module.exports = {
  apps: [
    {
      name: "kitty_expedition_a",
      script:
        "bun --env-file=.env.production_proxy ./src/process/runKittyExpeditionProcess.ts --group=0 --groupCount=2",
    },
    {
      name: "kitty_expedition_a",
      script:
        "bun --env-file=.env.production_proxy ./src/process/runKittyExpeditionProcess.ts --group=1 --groupCount=2",
    },

    {
      name: "auto_enhance_aa",
      script:
        "bun --env-file=.env.production_proxy ./src/process/runAutoEnhanceProcess.ts --group=0 --groupCount=2",
    },
    {
      name: "auto_enhance_aa",
      script:
        "bun --env-file=.env.production_proxy ./src/process/runAutoEnhanceProcess.ts --group=1 --groupCount=2",
    },

    {
      name: "ranking",
      script:
        "bun --env-file=.env.production_proxy ./src/process/updateRanking.ts",
    },
    {
      name: "kitty_satiety",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/kittySatietyCheck.ts",
    },
    {
      name: "kitty_furniture_durability",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/updateKittyFurnitureDurability.ts",
    },
    {
      name: "kitty_auto_feeder",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/kittyAutoFeeder.ts",
    },
    {
      name: "alchemy_auto",
      script: "bun --env-file=.env.production_proxy ./src/cron/autoAlchemy.ts",
    },
    {
      name: "dispatch_quest",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/dispatchQuest.ts",
    },
    {
      name: "clear_idle_room",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/clearIdleRoom.ts",
    },
    {
      name: "tavern",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/updateTavernState.ts",
    },
    {
      name: "kitty_essay",
      script: "bun --env-file=.env.production_proxy ./src/cron/kittyDiary.ts",
    },
    {
      name: "kitty_encounter",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/kittyEncounter.ts",
    },
    {
      name: "kitty_friend",
      script: "bun --env-file=.env.production_proxy ./src/cron/kittyFriend.ts",
    },
    {
      name: "guild_building",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/updateGuildBuildingState.ts",
    },
    {
      name: "village_building",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/updateVillageBuildingState.ts",
    },
    {
      name: "cleanPlayerGlobalState",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/cleanPlayerGlobalState.ts",
    },
    {
      name: "kittyHomeServiceCenterService",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/kittyHomeServiceCenterService.ts",
    },
    {
      name: "kittyMood",
      script: "bun --env-file=.env.production_proxy ./src/cron/kittyMood.ts",
      env: {
        KITTY_MOOD_CONCURRENCY: "100",
      },
    },
    {
      name: "kittyDailyCutePoint",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/kittyDailyCutePoint.ts",
    },

    {
      name: "updateFarmPlots",
      script:
        "bun --env-file=.env.production.heav ./src/cron/updateFarmPlots.ts",
      autorestart: true,
    },

    {
      name: "clear_rooms_with_stale_users",
      script: "bun --env-file=.env.production_proxy ./src/cron/clearRoomsWithStaleUsers.ts",
      // autorestart: false,
    },

    // {
    //   name: "gmMarketBuyer",
    //   script: "bun --env-file=.env.production ./src/cron/gmMarketBuyer.ts",
    // },
    {
      name: "transfer_guild_leader",
      script:
        "bun --env-file=.env.production_proxy ./src/cron/transferInactiveGuildLeaders.ts",
    },
  ],
};


// ┌────┬──────────────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
// │ id │ name                             │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
// ├────┼──────────────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
// │ 33 │ alchemy_auto                     │ default     │ N/A     │ fork    │ 2989028  │ 6h     │ 2    │ online    │ 0%       │ 183.5mb  │ root     │ disabled │
// │ 31 │ auto_enhance_aa                  │ default     │ N/A     │ fork    │ 1953878  │ 24h    │ 1    │ online    │ 0%       │ 305.8mb  │ root     │ disabled │
// │ 32 │ auto_enhance_aa                  │ default     │ N/A     │ fork    │ 1954037  │ 24h    │ 1    │ online    │ 0%       │ 306.4mb  │ root     │ disabled │
// │ 17 │ cleanPlayerGlobalState           │ default     │ N/A     │ fork    │ 2363555  │ 10h    │ 2    │ online    │ 0%       │ 188.3mb  │ root     │ disabled │
// │ 27 │ clear_rooms_with_stale_users     │ default     │ N/A     │ fork    │ 1953693  │ 24h    │ 1    │ online    │ 0%       │ 153.8mb  │ root     │ disabled │
// │ 4  │ dispatch_quest                   │ default     │ N/A     │ fork    │ 1953292  │ 24h    │ 1    │ online    │ 0%       │ 164.3mb  │ root     │ disabled │
// │ 6  │ guild_building                   │ default     │ N/A     │ fork    │ 1953335  │ 24h    │ 1    │ online    │ 0%       │ 89.1mb   │ root     │ disabled │
// │ 23 │ kittyDailyCutePoint              │ default     │ N/A     │ fork    │ 1953667  │ 24h    │ 1    │ online    │ 0%       │ 170.5mb  │ root     │ disabled │
// │ 14 │ kittyHomeServiceCenterService    │ default     │ N/A     │ fork    │ 1953551  │ 24h    │ 1    │ online    │ 0%       │ 165.6mb  │ root     │ disabled │
// │ 15 │ kittyMood                        │ default     │ N/A     │ fork    │ 1953576  │ 24h    │ 1    │ online    │ 0%       │ 184.4mb  │ root     │ disabled │
// │ 20 │ kitty_auto_feeder                │ default     │ N/A     │ fork    │ 1953644  │ 24h    │ 1    │ online    │ 0%       │ 159.2mb  │ root     │ disabled │
// │ 11 │ kitty_encounter                  │ default     │ N/A     │ fork    │ 1953461  │ 24h    │ 1    │ online    │ 0%       │ 169.8mb  │ root     │ disabled │
// │ 10 │ kitty_essay                      │ default     │ N/A     │ fork    │ 1953390  │ 24h    │ 1    │ online    │ 0%       │ 257.3mb  │ root     │ disabled │
// │ 8  │ kitty_expedition_a               │ default     │ N/A     │ fork    │ 1953356  │ 24h    │ 1    │ online    │ 0%       │ 143.9mb  │ root     │ disabled │
// │ 9  │ kitty_expedition_a               │ default     │ N/A     │ fork    │ 1953373  │ 24h    │ 1    │ online    │ 0%       │ 142.1mb  │ root     │ disabled │
// │ 12 │ kitty_friend                     │ default     │ N/A     │ fork    │ 1953514  │ 24h    │ 1    │ online    │ 0%       │ 1.7gb    │ root     │ disabled │
// │ 19 │ kitty_furniture_durability       │ default     │ N/A     │ fork    │ 1953618  │ 24h    │ 1    │ online    │ 0%       │ 168.0mb  │ root     │ disabled │
// │ 18 │ kitty_satiety                    │ default     │ N/A     │ fork    │ 1953615  │ 24h    │ 1    │ online    │ 0%       │ 377.1mb  │ root     │ disabled │
// │ 7  │ ranking                          │ default     │ N/A     │ fork    │ 1953579  │ 24h    │ 1    │ online    │ 0%       │ 1.4gb    │ root     │ disabled │
// │ 5  │ tavern                           │ default     │ N/A     │ fork    │ 1953294  │ 24h    │ 1    │ online    │ 0%       │ 128.2mb  │ root     │ disabled │
// │ 22 │ transfer_guild_leader            │ default     │ N/A     │ fork    │ 1953831  │ 24h    │ 1    │ online    │ 0%       │ 94.4mb   │ root     │ disabled │
// │ 34 │ updateFarmPlots                  │ default     │ N/A     │ fork    │ 1953949  │ 24h    │ 1    │ online    │ 0%       │ 169.5mb  │ root     │ disabled │
// │ 13 │ village_building                 │ default     │ N/A     │ fork    │ 1953536  │ 24h    │ 1    │ online    │ 0%       │ 138.1mb  │ root     │ disabled │
// └────┴──────────────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘