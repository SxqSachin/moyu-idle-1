import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置：输入 Excel 路径与输出 JSON 路径
const inputPath = path.resolve(__dirname, '../assets/resource/allFishSpecies.xlsx');
const outputPath = path.resolve(__dirname, '../assets/resource/allFishSpecies.json');

if (!fs.existsSync(inputPath)) {
  console.error('输入文件不存在：', inputPath);
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath);
// 读取第一个 sheet（如果需要按 sheet 名称处理可以修改）
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

const result = {};

for (const row of rows) {
  // 假定 Excel 表头包含：code, name, minLength, maxLength, spawnWeight, rarity, seasons, activeHours, drops, extra
  // 其中：seasons 为逗号分隔；activeHours 格式 "6-18"；drops 为 JSON 字符串或多行格式。
  const code = row.id;
  if (!code) continue;

  const name = row.name;
  const description = row.description;
  const icon = row.icon;


  const minLength = Number(row.minLength ?? row.min_length ?? row.min) || 0;
  const maxLength = Number(row.maxLength ?? row.max_length ?? row.max) || 0;
  const minWeight = row.minWeight ?? row.min_weight ?? row.weight ?? 0;
  const maxWeight = row.maxWeight ?? row.max_weight ?? row.weight ?? 100;

  const rarity = row.rarity ?? 1;

  const qualityWeight = (() => {
    const qualityWeightStr = row.qualityWeight || row.quality_weight || null;
    if (!qualityWeightStr) return [];

    const res = qualityWeightStr.split(',').map(s => +s.trim()).filter(Boolean);

    return res;
  })();

  const neededStatus = (() => {
    const neededStatusStr = row.neededStatus || row.needed_status || null;
    if (!neededStatusStr) return [];

    const res = [];
    for(const neededStatusPart of neededStatusStr.split('\n').map(s => s.trim()).filter(Boolean)) {
        const [status, valueStr] = neededStatusPart.split(':').map(s => s.trim());

        if (status && valueStr) {
            const value = Number(valueStr);
            if (!Number.isNaN(value)) {
                res.push({ status, min: value });
            }
        }
    }

    return res;
  })()

  const neededConfiguration = (() => {
    const neededConfigStr = row.neededConfiguration || row.needed_configuration || null;
    if (!neededConfigStr) return {};
    
    const res = {}; 
    for(const neededConfigPart of neededConfigStr.split('\n').map(s => s.trim()).filter(Boolean)) {
        const [configKey, valueStr] = neededConfigPart.split(':').map(s => s.trim());

        if (configKey && valueStr) {
            const valueLower = valueStr.toLowerCase();
            let value = false;
            if (valueLower === 'true' || valueLower === 'yes' || valueLower === '1') {
                value = true;
            }
            res[configKey] = value;
        }
    }

    return res;
  })();

  const neededBait = (() => {
    const neededBaitStr = row.neededBait || row.needed_bait || null;
    if (!neededBaitStr) return [];
    
    return neededBaitStr.split('\n').map(s => s.trim()).filter(Boolean);
  })();

  const activeHoursRaw = row.activeHours ?? row.active_hours ?? row.time ?? '';
  let activeHours = undefined;
  if (typeof activeHoursRaw === 'string' && activeHoursRaw.trim()) {
    const raw = activeHoursRaw.trim();
    // 支持格式："HH:mm-HH:mm" 或 "H-H"（小时）或 "H:MM-HH:MM"，并规范化为 "HH:MM"
    if (raw.includes('-')) {
      const parts = raw.split('-').map(p => p.trim()).filter(Boolean);
      const toHHMM = s => {
        if (!s) return '00:00';
        if (s.includes(':')) {
          const [h, m] = s.split(':').map(x => x.trim());
          const hh = String(Number(h)).padStart(2, '0');
          const mm = String(Number(m || 0)).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        const n = Number(s);
        if (Number.isNaN(n)) return '00:00';
        const hh = String(Math.floor(n)).padStart(2, '0');
        return `${hh}:00`;
      }
      activeHours = { start: toHHMM(parts[0]), end: toHHMM(parts[1] || '') };
    }
  }


  // shopBaseRecallPrice: number // 基础回收价
  // extraPriceForEachLength: number
  // extraPriceForEachWeight: number
  // extraPriceForEachQuality: number
  let shopBaseRecallPrice = Number(row.shopBaseRecallPrice ?? row.shop_base_recall_price ?? 0) || 0;
  let extraPriceForEachLength = Number(row.extraPriceForEachLength ?? row.extra_price_for_each_length ?? 0) || 0;
  let extraPriceForEachWeight = Number(row.extraPriceForEachWeight ?? row.extra_price_for_each_weight ?? 0) || 0;
  let extraPriceForEachQuality = Number(row.extraPriceForEachQuality ?? row.extra_price_for_each_quality ?? 0) || 0;

  shopBaseRecallPrice = +shopBaseRecallPrice.toFixed(0)
  extraPriceForEachLength = +extraPriceForEachLength.toFixed(0)
  extraPriceForEachWeight = +extraPriceForEachWeight.toFixed(0)
  extraPriceForEachQuality = +extraPriceForEachQuality.toFixed(0)

  const percent = Number(row.percent ?? 0);
  const disabled = Boolean(row.disabled ?? false);
  const asResource = Boolean(row.asResource ?? false);

  const resourcePool = (() => {
    const resourcelPoolStr = row.resourcePool || row.resource_pool || null;
    if (!resourcelPoolStr) return {};

    const res = {};
    for(const resourcePart of resourcelPoolStr.split('\n').map(s => s.trim()).filter(Boolean)) {
        const [resourceCode, weight] = resourcePart.split(':').map(s => s.trim());

        if (resourceCode && weight) {
            const percent = Number(weight);
            if (!Number.isNaN(percent)) {
                res[resourceCode] = percent;
            }
        }
    }

    return res;
  })();

  const exp = Number(row.exp ?? 0) || 0;

  result[code] = {
    id: code,
    name,
    icon,
    description,

    percent,
    rarity: Number(rarity),
    qualityWeight: qualityWeight,

    minLength,
    maxLength,
    minWeight,
    maxWeight,

    neededStatus,
    neededConfiguration,
    neededBait,

    activeHours,

    shopBaseRecallPrice,
    extraPriceForEachLength,
    extraPriceForEachWeight,
    extraPriceForEachQuality,

    disabled,
    asResource,

    resourcePool,

    exp
  };
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
console.log('已导出鱼类 JSON：', outputPath);
