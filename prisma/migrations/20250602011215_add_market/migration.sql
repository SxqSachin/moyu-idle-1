-- CreateTable
CREATE TABLE `Market` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trade_uuid` VARCHAR(191) NOT NULL,
    `seller` VARCHAR(191) NOT NULL,
    `sell_resource_id` VARCHAR(191) NOT NULL,
    `sell_resource_count` INTEGER NOT NULL,
    `selled_resource_count` INTEGER NOT NULL,
    `cost_resource_id` VARCHAR(191) NOT NULL,
    `cost_resource_count` INTEGER NOT NULL,
    `buyer_info` VARCHAR(191) NULL,
    `is_closed` BOOLEAN NOT NULL,

    UNIQUE INDEX `Market_trade_uuid_key`(`trade_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
