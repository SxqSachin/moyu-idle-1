import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import type { AllFishSpeciesID } from '~/shared/data/allFishSpecies';
import type { FishBaitInfo } from '~/shared/types/fishing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置：输入 Excel 路径与输出 JSON 路径
const inputPath = path.resolve(__dirname, '../assets/resource/allFishingBaits.xlsx');
const outputPath = path.resolve(__dirname, '../assets/resource/allFishingBaits.json');

if (!fs.existsSync(inputPath)) {
  console.error('输入文件不存在：', inputPath);
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath);
// 读取第一个 sheet（如果需要按 sheet 名称处理可以修改）
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null });

const result: Record<string, FishBaitInfo> = {};

for (const row of rows) {
  // 假定 Excel 表头包含：code, name, minLength, maxLength, spawnWeight, rarity, seasons, activeHours, drops, extra
  // 其中：seasons 为逗号分隔；activeHours 格式 "6-18"；drops 为 JSON 字符串或多行格式。
  const code = row.id;
  if (!code) continue;

  const hookTimeReductionPercent = Number(row.hookTimeReductionPercent) || 0;
  const biteRateIncreasePercent = Number(row.biteRateIncreasePercent) || 0;
  const preferredSpeciesBoost: { [key in AllFishSpeciesID]?: number } = (() => {
    let str = row.preferredSpeciesBoost as string;
    if (typeof str !== 'string') return {};
    str = str.trim();

    if (!str) return {};
    const obj: { [key in AllFishSpeciesID]?: number } = {};

    const lines = str.split('\n');
    for (const line of lines) {
      const [speciesId, boostStr] = line.split(':').map(s => s.trim());
      const boost = Number(boostStr);
      if (speciesId && Number.isFinite(boost)) {
        obj[speciesId as AllFishSpeciesID] = boost;
      }
    }

    return obj;
  })();


  // baitAreaHookTimeReductionPercent: number
  // baitAreaBiteRateIncreasePercent: number
  // baitAreaPreferredSpeciesBoost: { [key in AllFishSpeciesID]?: number} // 对特定鱼种的加成
  const baitAreaHookTimeReductionPercent = Number(row.baitAreaHookTimeReductionPercent) || 0;
  const baitAreaBiteRateIncreasePercent = Number(row.baitAreaBiteRateIncreasePercent) || 0;
  const baitAreaPreferredSpeciesPercentBoost: { [key in AllFishSpeciesID]?: number } = (() => {
    let str = row.baitAreaPreferredSpeciesPercentBoost as string;
    if (typeof str !== 'string') return {};
    str = str.trim();

    if (!str) return {};
    const obj: { [key in AllFishSpeciesID]?: number } = {};

    const lines = str.split('\n');
    for (const line of lines) {
      const [speciesId, boostStr] = line.split(':').map(s => s.trim());
      const boost = Number(boostStr);
      if (speciesId && Number.isFinite(boost)) {
        obj[speciesId as AllFishSpeciesID] = boost;
      }
    }

    return obj;
  })();

  const baitAreaPreferredSpeciesWeightBoost: { [key in AllFishSpeciesID]?: number } = (() => {
    let str = row.baitAreaPreferredSpeciesWeightBoost as string;
    if (typeof str !== 'string') return {};
    str = str.trim();

    if (!str) return {};
    const obj: { [key in AllFishSpeciesID]?: number } = {};

    const lines = str.split('\n');
    for (const line of lines) {
      const [speciesId, boostStr] = line.split(':').map(s => s.trim());
      const boost = Number(boostStr);
      if (speciesId && Number.isFinite(boost)) {
        obj[speciesId as AllFishSpeciesID] = boost;
      }
    }

    return obj;
  })();



  result[code] = {
    resourceId: code,
    
    hookTimeReductionPercent,
    biteRateIncreasePercent,
    preferredSpeciesBoost,

    baitAreaDurationSec: Number(row.baitAreaDurationSec) || 0,
    baitAreaRadius: Number(row.baitAreaRadius) || 0,

    baitAreaHookTimeReductionPercent,
    baitAreaBiteRateIncreasePercent,
    baitAreaPreferredSpeciesPercentBoost,
    baitAreaPreferredSpeciesWeightBoost,
  };
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
console.log('已导出鱼饵 JSON：', outputPath);
