/*
  Warnings:

  - You are about to drop the column `cost_resource_count` on the `Market` table. All the data in the column will be lost.
  - Added the required column `cost_per_unit` to the `Market` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Market` DROP COLUMN `cost_resource_count`,
    ADD COLUMN `cost_per_unit` INTEGER NOT NULL;
