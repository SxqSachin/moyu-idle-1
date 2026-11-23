// import { unequipItem } from "../utils/game/equipment";
// import { prisma } from "../utils/prisma";
// import { CharacterEquipmentPart } from "~/shared/types/characterInfo";

// // 提取装备基础ID（去掉+等级后缀）
// function getBaseId(equipId: string | null | undefined) {
//   if (!equipId) return null;
//   const idx = equipId.indexOf("+");
//   return idx > 0 ? equipId.slice(0, idx) : equipId;
// }

// // 提取强化等级（返回数字，未强化为0）
// function getEnhanceLevel(equipId: string | null | undefined) {
//   if (!equipId) return 0;
//   const idx = equipId.indexOf("+");
//   if (idx > 0) {
//     const lv = parseInt(equipId.slice(idx + 1), 10);
//     return isNaN(lv) ? 0 : lv;
//   }
//   return 0;
// }

// // 饰品部位列表
// const decorateParts: CharacterEquipmentPart[] = [
//   CharacterEquipmentPart.decorate1,
//   CharacterEquipmentPart.decorate2,
//   CharacterEquipmentPart.decorate3,
//   CharacterEquipmentPart.decorate4,
// ];

// async function mainLoop() {
//   const allEquipment = await prisma.characterEquipment.findMany();

//   const duplicateUsers: Array<{
//     user_uuid: string,
//     character_uuid: string,
//     baseId: string,
//     equips: { part: CharacterEquipmentPart, id: string }[]
//   }> = [];

//   for (const equip of allEquipment) {
//     // 收集饰品部位
//     const parts = decorateParts.map(part => ({
//       part,
//       id: equip[part] as string | null
//     })).filter(item => !!item.id);

//     // 统计：基础ID => 该用户该基础ID所有饰品 [{part, id}]
//     const baseIdMap: Record<string, { part: CharacterEquipmentPart, id: string }[]> = {};

//     for (const item of parts) {
//       const baseId = getBaseId(item.id);
//       if (!baseId) continue;
//       if (!baseIdMap[baseId]) baseIdMap[baseId] = [];
//       baseIdMap[baseId].push(item as { part: CharacterEquipmentPart, id: string });
//     }

//     // 查找同一基础ID出现多个不同强化等级的情况
//     for (const [baseId, items] of Object.entries(baseIdMap)) {
//       const enhanceSet = new Set(items.map(i => getEnhanceLevel(i.id)));
//       if (enhanceSet.size > 1) {
//         duplicateUsers.push({
//           user_uuid: equip.user_uuid,
//           character_uuid: equip.character_uuid,
//           baseId,
//           equips: items,
//         });
//       }
//     }
//   }

//   // 输出并处理
//   if (duplicateUsers.length === 0) {
//     console.log("没有发现重复装备同一基础ID但不同强化等级的用户。");
//   } else {
//     console.log("发现如下重复装备同一基础ID但不同强化等级的用户，并将自动脱下多余饰品：");
//     for (const user of duplicateUsers) {
//       // 只保留最高强化等级
//       const sorted = user.equips.sort((a, b) => getEnhanceLevel(b.id) - getEnhanceLevel(a.id));
//       const keep = sorted[0];
//       const remove = sorted.slice(1);

//       console.log(
//         `user_uuid: ${user.user_uuid}, character_uuid: ${user.character_uuid}, baseId: ${user.baseId}, 保留: [${keep.id}], 脱下: [${remove.map(r => r.id).join(", ")}]`
//       );

//       // 脱下多余饰品
//       for (const r of remove) {
//         try {
//           await unequipItem(user.character_uuid, r.part);
//           console.log(`已脱下 ${r.id} (${r.part})`);
//         } catch (e) {
//           console.error(`脱下 ${r.id} (${r.part}) 失败:`, e);
//         }
//       }
//     }
//   }
// }

// await mainLoop();
// process.exit(0);