-- AlterTable
ALTER TABLE `CharacterStatus` ADD COLUMN `forging` VARCHAR(191) NOT NULL DEFAULT '{"level":1,"currentExp":0}',
    ADD COLUMN `sewing` VARCHAR(191) NOT NULL DEFAULT '{"level":1,"currentExp":0}';
