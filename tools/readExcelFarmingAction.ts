import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  CropDefinition,
  FertilizerDefinition,
  FertilizerEffect,
  WeightedYield,
} from '~/shared/types/farming';

// Parse farmingAction.xlsx into allFarmingDefinitions.json
// Sheet 1 (index 0): Crops
// Sheet 2 (index 1): Fertilizers

type ResourceEntry = { id: string; count: number };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, '../assets/resource/farmingAction.xlsx');
const outPath = path.resolve(__dirname, '../assets/resource/allFarmingDefinitions.json');

if (!fs.existsSync(srcPath)) {
  throw new Error('Excel文件不存在: ' + srcPath);
}

const workbook = XLSX.readFile(srcPath);

// Helpers
function parseResourceList(value: unknown): ResourceEntry[] {
  if (!value && value !== 0) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((e: any) => ({ id: String(e.id), count: Number(e.count ?? 1) }))
            .filter(e => !!e.id);
        }
      } catch {}
    }
  }
  return String(value)
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id, count] = pair.split(':');
      return { id: (id ?? '').trim(), count: Number(count ?? 1) };
    })
    .filter(e => !!e.id);
}

function parseWeightedYields(value: unknown): WeightedYield[] {
  // Accept JSON array or pipe with optional percent and range
  // Pipe examples:
  //  - wheat:3:50%
  //  - rare_wheat:1-2:5%
  if (!value && value !== 0) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed as WeightedYield[];
      } catch {}
    }
  }
  return String(value)
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map((token) => {
      // id:countOrRange[:percent%]
      const parts = token.split(':').map(p => p.trim());
      const id = parts[0];
      const countOrRange = parts[1];
      const percentToken = parts[2];
      let percent: number | undefined = undefined;
      if (percentToken) {
        const p = percentToken.replace('%', '');
        const n = Number(p);
        if (Number.isFinite(n)) percent = n / 100;
      }
      if (countOrRange && countOrRange.includes('-')) {
        const [min, max] = countOrRange.split('-').map(Number);
        return { id, range: { min, max }, percent } as WeightedYield;
      }
      return { id, count: Number(countOrRange ?? 1), percent } as WeightedYield;
    });
}

function parseBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '是' || s === '1' || s === 'yes' || s === 'y';
}

function parseNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseEffects(value: unknown): FertilizerEffect[] {
  // Accept JSON or pipe syntax
  // JSON example: [{"type":"shortenDuration","percent":0.1},{"type":"adjustMutationChance","percentPoint":0.05}]
  // Pipe examples:
  //  - shortenDuration:percent=0.1
  //  - adjustMutationChance:percentPoint=0.05
  //  - adjustYieldProbability:scope=mutation;percentPoint=0.05
  if (!value && value !== 0) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed) as FertilizerEffect[]; } catch {}
    }
  }
  // pipe with ; separated key=val
  return String(value)
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map((token) => {
      const [type, kvs] = token.split(':');
      const effect: any = { type };
      if (kvs) {
        kvs.split(';').forEach(pair => {
          const [k, raw] = pair.split('=');
          const key = k?.trim();
          const v = raw?.trim();
          if (!key) return;
          if (key === 'percent' || key === 'percentPoint' || key === 'multiply') {
            const n = Number(v);
            if (Number.isFinite(n)) effect[key] = n;
          } else if (key === 'scope' || key === 'selector' || key === 'id') {
            effect[key] = v;
          }
        });
      }
      return effect as FertilizerEffect;
    });
}

