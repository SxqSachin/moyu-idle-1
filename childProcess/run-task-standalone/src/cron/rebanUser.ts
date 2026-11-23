import { prisma } from "../utils/prisma";
import { banUser } from "../utils/game/player";

async function clearBannedUser() {
  // 获取所有房间
  const bannedUser = await prisma.user.findMany({
    select: {
      uuid: true,
      name: true,
    },
    where: {
      is_banned: true
    }
  })

  for(const user of bannedUser) {
    await banUser(user.uuid, "多开");
    console.log(user.name, "已被封禁");
  }
}

await clearBannedUser();
console.log("清理完成");
process.exit(0);
