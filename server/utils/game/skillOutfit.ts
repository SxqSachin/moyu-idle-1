import { v4 } from "uuid"
import { prisma } from "./db"
import { safeJsonParse } from "~/shared/utils"
import { CharacterSkillOutfit } from "~/generated/prisma"
import { CharacterSkillOutFitInGame } from "~/shared/types/characterInfo"
import { getBattleRoomByUserId } from "./battle"

function toSkillOutfit(outfit: CharacterSkillOutfit): CharacterSkillOutFitInGame {
    let data = JSON.parse(outfit.data) as any[];
    data = data.map<CharacterSkillOutFitInGame['data'][0]>((skill) => {
        return {
            skillId: skill.skill_id,
            enabled: skill.enabled,
            logic: skill.logic,
            order: skill.order || 0,
            extra: skill.extra || {},
        }
    })

    return {
        uuid: outfit.uuid,
        name: outfit.name,
        data: data
    }
}

export async function applySkillOutfit(characterUuid: string, outfitUuid: string) {
    if (!characterUuid || !outfitUuid) {
        return []
    }
    return prisma.$transaction(async (tx) => {
        // 获取技能方案数据
        const outfitData = await tx.characterSkillOutfit.findFirst({
            where: {
                user_uuid: characterUuid,
                uuid: outfitUuid,
            },
            select: {
                data: true
            }
        })

        if (!outfitData) {
            throw new Error("技能方案不存在");
        }

        let room = await getBattleRoomByUserId(characterUuid);
        if (!!room && room.status != 'waiting') {
            throw new Error("战斗中无法修改技能方案");
        }


        // 更新角色技能信息
        const skillData = JSON.parse(outfitData.data);
        const updatePromises = skillData.map((skill: any) => {
            return tx.characterSkillInfo.updateMany({
                where: {
                    character_uuid: characterUuid,
                    skill_id: skill.skill_id
                },
                data: {
                    enabled: skill.enabled,
                    logic: JSON.stringify(skill.logic ?? []),
                    order: skill.order,
                    extra: JSON.stringify(skill.extra || {})
                }
            });
        });

        await Promise.all(updatePromises);
    })
}

export async function saveCurrentAsOutfit(characterUuid: string, name: string) {
    if (!characterUuid) {
        return []
    }
    return prisma.$transaction(async (tx) => {
        if (!name || name.length < 1) {
            throw new Error("技能方案名称不能为空");
        }
        if (name.length > 12) {
            throw new Error("技能方案名称长度不能超过12个字符");
        }
        const exist = await tx.characterSkillOutfit.findFirst({
            where: {
                user_uuid: characterUuid,
                name: name,
            }
        })

        if (exist) {
            throw new Error("技能方案名称已存在");
        }

        const currentAllSkillData = await tx.characterSkillInfo.findMany({
            where: {
                character_uuid: characterUuid,
                available: true,
            },
            select: {
                skill_id: true,
                enabled: true,
                logic: true,
                order: true,
                extra: true,
            },
            orderBy: {
                order: "asc"
            }
        })

        for (const skill of currentAllSkillData) {
            skill.logic = safeJsonParse(skill.logic, [])
            skill.extra = safeJsonParse(skill.extra, {})
        }

        await tx.characterSkillOutfit.create({
            data: {
                uuid: v4(),
                user_uuid: characterUuid,
                character_uuid: characterUuid,
                name: name,
                data: JSON.stringify(currentAllSkillData),
                created_at: new Date(),
            }
        })

        return (await tx.characterSkillOutfit.findMany({
            where: {
                user_uuid: characterUuid,
                character_uuid: characterUuid
            }
        })).map(toSkillOutfit)
    })
}

export async function getUserAllSkillOutfit(characterUuid: string) {
    if (!characterUuid) {
        return []
    }
    return (await prisma.characterSkillOutfit.findMany({
        where: {
            user_uuid: characterUuid,
            character_uuid: characterUuid
        },
        orderBy: {
            created_at: "desc"
        },
    })).map(toSkillOutfit)
}

export async function deleteSkillOutfit(characterUuid: string, outfitUuid: string) {
    if (!characterUuid || !outfitUuid) {
        return
    }
    return prisma.$transaction(async (tx) => {
        const outfit = await tx.characterSkillOutfit.findFirst({
            where: {
                user_uuid: characterUuid,
                uuid: outfitUuid
            }
        })

        if (!outfit) {
            throw new Error("技能方案不存在");
        }

        await tx.characterSkillOutfit.delete({
            where: {
                uuid: outfit.uuid
            }
        })

        return (await tx.characterSkillOutfit.findMany({
            where: {
                user_uuid: characterUuid,
                character_uuid: characterUuid
            }
        })).map(toSkillOutfit)
    })
}