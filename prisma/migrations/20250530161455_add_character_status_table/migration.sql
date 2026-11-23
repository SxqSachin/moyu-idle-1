-- CreateTable
CREATE TABLE `CharacterStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_uuid` VARCHAR(191) NOT NULL,
    `character_uuid` VARCHAR(191) NOT NULL,
    `collecting` VARCHAR(191) NOT NULL,
    `mining` VARCHAR(191) NOT NULL,
    `farmingAnimal` VARCHAR(191) NOT NULL,
    `farmingPlant` VARCHAR(191) NOT NULL,
    `cooking` VARCHAR(191) NOT NULL,
    `manufacturing` VARCHAR(191) NOT NULL,
    `trading` VARCHAR(191) NOT NULL,
    `knowledge` VARCHAR(191) NOT NULL,
    `exploring` VARCHAR(191) NOT NULL,
    `strength` VARCHAR(191) NOT NULL,
    `dexterity` VARCHAR(191) NOT NULL,
    `intelligence` VARCHAR(191) NOT NULL,
    `stamina` VARCHAR(191) NOT NULL,
    `attacking` VARCHAR(191) NOT NULL,
    `defencing` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CharacterStatus_user_uuid_key`(`user_uuid`),
    UNIQUE INDEX `CharacterStatus_character_uuid_key`(`character_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