// Read sheet 0: Crops
const crops: CropDefinition[] = [];
if (workbook.SheetNames.length > 0) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

  const hasExpanded = rows.some(r => {
    const t = (r.rowType ?? r.type ?? '').toString().toUpperCase();
    return t === 'BASE' || t === 'YIELD' || t === 'MUTATION' || t === 'MUTATION_YIELD' || t === 'COST';
  });

  if (!hasExpanded) {
    // Compact mode (single row per seed)
    rows.forEach(row => {
      const seedId = row.seedId || row.seed || row.SEED || row.id;
      if (!seedId) return;
      const rawFerts = row.fertilizerIds ?? row.fertilizerId ?? row.fertilizer;
      const fertArr = typeof rawFerts === 'string'
        ? rawFerts.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(rawFerts) ? rawFerts : (rawFerts ? [String(rawFerts)] : []));
      const def: CropDefinition = {
        seedId,
        name: row.name || row.Name || undefined,
        plantCost: parseResourceList(row.plantCost ?? row.cost ?? row.consume),
        yields: parseWeightedYields(row.yields ?? row.baseYield ?? row.yield ?? row.output),
        mutationYields: parseWeightedYields(row.mutationYields ?? row.rareYields ?? row.mutationOutputs),
        baseGrowthSeconds: parseNumber(row.baseGrowthSeconds ?? row.growthSeconds ?? row.duration),
        baseMutationChance: parseNumber(row.baseMutationChance ?? row.mutationChance),
        fertilizable: parseBoolean(row.fertilizable ?? true),
        fertilizerIds: fertArr.length ? fertArr : undefined,
      };
      crops.push(def);
    });
  } else {
    // Expanded mode: multiple rows per seed with rowType
    const map: Record<string, CropDefinition> = {};

    function getCrop(seedId: string): CropDefinition {
      if (!map[seedId]) {
        map[seedId] = { seedId, yields: [], mutationYields: [] } as CropDefinition;
      }
      return map[seedId];
    }

    function parsePercent(v: any): number | undefined {
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v === 'string' && v.includes('%')) {
        const n = Number(v.replace('%', ''));
        return Number.isFinite(n) ? n / 100 : undefined;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }

    rows.forEach(row => {
      const seedId = row.seedId || row.seed || row.SEED || row.id;
      if (!seedId) return;
      const kind = (row.rowType ?? row.type ?? '').toString().toUpperCase();
      const crop = getCrop(String(seedId));

      if (kind === 'BASE' || !kind) {
        crop.name = row.name || row.Name || crop.name;
        crop.fertilizable = parseBoolean(row.fertilizable ?? (crop.fertilizable ?? true));
        const rawFerts = row.fertilizerIds ?? row.fertilizerId ?? row.fertilizer;
        if (rawFerts !== undefined) {
          const fertArr = typeof rawFerts === 'string'
            ? rawFerts.split(',').map((s: string) => s.trim()).filter(Boolean)
            : (Array.isArray(rawFerts) ? rawFerts : (rawFerts ? [String(rawFerts)] : []));
          (crop as any).fertilizerIds = fertArr.length ? fertArr : undefined;
        }
        crop.baseGrowthSeconds = parseNumber(row.baseGrowthSeconds ?? row.growthSeconds ?? row.duration) ?? crop.baseGrowthSeconds;
        crop.baseMutationChance = parseNumber(row.baseMutationChance ?? row.mutationChance) ?? crop.baseMutationChance;
        crop.farmingPlantLevelRequired = parseNumber(row.farmingPlantLevelRequired ?? row.levelRequired ?? row.level) ?? crop.farmingPlantLevelRequired;
        crop.farmingPlantExpGainWhenHarvest = parseNumber(row.farmingPlantExpGainWhenHarvest) ?? crop.farmingPlantExpGainWhenHarvest;
      } else if (kind === 'YIELD') {
        const id = row.yieldId || row.resourceId || row.id2 || row.outputId;
        if (!id) return;
        const min = parseNumber(row.min) ?? parseNumber(row.rangeMin);
        const max = parseNumber(row.max) ?? parseNumber(row.rangeMax);
        const count = parseNumber(row.count);
        const percent = parsePercent(row.percent ?? row.prob ?? row.chance);
        if (min !== undefined && max !== undefined) {
          crop.yields = crop.yields || [];
          (crop.yields as any).push({ id: String(id), range: { min, max }, percent });
        } else {
          crop.yields = crop.yields || [];
          (crop.yields as any).push({ id: String(id), count: Number(count ?? 1), percent });
        }
      } else if (kind === 'MUTATION' || kind === 'MUTATION_YIELD') {
        const id = row.yieldId || row.resourceId || row.id2 || row.outputId;
        if (!id) return;
        const min = parseNumber(row.min) ?? parseNumber(row.rangeMin);
        const max = parseNumber(row.max) ?? parseNumber(row.rangeMax);
        const count = parseNumber(row.count);
        const percent = parsePercent(row.percent ?? row.prob ?? row.chance);
        crop.mutationYields = crop.mutationYields || [];
        if (min !== undefined && max !== undefined) {
          (crop.mutationYields as any).push({ id: String(id), range: { min, max }, percent });
        } else {
          (crop.mutationYields as any).push({ id: String(id), count: Number(count ?? 1), percent });
        }
      } else if (kind === 'COST') {
        const id = row.resourceId || row.costId || row.inputId;
        const count = parseNumber(row.count);
        if (!id || !count) return;
        crop.plantCost = crop.plantCost || [];
        (crop.plantCost as any).push({ id: String(id), count: Number(count) });
      }
    });

    Object.values(map).forEach(def => crops.push(def));
  }
}

