import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AlchemyOutputSpec, AlchemyRecipe } from '~/shared/types/gameAlchemy';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import type { MinMax } from '~/shared/types';
import type { AllBaseCharacterStatusType } from '~/shared/types/characterInfo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../assets/resource/allAlchemyAction.xlsx');

const alchemyRecipe: Record<string, AlchemyRecipe[]> = {};
let alchemyOutput: string[] = []

const content = fs.readFileSync(filePath);
const workbook = XLSX.read(content);

if (!fs.existsSync(filePath)) {
  throw new Error('Excel文件不存在: ' + filePath);
}

function readFromExcel(index: number) {
  const sheetName = workbook.SheetNames[index];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  rows.forEach((row: any) => {
    const id = row['id'];
    const mainOutputResourceId = row['mainOutputResourceId'];
    if (!id || !mainOutputResourceId) return;

    if (!alchemyRecipe[id]) {
        alchemyRecipe[id] = [];
    }

    let input: ItemCountInfo = {};
    (() => {
      let inputs = row["输入"];
      let inputsLines = inputs
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);
      for (const line of inputsLines) {
          const [id, count] = line.split(":");

          if (!input[id]) {
            input[id] = { count: 0 };
          }
          input[id].count += Number(count);
      }
    })();


    let outputsOnSuccessWhenDay: AlchemyOutputSpec[] = []
    let outputsOnSuccessWhenNight: AlchemyOutputSpec[] = []
    let outputsOnFailWhenDay: AlchemyOutputSpec[] = [];
    let outputsOnFailWhenNight: AlchemyOutputSpec[] = [];

    let mutationPercentWhenDay = Number(row["突变概率（白天）"] ?? 0)
    let mutationPercentWhenNight = Number(row["突变概率（夜晚）"] ?? 0)
    let outputsOnMutationWhenDay: AlchemyOutputSpec[] = [];
    let outputsOnMutationWhenNight: AlchemyOutputSpec[] = [];

    (() => {
        let outputsOnSuccessWhenDayStr = row["成功时输出（白天）"];
        let outputsOnSuccessWhenNightStr = row["成功时输出（夜晚）"];
        let outputsOnFailWhenDayStr = row["失败时输出（白天）"];
        let outputsOnFailWhenNightStr = row["失败时输出（夜晚）"];
        let outputsOnMutationWhenDayStr = row["突变时输出（白天）"];
        let outputsOnMutationWhenNightStr = row["突变时输出（夜晚）"];

        let processToAlchemyOutputSpec = (str: string): AlchemyOutputSpec[] => {
            const res: AlchemyOutputSpec[] = [];

            if (!str) {
                return res
            }

            str.split("\n").forEach((line: string) => {
              const parts = line.split(":");

              let outputResourceId = parts[0];
              let outputPercent = parts[1];
              let rangeStr = parts[2];
              let range: MinMax = { min: 0, max: 0 };

              if (parts.length == 2) {
                outputPercent = '1'
                rangeStr = parts[1]
              }

              if (rangeStr.includes("-")) {
                let rangePart = rangeStr.split("-");
                range.min = Number(rangePart[0]);
                range.max = Number(rangePart[1]);
              } else {
                range.min = Number(rangeStr);
                range.max = Number(rangeStr);
              }

              const output: AlchemyOutputSpec = {
                id: outputResourceId,
                percent: Number(outputPercent),
                range: range,
              };

              res.push(output);
            });

            return res;
        }

        outputsOnSuccessWhenDay = processToAlchemyOutputSpec(outputsOnSuccessWhenDayStr);
        outputsOnSuccessWhenNight = processToAlchemyOutputSpec(outputsOnSuccessWhenNightStr);
        outputsOnFailWhenDay = processToAlchemyOutputSpec(outputsOnFailWhenDayStr);
        outputsOnFailWhenNight = processToAlchemyOutputSpec(outputsOnFailWhenNightStr);
        outputsOnMutationWhenDay = processToAlchemyOutputSpec(outputsOnMutationWhenDayStr);
        outputsOnMutationWhenNight = processToAlchemyOutputSpec(outputsOnMutationWhenNightStr);
    })();

    let minSuccessStatusLevel: {[key in AllBaseCharacterStatusType]?: number} = {};
    (() => {
        let minSuccessStatusLevelStr = row['成功所需等级']
        if (!minSuccessStatusLevelStr) {
          return;
        }
        for (const line of minSuccessStatusLevelStr.split("\n")) {
            let part = line.split(":");
            let status = part[0] as AllBaseCharacterStatusType;
            let level = Number(part[1]);
            minSuccessStatusLevel[status] = level;
        }
    })();

    let expReward: {[key in AllBaseCharacterStatusType]?: number} = {};
    (() => {
        let str = row['经验奖励']
        if (!str) {
            return
        }
        for (const line of str.split("\n")) {
            let part = line.split(":");
            let status = part[0] as AllBaseCharacterStatusType;
            let level = Number(part[1]);
            expReward[status] = level;
        }
    })();


    let recipe: AlchemyRecipe = {
        recipeId: id,
        mainOutputResourceId,
        name: row['名称'],
        description: row['简介'] ?? "",
        icon: row['图标'],

        baseDurationSeconds: Number(row['基础耗时'] ?? 1000 * 30),
        baseSuccessChance: row['基础成功率'] ? Number(row['基础成功率']) : undefined,

        minSuccessStatusLevel,

        inputs: input,

        outputsOnSuccessWhenDay,
        outputsOnSuccessWhenNight,
        outputsOnFailWhenDay,
        outputsOnFailWhenNight,

        mutationPercentWhenDay,
        mutationPercentWhenNight,
        outputsOnMutationWhenDay,
        outputsOnMutationWhenNight,

        expReward,
    }

    if (row['总是显示']=== true) {
      recipe.alwaysReveal = true;
    }

    for(const output of recipe.outputsOnFailWhenDay) {
      alchemyOutput.push(output.id)
    }
    for(const output of recipe.outputsOnFailWhenNight) {
      alchemyOutput.push(output.id)
    }
    for(const output of recipe.outputsOnSuccessWhenDay) {
      alchemyOutput.push(output.id)
    }
    for(const output of recipe.outputsOnSuccessWhenNight) {
      alchemyOutput.push(output.id)
    }
    for(const output of recipe.outputsOnMutationWhenDay) {
      alchemyOutput.push(output.id)
    }
    for(const output of recipe.outputsOnMutationWhenNight) {
      alchemyOutput.push(output.id)
    }

    // console.log(recipe)
    alchemyRecipe[id].push(recipe)
  });
}

for (let i = 0; i < Object.keys(workbook.Sheets).length; i++) {
  readFromExcel(i);
}

const outPath = path.resolve(__dirname, '../assets/resource/allAlchemyRecipes.json');
fs.writeFileSync(outPath, JSON.stringify(alchemyRecipe, null, 2));

const outPath2 = path.resolve(__dirname, '../assets/resource/allAlchemyOutput.json');
alchemyOutput = [...new Set(alchemyOutput)]
fs.writeFileSync(outPath2, JSON.stringify(alchemyOutput, null, 2));

console.log('AlchemyRecipes对象已生成:', outPath, outPath2);