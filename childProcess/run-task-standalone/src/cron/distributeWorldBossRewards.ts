import { prisma } from "../utils/prisma"
import { listWorldBossConfigs, getGlobalBossState, updateGlobalBossStatus, markGlobalBossDispatchedRewards } from "../utils/game/worldBoss";
import type { BossUnitWithDrops } from "~/shared/types/worldBoss";
import { rollWorldBossDropsForPlayerFromConfig } from "~/shared/utils/worldBossRewards";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import { HarvestBoxSource } from "~/generated/prisma";
import { enqueueToHarvestBox } from "../utils/game/harvestBox"
// pushMessageToQueue can be used for async job enqueuing if needed

const WAIT_MS = 5 * 60 * 1000; // 5 minutes

async function distributeWorldBossRewards() {
  const runStart = Date.now();
  let configsScanned = 0;
  let bossesProcessed = 0;
  let groupsProcessed = 0;
  let playersFound = 0;
  let distributedCount = 0;
  let skippedCount = 0;

  try {
    const configs = await listWorldBossConfigs();
    console.log('[distributeWorldBossRewards] found', configs.length, 'configs');
    const now = Date.now();

    for (const cfg of configs) {
      configsScanned++;
      console.log(`[distributeWorldBossRewards] processing boss ${cfg.id}`);
      try {
        let state = await getGlobalBossState(cfg.id);
        if (!state) continue;

        if (state.status == 'battling') {
            if (state.currentHp && state.currentHp > 0) {
                console.log(`[distributeWorldBossRewards] skip boss ${cfg.id} still battling with hp=${state.currentHp}`);
                continue;
            }

            if (state.currentHp === 0) {
                console.log(`[distributeWorldBossRewards] boss ${cfg.id} hp is zero, but status is battling, treating as player_win`);
                state.status = 'player_win';
                await updateGlobalBossStatus(cfg.id, 'player_win');
            }
        }

        // 刷新最新状态
        state = await getGlobalBossState(cfg.id);
        if (!state) {
            console.log(`[distributeWorldBossRewards] skip boss ${cfg.id} no state after update`);
            continue;
        }

        if (state.status !== 'player_win') {
          console.log(`[distributeWorldBossRewards] skip boss ${cfg.id} state=${state.status}`);
          continue;
        }
        if ((now - (state.lastUpdated ?? 0)) < WAIT_MS) {
          console.log(`[distributeWorldBossRewards] skip boss ${cfg.id} waiting for ${Math.round((WAIT_MS - (now - (state.lastUpdated ?? 0)))/1000)}s`);
          continue; // wait 5 minutes
        }

        if (state.dispatchedRewards) {
          console.log(`[distributeWorldBossRewards] skip boss ${cfg.id} rewards already dispatched`);
          continue;
        }

        // find all damage records for this boss
        const damageRows = await prisma.worldBossDamageRecord.findMany({ where: { bossId: cfg.id } });
        const uuidMap: Record<string, typeof damageRows> = {};
        for (const r of damageRows) {
          uuidMap[r.uuid] = uuidMap[r.uuid] || [];
          uuidMap[r.uuid].push(r);
        }

        // Build ranking for groups by totalDamage so we can apply multipliers
        const uuidList = Object.keys(uuidMap);
        const totals = uuidList.map(u => ({
          uuid: u,
          total: uuidMap[u].reduce((s, r) => s + Number((r as any).totalDamage ?? 0), 0),
        }));
        totals.sort((a, b) => b.total - a.total);
        const rankMap: Record<string, number> = {};
        totals.forEach((t, idx) => { rankMap[t.uuid] = idx + 1; });

        for (const uuid of uuidList) {
          groupsProcessed++;
          const rows = uuidMap[uuid];
          const rank = rankMap[uuid] ?? 0;
          // decide multiplier: top50 -> 1.5, top100 -> 1, else 0 (no extra)
          let extraMultiplier = 0;
          if (rank > 0 && rank <= 50) extraMultiplier = 2;
          else if (rank > 0 && rank <= 100) extraMultiplier = 1.5;
          // else extraMultiplier = 1.2;

          // extraMultiplier = 0; // disable for now

          console.log(`[distributeWorldBossRewards] processing group uuid=${uuid} rows=${rows.length} rank=${rank} multiplier=${extraMultiplier}`);

          // get unique player list across rooms
          const playerSet = new Set<string>();
          for (const r of rows) {
            const players: string[] = JSON.parse(r.playerUuids || '[]');
            players.filter(Boolean).forEach(p => playerSet.add(p));
          }
          const players = Array.from(playerSet);
          if (!players.length) {
            console.log(`[distributeWorldBossRewards] group ${uuid} has no players, skip`);
            continue;
          }

          // Per-player independent drop rolls via shared utility
          for (const p of players) {
            playersFound++;
            // build allocation using the unified method
            const playerAlloc: ItemCountInfo = rollWorldBossDropsForPlayerFromConfig(cfg, false, extraMultiplier);

            try {
              const res = await prisma.$transaction(async (tx) => {
                const existsForPlayer = await tx.worldBossRewardDistribution.findUnique({
                    where: { uuid_player_unique: { uuid, playerUuid: p } },
                  });
                if (existsForPlayer) {
                  return { created: false, reason: 'exists' };
                }

                await tx.worldBossRewardDistribution.create({
                  data: {
                    uuid,
                    bossId: cfg.id,
                    processed: true,
                    // roomId:
                    playerUuid: p,
                    rewards: JSON.stringify(playerAlloc),
                  },
                });

                await enqueueToHarvestBox(p, playerAlloc, {
                  title: `“大麻烦”击退奖励（排名 ${rank}）`,
                  source: HarvestBoxSource.Event,
                }, tx);

                return { created: true };
              });

              if (!res.created) {
                skippedCount++;
                console.log(`[distributeWorldBossRewards] skipped player ${p} (boss=${cfg.id} uuid=${uuid}): already exists`);
              } else {
                distributedCount++;
                console.log(`[distributeWorldBossRewards] distributed to player ${p} (boss=${cfg.id} uuid=${uuid}) rewards=${JSON.stringify(playerAlloc)}`);
              }
            } catch (err) {
              console.error(`[distributeWorldBossRewards] error distributing to player ${p} boss=${cfg.id} uuid=${uuid}:`, (err as any)?.message ?? err);
            }
          }
        }

        await markGlobalBossDispatchedRewards(cfg.id, true);
        bossesProcessed++;
      } catch (err) {
        console.error('[distributeWorldBossRewards] processing boss', cfg.id, (err as any)?.message ?? err);
      }
    }
    const elapsed = Date.now() - runStart;
    console.log('[distributeWorldBossRewards] run finished', { configsScanned, bossesProcessed, groupsProcessed, playersFound, distributedCount, skippedCount, elapsedMs: elapsed });
  } catch (err) {
    console.error('[distributeWorldBossRewards] scan error', (err as any)?.message ?? err);
  }
}

const INTERVAL = 1 * 60 * 1000; // 5 minutes

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function run() {
  try {
    await distributeWorldBossRewards();
  } catch (err) {
    console.error('[distributeWorldBossRewards] run error', (err as any)?.message ?? err);
  }
}

async function mainLoop() {
  console.log('[WorldBossRewards] service started');
  // run immediately once
  await run();

  while (running) {
    await new Promise(res => setTimeout(res, INTERVAL));
    if (!running) break;
    await run();
  }

  console.log('[WorldBossRewards] service stopped');
}

await mainLoop();
process.exit(0);
