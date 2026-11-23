#!/usr/bin/env node
// Usage: node test/generate-enemies-for-area.js <areaId> <waveNumber> [memberCount]
// Example: node test/generate-enemies-for-area.js cat_dungeon_002 30 3

const areaId = process.argv[2];
const waveNumber = parseInt(process.argv[3] || '1', 10);
const memberCount = parseInt(process.argv[4] || '1', 10);

if (!areaId) {
  console.error('Please provide areaId and waveNumber');
  process.exit(1);
}

if (areaId !== 'cat_dungeon_002') {
  console.error('Only cat_dungeon_002 is supported by this simple script.');
  process.exit(2);
}

// Embedded minimal areaData for cat_dungeon_002 (extracted from shared/data/allBattleInfo.ts)
const areaData = {
  id: 'cat_dungeon_002',
  enemyPool: [
    { id: 'cd_br1', weight: 16 },
    { id: 'cd_wd1', weight: 15 },
    { id: 'cd_ma1', weight: 16 },
    { id: 'cd_ec1', weight: 12 },
    { id: 'cd_rg1', weight: 15 },
    { id: 'cd_sw1', weight: 12 },
    { id: 'cd_nb1', weight: 13 },
    { id: 'cd_ha1', weight: 12 },
    { id: 'cd_mk1', weight: 11 },
    { id: 'cd_vc1', weight: 10 },
  ],
  specialBattles: [
    {
      every: 30,
      maxBossNum: 5,
      enemies: [
        { id: 'cd_hb', weight: 100 },
        { id: 'cd_oc', weight: 100, maxCountPerWave: 1 },
      ],
    },
    {
      every: 15,
      maxBossNum: 5,
      enemies: [ { id: 'cd_qn', weight: 100 }, { id: 'cd_kg', weight: 100 } ],
    },
    {
      every: 7,
      maxBossNum: 1,
      enemies: [ { id: 'cd_oc', weight: 100 } ],
    }
  ],
  minEnemies: 10,
  maxEnemies: 14,
};

function weightedRandomPick(pool, count) {
  const result = [];
  const remaining = new Map();
  for (const e of pool) {
    remaining.set(e.id, e.maxCountPerWave !== undefined ? Math.max(0, Math.floor(e.maxCountPerWave)) : Number.POSITIVE_INFINITY);
  }
  for (let i = 0; i < count; i++) {
    const available = pool.filter(e => (remaining.get(e.id) ?? 0) > 0 && e.weight > 0);
    if (available.length === 0) break;
    const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight <= 0) break;
    let r = Math.random() * totalWeight;
    let picked = available[available.length - 1];
    for (const entry of available) {
      if (r < entry.weight) {
        picked = entry;
        break;
      }
      r -= entry.weight;
    }
    result.push(picked.id);
    const prev = remaining.get(picked.id) ?? Number.POSITIVE_INFINITY;
    if (prev !== Number.POSITIVE_INFINITY) remaining.set(picked.id, prev - 1);
  }
  return result;
}

function generateBattleEnemyIdsMock(battleRoom, extraEnemyCount = 0) {
  const playerCount = battleRoom.memberIds.length;
  let minEnemies = areaData.minEnemies ?? 1;
  let maxEnemies = areaData.maxEnemies ?? 3;
  if (battleRoom.denseFogMode) {
    minEnemies = 8;
    maxEnemies = Math.max(maxEnemies, 8);
  }
  let extraEnemies = 0;
  for (let i = 0; i < playerCount; i++) extraEnemies += Math.round(Math.random());
  extraEnemies += extraEnemyCount;
  let enemyCount = Math.floor(Math.random() * (maxEnemies - minEnemies + 1)) + minEnemies + extraEnemies;
  if (enemyCount > 2) enemyCount -= 1;
  const maxAllowedEnemies = maxEnemies * 2;
  enemyCount = Math.min(enemyCount, maxAllowedEnemies);

  let specialEnemies;
  let maxBossNum = 0;
  if (areaData.specialBattles) {
    for (const special of areaData.specialBattles) {
      if ((battleRoom.currentRepeat + 1) % special.every === 0) {
        specialEnemies = special.enemies;
        maxBossNum = special.maxBossNum ?? special.enemies.length;
        break;
      }
    }
  }

  let enemyIds = [];
  if (specialEnemies && specialEnemies.length > 0 && maxBossNum > 0) {
    let minBossCount = 1;
    let bossCount = Math.min(Math.max(minBossCount, Math.floor(Math.random() * maxBossNum) + 1), enemyCount);
    const bossIds = weightedRandomPick(specialEnemies, bossCount);
    const actualBossCount = bossIds.length;
    const adjustedNormalCount = Math.max(0, enemyCount - actualBossCount);
    const normalIds = adjustedNormalCount > 0 ? weightedRandomPick(areaData.enemyPool, adjustedNormalCount) : [];
    enemyIds = [...bossIds, ...normalIds];
  } else {
    enemyIds = weightedRandomPick(areaData.enemyPool, enemyCount);
  }
  return enemyIds;
}

const battleRoom = { area: areaId, memberIds: Array.from({length: Math.max(1, memberCount)}, (_,i)=>`p${i+1}`), denseFogMode: false, currentRepeat: waveNumber-1 };

const ids = generateBattleEnemyIdsMock(battleRoom, 0);
console.log('area:', areaId, 'wave:', waveNumber, 'members:', memberCount, '=> generated:', ids.length, 'ids:');
console.log(ids.join(','));
