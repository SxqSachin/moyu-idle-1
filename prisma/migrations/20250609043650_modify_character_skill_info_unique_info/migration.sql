-- DropIndex
DROP INDEX `CharacterSkillInfo_character_uuid_key` ON `CharacterSkillInfo`;

-- DropIndex
DROP INDEX `CharacterSkillInfo_user_uuid_key` ON `CharacterSkillInfo`;

-- CreateIndex
CREATE INDEX `CharacterSkillInfo_character_uuid_user_uuid_skill_id_idx` ON `CharacterSkillInfo`(`character_uuid`, `user_uuid`, `skill_id`);
