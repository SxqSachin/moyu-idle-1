-- CreateTable
CREATE TABLE `CharacterUnitInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_uuid` VARCHAR(191) NOT NULL,
    `character_uuid` VARCHAR(191) NOT NULL,
    `strength` INTEGER NOT NULL,
    `dexterity` INTEGER NOT NULL,
    `intelligence` INTEGER NOT NULL,
    `stamina` INTEGER NOT NULL,
    `attacking` INTEGER NOT NULL,
    `defencing` INTEGER NOT NULL,
    `max_hp` INTEGER NOT NULL,
    `current_hp` INTEGER NOT NULL,
    `max_mp` INTEGER NOT NULL,
    `current_mp` INTEGER NOT NULL,
    `ability` VARCHAR(191) NOT NULL,
    `ai` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CharacterUnitInfo_user_uuid_key`(`user_uuid`),
    UNIQUE INDEX `CharacterUnitInfo_character_uuid_key`(`character_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