// Read sheet 1: Fertilizers
const fertilizers: FertilizerDefinition[] = [];
if (workbook.SheetNames.length > 1) {
  const sheet = workbook.Sheets[workbook.SheetNames[1]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

  const hasExpanded = rows.some(r => {
    const t = (r.rowType ?? r.type ?? '').toString().toUpperCase();
    return t === 'BASE' || t === 'EFFECT' || t === 'COST';
  });

  if (!hasExpanded) {
    rows.forEach(row => {
      const id = row.id || row.fertilizerId || row.FERTILIZER || row.Fertilizer;
      if (!id) return;
      const def: FertilizerDefinition = {
        id,
        name: row.name || row.Name || undefined,
        cost: parseResourceList(row.cost ?? row.consume ?? row.plantCost),
        maxStacks: parseNumber(row.maxStacks),
        effects: parseEffects(row.effects ?? row.Effects ?? row.effect),
      };
      fertilizers.push(def);
    });
  } else {
    const map: Record<string, FertilizerDefinition> = {};

    function getFert(id: string): FertilizerDefinition {
      if (!map[id]) map[id] = { id, effects: [] } as FertilizerDefinition;
      return map[id];
    }

    rows.forEach(row => {
      const id = row.id || row.fertilizerId || row.FERTILIZER || row.Fertilizer;
      if (!id) return;
      const fert = getFert(String(id));
      const kind = (row.rowType ?? row.type ?? '').toString().toUpperCase();

      if (kind === 'BASE' || !kind) {
        fert.name = row.name || row.Name || fert.name;
        fert.maxStacks = parseNumber(row.maxStacks) ?? fert.maxStacks;
      } else if (kind === 'COST') {
        const rid = row.resourceId || row.costId;
        const count = parseNumber(row.count);
        if (!rid || !count) return;
        fert.cost = fert.cost || [];
        (fert.cost as any).push({ id: String(rid), count: Number(count) });
      } else if (kind === 'EFFECT') {
        // Columns: effectType, seconds, percent, flat, percentPoint, multiply, scope, selector, targetId
        const effectType = (row.effectType || row.type2 || row.effect)?.toString();
        if (!effectType) return;
        const e: any = { type: effectType };
        const setIfNum = (k: string, v: any) => { const n = Number(v); if (Number.isFinite(n)) e[k] = n; };
        const setIfStr = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') e[k] = String(v); };
        setIfNum('seconds', row.seconds);
        setIfNum('percent', row.percent);
        setIfNum('flat', row.flat);
        setIfNum('percentPoint', row.percentPoint);
        setIfNum('multiply', row.multiply);
        setIfStr('scope', row.scope);
        setIfStr('selector', row.selector);
        setIfStr('id', row.targetId || row.id2);
        fert.effects!.push(e as FertilizerEffect);
      }
    });

    Object.values(map).forEach(def => fertilizers.push(def));
  }
}

const output = { crops, fertilizers };
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log('已生成:', outPath);
