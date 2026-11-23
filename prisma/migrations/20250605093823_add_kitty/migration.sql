-- CreateTable
CREATE TABLE `Kitty` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `is_working` BOOLEAN NULL,

    UNIQUE INDEX `Kitty_uuid_key`(`uuid`),
    UNIQUE INDEX `Kitty_owner_key`(`owner`),
    INDEX `Kitty_uuid_idx`(`uuid`),
    INDEX `Kitty_owner_idx`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
