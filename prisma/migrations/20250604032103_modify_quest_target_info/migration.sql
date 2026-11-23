/*
  Warnings:

  - You are about to drop the column `target` on the `Quest` table. All the data in the column will be lost.
  - Added the required column `targetActionId` to the `Quest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetCurrentCount` to the `Quest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetGoalCount` to the `Quest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Quest` DROP COLUMN `target`,
    ADD COLUMN `targetActionId` INTEGER NOT NULL,
    ADD COLUMN `targetCurrentCount` INTEGER NOT NULL,
    ADD COLUMN `targetGoalCount` INTEGER NOT NULL;
