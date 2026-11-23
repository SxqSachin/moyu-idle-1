-- CreateTable
CREATE TABLE `BuyerMarket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trade_uuid` VARCHAR(191) NOT NULL,
    `buyer` VARCHAR(191) NOT NULL,
    `require_resource_id` VARCHAR(191) NOT NULL,
    `require_resource_count` INTEGER NOT NULL,
    `done_resource_count` INTEGER NOT NULL,
    `pay_resource_id` VARCHAR(191) NOT NULL,
    `pay_per_unit` INTEGER NOT NULL,
    `is_closed` BOOLEAN NOT NULL,
    `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `close_time` DATETIME(3) NULL,

    UNIQUE INDEX `BuyerMarket_trade_uuid_key`(`trade_uuid`),
    INDEX `BuyerMarket_trade_uuid_idx`(`trade_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
