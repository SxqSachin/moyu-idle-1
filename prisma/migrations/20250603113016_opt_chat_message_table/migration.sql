/*
  Warnings:

  - You are about to drop the column `del` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `sender_name` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ChatMessage` DROP COLUMN `del`,
    ADD COLUMN `extra` VARCHAR(191) NULL,
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `receiver_id` VARCHAR(191) NULL,
    ADD COLUMN `sender_name` VARCHAR(191) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;
