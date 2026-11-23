import { prisma } from "../utils/prisma";
import { increaseItemCount } from "../utils/game/characterInventory";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { safeJsonParse } from "~/shared/utils";

// 获取不可交易的物品列表
function getUntradeableResourceIds(): Set<string> {
  const untradeableIds = new Set<string>();
  
  for (const [id, resource] of Object.entries(allGameResourceWithInternal)) {
    // 检查是否不可交易（hideInMarket为true表示不可在市场交易）
    if (resource.hideInMarket === true) {
      untradeableIds.add(id);
    }
  }
  
  return untradeableIds;
}

async function mainLoop() {
  console.log("开始处理公会仓库中的不可交易物品退还...");
  
  const untradeableIds = getUntradeableResourceIds();
  untradeableIds.delete("gold"); // 金币不处理

  console.log(`发现 ${untradeableIds.size} 种不可交易物品类型: [${Array.from(untradeableIds).join(', ')}]`);
  
  // 直接获取所有捐赠记录
  const allDonations = await prisma.guildInventoryDonate.findMany({
    orderBy: { createdAt: "asc" } // 按时间顺序处理
  });
  
  console.log(`发现 ${allDonations.length} 条捐赠记录`);
  
  let totalProcessedDonations = 0;
  let totalReturnedItems = 0;
  let totalAffectedUsers = new Set<string>();
  let processedDonationIds: string[] = [];
  
  for (const donation of allDonations) {
    let info = safeJsonParse<ItemCountInfo>(donation.info, {});

    if (!Object.keys(info).length) {
        return
    }

    // 检查info中是否包含不可交易的物品
    let thisDonatonNeedReturnedItemCountInfo: ItemCountInfo = {};

    for (const [itemId, itemInfo] of Object.entries(info)) {
        if (!itemInfo) continue;
        if (untradeableIds.has(itemId) && itemInfo.count > 0) {
            thisDonatonNeedReturnedItemCountInfo[itemId] = itemInfo;
        }
    }

    if (!Object.keys(thisDonatonNeedReturnedItemCountInfo).length) {
        continue;
    }
    
    console.log(`\n处理捐赠记录: ${donation.id}`);
    console.log(`  公会: (${donation.guildUuid})`);
    console.log(`  捐赠者: ${donation.donorUuid}`);
    console.log(`  不可交易物品:`, Object.keys(thisDonatonNeedReturnedItemCountInfo).map(id => `${id} x${thisDonatonNeedReturnedItemCountInfo[id]!.count}`).join(', '));
    
    try {
      await prisma.$transaction(async (tx) => {
        let untradeableItemsInDonation = thisDonatonNeedReturnedItemCountInfo;
        // 1. 从公会仓库扣除对应的物品
        for (const [itemId, itemInfo] of Object.entries(untradeableItemsInDonation)) {
            if (!itemInfo?.count) {
                continue;
            }
          const currentGuildItem = await tx.guildInventory.findUnique({
            where: {
              guild_inventory_item_unique: {
                guildUuid: donation.guildUuid,
                itemId: itemId
              }
            }
          });
          
          if (currentGuildItem && currentGuildItem.count >= itemInfo.count) {
            // 扣除公会仓库物品
            await tx.guildInventory.update({
              where: {
                guild_inventory_item_unique: {
                  guildUuid: donation.guildUuid,
                  itemId: itemId
                }
              },
              data: {
                count: { decrement: BigInt(itemInfo.count) }
              }
            });
            
            console.log(`    从公会仓库扣除: ${itemId} x${itemInfo.count}`);
          } else {
            const availableCount = currentGuildItem?.count || 0n;
            console.log(`    警告: 公会仓库 ${itemId} 库存不足 (需要: ${itemInfo.count}, 可用: ${availableCount})`);
            // // 完全没有库存，从退还列表中移除
            delete untradeableItemsInDonation[itemId];
            console.log(`    跳过: ${itemId} (库存为0)`);
          }
        }
        
        // 2. 为捐赠用户添加对应物品
        if (Object.keys(untradeableItemsInDonation).length > 0) {
          await increaseItemCount(donation.donorUuid, untradeableItemsInDonation, {
            actionName: `公会仓库不可交易物品退还`,
            showModifyInfo: true,
            type: ModifyItemCountType.Guild
          }, tx);
          
          console.log(`    退还给用户 ${donation.donorUuid}:`, JSON.stringify(untradeableItemsInDonation, null, 2));
        }
        
        // 3. 更新捐赠记录，移除不可交易物品
        const updatedDonationInfo: ItemCountInfo = {};
        for (const [itemId, itemInfo] of Object.entries(info)) {
          if (!untradeableIds.has(itemId)) {
            updatedDonationInfo[itemId] = itemInfo;
          }
        }
        
        if (Object.keys(updatedDonationInfo).length > 0) {
          // 更新捐赠记录，移除不可交易物品
          await tx.guildInventoryDonate.update({
            where: { id: donation.id },
            data: {
              info: JSON.stringify(updatedDonationInfo)
            }
          });
          console.log(`更新捐赠记录 (移除不可交易物品)`);
        } else {
            // 如果所有物品都被退还，删除捐赠记录
            await tx.guildInventoryDonate.delete({
                where: { id: donation.id }
            });
            console.log(`删除捐赠记录 (所有物品都被退还)`);
        }
      });
      
      totalProcessedDonations++;
      
    } catch (error) {
      console.error(`处理捐赠记录 ${donation.id} 时出错:`, error); 
    }
  }
  
  console.log(`\n=== 处理完成 ===`);
  console.log(`处理捐赠记录数量: ${totalProcessedDonations}`);
  console.log(`退还物品总数: ${totalReturnedItems}`);
  console.log(`受影响用户数: ${totalAffectedUsers.size}`);
  console.log(`处理的捐赠记录ID: [${processedDonationIds.slice(0, 10).join(', ')}${processedDonationIds.length > 10 ? '...' : ''}]`);
  
  // 清理数量为0的公会仓库记录
  const cleanupResult = await prisma.guildInventory.deleteMany({
    where: { count: 0 }
  });
  
  console.log(`清理空记录: ${cleanupResult.count} 条`);
}

// 执行主逻辑
await mainLoop();
console.log("脚本执行完成");
process.exit(0);