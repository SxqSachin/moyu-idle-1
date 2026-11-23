/*
  Warnings:

  - Added the required column `close_time` to the `Market` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Market` ADD COLUMN `close_time` DATETIME(3) NOT NULL,
    ADD COLUMN `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
