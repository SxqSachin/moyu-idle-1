-- CreateTable
CREATE TABLE `Quest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `actionMainType` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `executor` VARCHAR(191) NOT NULL,
    `difficulty` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `target` LONGTEXT NOT NULL,
    `rewards` LONGTEXT NOT NULL,

    INDEX `Quest_executor_idx`(`executor`),
    INDEX `Quest_uuid_idx`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CharacterBuilding_user_uuid_idx` ON `CharacterBuilding`(`user_uuid`);

-- CreateIndex
CREATE INDEX `CharacterBuilding_character_uuid_idx` ON `CharacterBuilding`(`character_uuid`);

-- CreateIndex
CREATE INDEX `CharacterInventory_user_uuid_idx` ON `CharacterInventory`(`user_uuid`);

-- CreateIndex
CREATE INDEX `CharacterInventory_character_uuid_idx` ON `CharacterInventory`(`character_uuid`);

-- CreateIndex
CREATE INDEX `CharacterStatus_user_uuid_idx` ON `CharacterStatus`(`user_uuid`);

-- CreateIndex
CREATE INDEX `CharacterStatus_character_uuid_idx` ON `CharacterStatus`(`character_uuid`);

-- CreateIndex
CREATE INDEX `Market_trade_uuid_idx` ON `Market`(`trade_uuid`);

-- CreateIndex
CREATE INDEX `User_uuid_idx` ON `User`(`uuid`);
