import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../assets/resource/allGameAction.xlsx');

const gameActions = {};
const actionTypes = {}
const allActionId = []

const content = fs.readFileSync(filePath);
const workbook = XLSX.read(content);

if (!fs.existsSync(filePath)) {
  throw new Error('Excel文件不存在: ' + filePath);
}

function readFromExcel(index) {
  const sheetName = workbook.SheetNames[index];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  rows.forEach(row => {
    const id = row['id'];
    if (!id) return;

    if (!actionTypes[row['actionType']]) {
      actionTypes[row['actionType']] = [];
    }

    gameActions[id] = {
      id,
      name: row['name'],
      icon: row['icon'],
      banToKitty: row['banToKitty'],
      description: row['description'],
      baseDuration: Number(row['baseDuration']),
      hidden: row['hidden'] === 'true' || row['hidden'] === true,
      ignoreDismantle: row['ignoreDismantle'] === 'true' || row['ignoreDismantle'] === true,
      requirement: {
        building: row['requirement_building']
          ? row['requirement_building'].split('|').map(b => {
            const [id, minLevel] = b.split(':');
            return { id, minLevel: Number(minLevel) };
          }) : undefined,
        resource: row['requirement_resource']
          ? row['requirement_resource'].split('|').map(r => {
            const [id, count] = r.split(':');
            return { id, count: Number(count) };
          }) : undefined,
        characterStatus: row['requirement_characterStatus']
          ? row['requirement_characterStatus'].split('|').map(c => {
            const [status, min] = c.split(':');
            return { status, min: Number(min) };
          }) : undefined,
      },
      rewards: row['rewards']
        ? row['rewards'].replace(/\{/g, '').replace(/\}/g, '').split('|').map(r => {
          const [id, percent, countOrRange] = r.split(':');
          if (countOrRange && countOrRange.includes('-')) {
            const [min, max] = countOrRange.split('-');
            return { id, percent: Number(percent), range: { min: Number(min), max: Number(max) } };
          }
          return { id, percent: Number(percent), count: Number(countOrRange) };
        }) : [],
      characterImprove: row['characterImprove']
        ? row['characterImprove'].split('|').map(c => {
          const [status, increaseExp] = c.split(':');
          return { status, increaseExp: Number(increaseExp) };
        }) : [],
      secondaryClassification: row['secondaryClassification'] || undefined,
    };

    if (!gameActions[id].hidden) {
      actionTypes[row['actionType']].push(id);
    }
    allActionId.push(id);
  });
}

for (let i = 0; i < Object.keys(workbook.Sheets).length; i++) {
  readFromExcel(i);
}

const outPath = path.resolve(__dirname, '../assets/resource/allGameActions.json');
fs.writeFileSync(outPath, JSON.stringify(gameActions, null, 2));

const mainTypeOutPath = path.resolve(__dirname, '../assets/resource/allGameActionsMainType.json');
fs.writeFileSync(mainTypeOutPath, JSON.stringify(actionTypes, null, 2));

const idListOutPath = path.resolve(__dirname, '../assets/resource/allGameActionIdList.json');
fs.writeFileSync(idListOutPath, JSON.stringify(allActionId, null, 2));

console.log('GameActions对象已生成:', outPath);