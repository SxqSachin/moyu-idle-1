/*
  Warnings:

  - You are about to drop the column `wx_openid` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `wx_openid`,
    ADD COLUMN `first_reset_password` BOOLEAN NULL DEFAULT false;
