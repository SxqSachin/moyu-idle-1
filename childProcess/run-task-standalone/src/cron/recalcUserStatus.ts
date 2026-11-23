import { prisma } from "../utils/prisma";
import { updateCharacterStatusInfo } from "../utils/game/character";

async function clearBannedUser() {
  // 获取所有房间
  const allUser = await prisma.user.findMany({
    select: {
      uuid: true,
      name: true,
    },
    where: {
      is_banned: false
    }
  })

  let i = 0;
  for(const user of allUser) {
    console.log(`正在处理第 ${++i}/${allUser.length} 个用户: ${user.uuid}(${user.name})`);
    await updateCharacterStatusInfo(user.uuid);
  }
}

await clearBannedUser();
console.log("修复完成");
process.exit(0);
