import xlsx from "xlsx";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

// 读取 Excel 文件

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const srcPath = path.resolve(__dirname, "../assets/resource/allGameEnemies.xlsx");
const dtsPath = path.resolve(__dirname, "../assets/resource/allGameEnemies.json");

const wb = xlsx.readFile(srcPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

// 取表头
const header = rows[0];
const dataRows = rows.slice(1);

const allGameEnemies = {};

for (const row of dataRows) {
  if (!row[0]) continue; // 跳过空行
  const [
    id, name, level, hp, maxHp, mp, maxMp, attack, defense, 
    description,
    dropsStr, skillsStr, aiStr, stateStr, equipmentStr, statusStr,
    expReward, keepWhenNewTurn, isBoss, ignoreTurn
  ] = row;

  // 解析掉落
  const drops = (dropsStr || "").split('\n').filter(Boolean).map(line => {
    // gold:100.00%:10-30
    const [id, percent, range] = line.split(":");
    const [min, max] = (range || "").split("-");
    return {
      id,
      percent: parseFloat(percent) / 100,
      range: {
        min: min ? Number(min) : undefined,
        max: max ? Number(max) : undefined,
      }
    };
  });

  // 解析技能
  const skills = {};
  (skillsStr || "").split('\n').filter(Boolean).forEach(line => {
    // 例如 baseAttack:Lv1
    const [key, lv] = line.split(":Lv");
    skills[key] = lv ? { level: Number(lv) } : {};
  });

  // 解析AI
  let ai = {};
  if (aiStr && aiStr.trim()) {
    try {
      ai = JSON.parse(aiStr);
    } catch {
      ai = {};
    }
  }

  // 解析状态
  let status = {};
  (statusStr || "").split('\n').filter(Boolean).forEach(line => {
    const [k, v] = line.split(":");
    status[k] = { level: Number(v) };
  });
  status.attacking = { level: attack };
  status.defencing = { level: defense };

  let state = {};
  (stateStr || "").split('\n').filter(Boolean).forEach(line => {
    let [id, duration] = line.split(":");

    duration = Number(duration?.trim()) ?? 1;

    state[id] = {
      id,
      duration: duration,
      remainingDuration: duration,
    };
  });

  let equipment = {};
  (equipmentStr|| "").split('\n').filter(Boolean).forEach(line => {
    let [part, equipmentId] = line.split(":");

    equipment[part] = equipmentId;
  });

  allGameEnemies[id] = {
    id,
    name,
    level: Number(level),
    hp: Number(hp),
    attack: Number(attack),
    defense: Number(defense),
    description,
    drops,
    skills,
    ai,
    state,
    status,
    baseStatus: status,
    tmpShield: 0,
    isPlayer: false,
    expReward: Number(expReward),
    maxHp: Number(maxHp),
    maxMp: Number(maxMp),
    mp: Number(mp),
    keepWhenNewTurn: keepWhenNewTurn,
    isBoss: isBoss == "是" || isBoss == "true" || isBoss == true,
    ignoreTurn: !!ignoreTurn
  };

  if (Object.keys(equipment).length) {
    allGameEnemies[id].equipment = equipment;
  }
}

// 导出为 JSON 文件
fs.writeFileSync(dtsPath, JSON.stringify(allGameEnemies, null, 2), "utf-8");
console.log("已还原为 allGameEnemies.json");