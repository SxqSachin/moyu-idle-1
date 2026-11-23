-- AlterTable
ALTER TABLE `CharacterUnitInfo` ADD COLUMN `level` INTEGER NOT NULL DEFAULT 1,
    MODIFY `max_hp` INTEGER NOT NULL DEFAULT 100,
    MODIFY `current_hp` INTEGER NOT NULL DEFAULT 100,
    MODIFY `max_mp` INTEGER NOT NULL DEFAULT 100,
    MODIFY `current_mp` INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE INDEX `CharacterUnitInfo_user_uuid_idx` ON `CharacterUnitInfo`(`user_uuid`);

-- CreateIndex
CREATE INDEX `CharacterUnitInfo_character_uuid_idx` ON `CharacterUnitInfo`(`character_uuid`);
