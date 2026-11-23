import { prisma } from "../utils/prisma";
import { GuildRole } from "~/shared/types/guild";

// If the current guild leader hasn't been online for INACTIVE_DAYS, transfer
// leadership to the most recently-online OFFICER within the guild.
const INACTIVE_DAYS = 15;
const INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

async function scanAndTransfer() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const guilds = await prisma.guild.findMany({
      where: { is_deleted: false, is_active: true },
      select: { uuid: true, owner: true },
    });

    let processed = 0;
    for (const guild of guilds) {
      const ownerUser = await prisma.user.findUnique({
        where: { uuid: guild.owner },
        select: { uuid: true, last_online_date: true },
      });

      if (!ownerUser) {
        // 无所有者用户信息，跳过
        continue;
      }

      if (ownerUser.last_online_date > cutoff) {
        // 会长仍活跃
        continue;
      }

      // 找出该公会的所有组长（OFFICER）
      const officers = await prisma.guildMember.findMany({
        where: { guildUuid: guild.uuid, role: GuildRole.OFFICER },
        select: { userUuid: true },
      });

      const officerUuids = officers.map((o) => o.userUuid);
      const officerUsers = officerUuids.length
        ? await prisma.user.findMany({
            where: { uuid: { in: officerUuids }, is_banned: false },
            select: { uuid: true, last_online_date: true },
          })
        : [];

      // 优先选择活跃组长，其次任何组长，最后选择最活跃的普通成员
      const activeOfficers = officerUsers.filter(
        (u) => u.last_online_date && u.last_online_date > cutoff
      );
      let newOwner = activeOfficers[0];
      for (const c of activeOfficers) {
        if (newOwner && newOwner.last_online_date > c.last_online_date) continue;
        newOwner = c;
      }

      if (!newOwner && officerUsers.length) {
        // 组长都不活跃时，仍从组长中选最近在线的
        newOwner = officerUsers[0];
        for (const c of officerUsers) {
          if (newOwner && newOwner.last_online_date > c.last_online_date) continue;
          newOwner = c;
        }
      }

      if (!newOwner) {
        // 无组长或组长都不可用，尝试从普通成员中挑选最活跃的
        const members = await prisma.guildMember.findMany({
          where: { guildUuid: guild.uuid, role: GuildRole.MEMBER },
          select: { userUuid: true },
        });

        const memberUuids = members.map((m) => m.userUuid);
        const memberUsers = memberUuids.length
          ? await prisma.user.findMany({
              where: { uuid: { in: memberUuids }, is_banned: false },
              select: { uuid: true, last_online_date: true },
            })
          : [];

        if (memberUsers.length) {
          newOwner = memberUsers[0];
          for (const c of memberUsers) {
            if (newOwner && newOwner.last_online_date > c.last_online_date) continue;
            newOwner = c;
          }
        }
      }

      if (!newOwner) {
        // 没有可用的接任者
        continue;
      }

      // 事务执行转让逻辑（尽量减少破坏性：只变更相关两人的角色）
      await prisma.$transaction(async (tx) => {
        // 1. 更新 guild.owner
        await tx.guild.update({
          where: { uuid: guild.uuid },
          data: { owner: newOwner.uuid },
        });

        // 2. 原会长降级为 OFFICER（更温和，不一刀切降为 MEMBER）
        await tx.guildMember.update({
          where: { guildUuid_userUuid: { guildUuid: guild.uuid, userUuid: ownerUser.uuid } },
          data: { role: GuildRole.OFFICER },
        });

        // 3. 新会长升级为 LEADER
        await tx.guildMember.update({
          where: { guildUuid_userUuid: { guildUuid: guild.uuid, userUuid: newOwner.uuid } },
          data: { role: GuildRole.LEADER },
        });
      });

      processed++;
      console.log(
        `[GuildLeaderTransfer] Guild ${guild.uuid} leader inactive >= ${INACTIVE_DAYS}d, transferred to ${newOwner.uuid}`
      );
    }

    console.log(
      `[GuildLeaderTransfer] Scan finished at ${now.toISOString()}, processed ${processed} transfers.`
    );
  } catch (err) {
    console.error("[GuildLeaderTransfer] Error during scan:", err);
  }
}

async function mainLoop() {
  console.log(
    `[GuildLeaderTransfer] Service started. Check every ${INTERVAL / (60 * 60 * 1000)}h; threshold=${INACTIVE_DAYS} days.`
  );
  while (running) {
    await scanAndTransfer();
    // sleep once to reduce event loop churn; shutdown will occur after the sleep completes
    await new Promise((res) => setTimeout(res, INTERVAL));
  }
  console.log("[GuildLeaderTransfer] Service stopped.");
}

await mainLoop();
process.exit(0);
