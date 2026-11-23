/*
  Warnings:

  - You are about to alter the column `max_satiety` on the `Kitty` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `satiety` on the `Kitty` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `Kitty` MODIFY `max_satiety` DOUBLE NOT NULL DEFAULT 100,
    MODIFY `satiety` DOUBLE NOT NULL DEFAULT 0;
