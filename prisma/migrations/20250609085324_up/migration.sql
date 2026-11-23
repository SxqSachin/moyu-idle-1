-- AlterTable
ALTER TABLE `CharacterUnitInfo` MODIFY `ability` LONGTEXT NOT NULL,
    MODIFY `ai` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `ChatMessage` MODIFY `extra` LONGTEXT NULL;
