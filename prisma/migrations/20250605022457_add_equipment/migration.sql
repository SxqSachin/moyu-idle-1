-- CreateTable
CREATE TABLE `CharacterEquipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_uuid` VARCHAR(191) NOT NULL,
    `character_uuid` VARCHAR(191) NOT NULL,
    `head` VARCHAR(191) NULL,
    `body` VARCHAR(191) NULL,
    `arm` VARCHAR(191) NULL,
    `leg` VARCHAR(191) NULL,
    `leftHand` VARCHAR(191) NULL,
    `rightHand` VARCHAR(191) NULL,
    `decorate1` VARCHAR(191) NULL,
    `decorate2` VARCHAR(191) NULL,
    `decorate3` VARCHAR(191) NULL,
    `decorate4` VARCHAR(191) NULL,

    UNIQUE INDEX `CharacterEquipment_user_uuid_key`(`user_uuid`),
    UNIQUE INDEX `CharacterEquipment_character_uuid_key`(`character_uuid`),
    INDEX `CharacterEquipment_user_uuid_idx`(`user_uuid`),
    INDEX `CharacterEquipment_character_uuid_idx`(`character_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
