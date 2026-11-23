#!/usr/bin/env node
/**
 * tools/generateSkillMd.ts
 *
 * 从 `shared/data/allGameBattleSkill.ts` 中导出对象，遍历所有技能并生成 markdown 文件到 `wiki/skills`。
 * 运行方式（使用 bun 或 ts-node）：
 *   bun run tools/generateSkillMd.ts
 *   或
 *   ts-node tools/generateSkillMd.ts
 */

import fs from 'fs';
import path from 'path';
import { allGameResource } from '../../shared/data/allGameResources';
import { allGameBattleSkills } from '../../shared/data/allGameBattleSkill';
import type { AllBattleSkillId, DamageType, GameBattleSkill, SkillType } from '~/shared/types/skill';
import { ObjectKeysTyped } from '~/shared/utils';
import { skillTypeMap, damageTypeMap } from '../../shared/types/skill';

const a = allGameResource;

const OUT_DIR = path.resolve(process.env.WIKI_OUTPUT_DIR || './wiki/skills');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function safeFileName(name: string) {
  if (!name) return '';
  let s = name.normalize('NFKC');
  s = s.replace(/\p{C}/gu, '');
  s = s.replace(/[\\/:*?"<>|]/g, '-');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^[-.]+|[-.]+$/g, '');
  return s;
}

function serializeSkill(obj: any) {
  const clone: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'function') continue;
    try { JSON.stringify(v); clone[k] = v; } catch (e) { clone[k] = String(v); }
  }
  return clone;
}

function renderSkillType(types: SkillType[] | SkillType) {
  if (!types) return '';
  if (!Array.isArray(types)) types = [types];
  return types.map(t => {
    const info = skillTypeMap[t] || { label: t };
    return `**${info.label}**`;
  }).join('、');
}
function renderDamageType(type: DamageType[] | DamageType) {
  if (!type) return '';
  if (!Array.isArray(type)) type = [type];
  return type.map(t => {
    const info = damageTypeMap[t] || { label: t };
    return `**${info.label}**`;
  }).join('、');
}

function buildMarkdown(id: string, skill: GameBattleSkill) {
  const title = skill.name || id;
  const meta = {
    id,
    title,
    skillType: skill.skillType || [],
    damageType: skill.damageType,
    target: skill.target || null,
  };

  const contentLines: string[] = [];
  contentLines.push('---');
  contentLines.push(`id: ${meta.id}`);
  contentLines.push(`title: ${meta.title}`);
  contentLines.push(`skillType: ${Array.isArray(meta.skillType) ? meta.skillType.join(', ') : meta.skillType}`);
  contentLines.push(`damageType: ${meta.damageType}`);
  contentLines.push(`target: ${meta.target}`);
  contentLines.push('---');
  contentLines.push('');
  contentLines.push(`# ${meta.title}`);
  contentLines.push('');
  contentLines.push(`- **技能ID**: ${id}`);
  contentLines.push(`- **类型**: ${renderSkillType(meta.skillType)}`);
  contentLines.push(`- **伤害**: ${renderDamageType(meta.damageType)}`);
  contentLines.push(`- **目标**: ${meta.target}`);
  contentLines.push('');
  if (skill.effectStr) {
    contentLines.push('## 描述');
    contentLines.push('');
    contentLines.push(skill.effectStr.replace(/\r/g, ''));
    contentLines.push('');
  }
  contentLines.push('## 属性');
  contentLines.push('');
  contentLines.push('| 属性 |  数值 |');
  contentLines.push('|---|---|');
  contentLines.push(`| ID | ${id} |`);
  contentLines.push(`| 名称 | ${skill.name} |`);
  contentLines.push(`| 类型 | ${renderSkillType(skill.skillType)} |`);
  contentLines.push(`| 伤害 | ${renderDamageType(skill.damageType)} |`);
  contentLines.push(`| 目标 | ${skill.target} |`);
  contentLines.push(`| 目标数量 | ${skill.targetCount} |`);
  contentLines.push(`| 冷却回合 | ${skill.colddown} |`);
  contentLines.push(`| 法力消耗 | ${skill.mpCost} |`);
//   contentLines.push('');
//   contentLines.push('## 技能原始数据 (JSON，函数已移除)');
//   contentLines.push('');
//   contentLines.push('```json');
//   contentLines.push(JSON.stringify(serializeSkill(skill), null, 2));
//   contentLines.push('```');
//   contentLines.push('');
//   contentLines.push('---');
//   contentLines.push('');
//   contentLines.push('> **字段说明**:');
//   contentLines.push('> - 技能类型、伤害类型等详细定义请参见 [shared/types/skill.ts](../../shared/types/skill.ts)');
//   contentLines.push('> - 目标类型、冷却、消耗等为战斗系统核心字段。');
//   contentLines.push('');
  return contentLines.join('\n');
}

async function main() {
  ensureOutDir();
  const skillIds: AllBattleSkillId[] = ObjectKeysTyped(allGameBattleSkills);
  let count = 0;
  for (const skillId of skillIds) {
    const obj = allGameBattleSkills[skillId];
    if (!obj || typeof obj !== 'object') continue;
    const skill = obj;
    if (!skill || typeof skill !== 'object') continue;
    const id = skill.id || skillId;
    const fileName = safeFileName(id) + '.md';
    const outPath = path.join(OUT_DIR, fileName);
    const md = buildMarkdown(id, skill);
    fs.writeFileSync(outPath, md, 'utf-8');
    count++;
  }
  console.log(`generateSkillMd: wrote ${count} markdown files to ${OUT_DIR}`);
}

if (require.main === module) main();

export {};
