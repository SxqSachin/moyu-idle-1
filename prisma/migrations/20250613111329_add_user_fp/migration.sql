-- AlterTable
ALTER TABLE `CharacterUnitInfo` ADD COLUMN `fp` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `last_online_fp` LONGTEXT NULL;
