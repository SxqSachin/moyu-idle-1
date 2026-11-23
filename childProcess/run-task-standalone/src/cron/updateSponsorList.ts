import fs from "fs";
import path from "path";
import { prisma } from "../utils/prisma";

const sponsorListPath = path.resolve(__dirname, "../../../../assets/resource/sponsorList.json");

console.log(sponsorListPath)

async function main() {
  if (!fs.existsSync(sponsorListPath)) {
    console.warn("sponsorList.json 文件不存在");
    return;
  }
  const sponsorList = JSON.parse(fs.readFileSync(sponsorListPath, "utf-8"));
  let updated = 0;
  for (const sponsor of sponsorList) {
    const { id, totalAmount } = sponsor;
    const user = await prisma.user.findFirst({ where: { name: id } });

    if (!user) {
        console.log("未找到用户：", id)
        continue;
    }

    let maxSponsorPointsFromExcel = +(totalAmount * 100 || 0).toFixed(2);


    if (user.max_sponsor_points != maxSponsorPointsFromExcel) {
      console.log("更新用户赞助积分", user.max_sponsor_points, maxSponsorPointsFromExcel)
      await prisma.user.update({
        where: { uuid: user.uuid },
        data: { max_sponsor_points: Number(maxSponsorPointsFromExcel) }
      });
      updated++;
    }
  }
  console.log(`[updateSponsorList] 已同步 ${updated} 个用户的 max_sponsor_points`);
}

await main();
process.exit(1)