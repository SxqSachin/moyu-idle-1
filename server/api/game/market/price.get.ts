import { defineEventHandler } from "h3";

import fs from "fs/promises";
import path from "path";
import {
  REQUEST_SUCCESS_CODE,
  REQUEST_SUCCESS_MSG,
} from "~/shared/requestResult";

const marketDataPath = path.resolve(process.cwd(), "assets/data/market.json");
export default defineEventHandler(async (event) => {
  const fileContent = await fs.readFile(marketDataPath, "utf-8");

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
    data: JSON.parse(fileContent),
  };
});
