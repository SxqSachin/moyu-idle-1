-- CreateTable
CREATE TABLE `CharacterSkillInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_uuid` VARCHAR(191) NOT NULL,
    `character_uuid` VARCHAR(191) NOT NULL,
    `skill_id` VARCHAR(191) NOT NULL DEFAULT '',
    `level` INTEGER NOT NULL DEFAULT 0,
    `exp` DOUBLE NOT NULL DEFAULT 0,

    UNIQUE INDEX `CharacterSkillInfo_user_uuid_key`(`user_uuid`),
    UNIQUE INDEX `CharacterSkillInfo_character_uuid_key`(`character_uuid`),
    INDEX `CharacterSkillInfo_user_uuid_idx`(`user_uuid`),
    INDEX `CharacterSkillInfo_character_uuid_idx`(`character_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
