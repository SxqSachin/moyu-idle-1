/*
  Warnings:

  - You are about to drop the column `created_At` on the `ChatMessage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ChatMessage` DROP COLUMN `created_At`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
