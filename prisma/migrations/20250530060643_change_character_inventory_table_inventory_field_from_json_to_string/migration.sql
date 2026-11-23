/*
  Warnings:

  - A unique constraint covering the columns `[character_uuid]` on the table `CharacterInventory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `CharacterInventory` MODIFY `inventory` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `CharacterInventory_character_uuid_key` ON `CharacterInventory`(`character_uuid`);
