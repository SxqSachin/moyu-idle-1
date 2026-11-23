import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../assets/resource/allGameResource.xlsx');
const outputPath = path.resolve(__dirname, '../assets/resource/allGameResource.json');

const enhanceInfoOutputPath = path.resolve(__dirname, '../assets/resource/enhanceInfo.json');

const workbook = XLSX.readFile(inputPath);

const result = {};
const enhanceInfo = {}

const readFromSheet = index => {
  const sheetName = workbook.SheetNames[index];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  for (const row of rows) {
    // 以 id 作为主键
    const id = row.id || row.ID || row.Id;
    if (!id) continue;

    const obj = {};
    for (const key in row) {
      let value = row[key];
      // 尝试还原为对象/数组
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value);
        } catch {
          value = undefined
        }
      }
      if (typeof value == 'string' && !value) {
        value = undefined
      }

      // 删掉强化相关的key
      if (key.startsWith('enhance') || key.startsWith('Enhance')) {
        continue;
      }

      if (key == 'alchemyTag' && value) {
        value = value.split(',').map(str => str.trim()).filter(v => !!v);
      }

      if (key == 'equipmentType' && value) {
        value = value.split(',').map(str => str.trim()).filter(v => !!v);
      }

      obj[key] = value;
    }

    if (row.enhanceSuccessTo) {
      enhanceInfo[id] = {
        enhanceSuccessTo: row.enhanceSuccessTo,
        enhanceRequireResource: row.enhanceRequireResource ? row.enhanceRequireResource.split('\n').map(str => {
          let part = str.split(':');
          return {
            resourceId: part[0].trim(),
            count: part[1] ? Number(part[1].trim()) : 1
          }
        }) : [],
        enhanceFailToWithProtected: row.enhanceFailToWithProtected,
        enhanceFailToWithUnprotected: row.enhanceFailToWithUnprotected,
        enhanceBasePercent: row.enhanceBasePercent ? Number(row.enhanceBasePercent) : undefined,
        enhanceProtecteResourceIds: (row.enhanceProtecteResourceIds || '').split('\n'),
        rewardEnhanceExp: row.rewardEnhanceExp ?? 1
      }
    }

    if (row.conflictWithOtherResources) {
      obj.conflictWithOtherResources = row.conflictWithOtherResources.split(',').map(str => str.trim()).filter(v => !!v);
    }

    result[id] = obj;
  }
}

for(let i = 0; i < Object.keys(workbook.Sheets).length; i++) {
  readFromSheet(i);
}

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

fs.writeFileSync(enhanceInfoOutputPath, JSON.stringify(enhanceInfo, null, 2), 'utf-8');

console.log('已从 Excel 还原为 JSON:', outputPath);