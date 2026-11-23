-- CreateTable
CREATE TABLE `CharacterBuilding` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_uuid` VARCHAR(191) NOT NULL,
    `character_uuid` VARCHAR(191) NOT NULL,
    `building` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CharacterBuilding_user_uuid_key`(`user_uuid`),
    UNIQUE INDEX `CharacterBuilding_character_uuid_key`(`character_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
