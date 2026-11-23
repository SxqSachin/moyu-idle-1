-- AlterTable
ALTER TABLE `CharacterSkillInfo` ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `logic` VARCHAR(191) NOT NULL DEFAULT '';
