import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, "../assets/resource/newSponsorList.xlsx");
const outPath = path.resolve(__dirname, "../assets/resource/sponsorList.json");

const wb = xlsx.readFile(srcPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

// 取表头和数据行
const header = rows[0];
const dataRows = rows.slice(1);

const sponsorMap = {};

for (const row of dataRows) {
  const [date, id, amount] = row;
  if (!id || !amount) continue;
  sponsorMap[id] = (sponsorMap[id] || 0) + Number(amount);
}

// 转为数组并排序
const sponsorList = Object.entries(sponsorMap)
  .map(([id, totalAmount]) => ({ id, totalAmount }))
  .sort((a, b) => b.totalAmount - a.totalAmount);

fs.writeFileSync(outPath, JSON.stringify(sponsorList, null, 2), "utf-8");
console.log("sponsorList.json 已生成");