-- CreateTable
CREATE TABLE `CharacterBattleInventoryInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userUuid` VARCHAR(191) NOT NULL,
    `characterUuid` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL DEFAULT '',
    `resourcePrepareCount` INTEGER NOT NULL DEFAULT 0,

    INDEX `CharacterBattleInventoryInfo_userUuid_idx`(`userUuid`),
    INDEX `CharacterBattleInventoryInfo_characterUuid_idx`(`characterUuid`),
    INDEX `CharacterBattleInventoryInfo_characterUuid_userUuid_resource_idx`(`characterUuid`, `userUuid`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
