#!/usr/bin/env node
/**
 * tools/generateStateMd.ts
 *
 * 从 shared/data/allBattleState.ts 导出所有状态，生成 markdown 文件到 wiki/state。
 */
import fs from 'fs';
import path from 'path';

import { allBattleState } from '../../shared/data/allBattleState';
import type { BattleState } from '~/shared/types/BattleState';
import { allBattleHookDescMap } from '../../shared/data/allHookInfo';

const OUT_DIR = path.resolve('./wiki/state');

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

function buildMarkdown(state: BattleState) {
  const meta = {
    id: state.id,
    title: state.name,
    description: state.description,
    duration: state.duration,
    isBuff: state.isBuff,
    isDebuff: state.isDebuff,
    permanent: state.permanent,
    unremovable: state.unremovable,
    consumeTurn: state.consumeTurn,
    StateEffectTriggerWhen: state.StateEffectTriggerWhen,
  };
  const contentLines: string[] = [];
  contentLines.push('---');
  contentLines.push(`id: ${meta.id}`);
  contentLines.push(`title: ${meta.title}`);
  contentLines.push('---');
  contentLines.push('');

  contentLines.push(`# 状态：${meta.title}`);
  contentLines.push('');
  // 单独描述区块
  contentLines.push('## 描述');
  contentLines.push('');
  contentLines.push(meta.description || '');
  contentLines.push('');
  // 其余字段
  contentLines.push('## 详细信息');
  contentLines.push(`- **状态ID**: ${meta.id}`);
  contentLines.push(`- **持续回合**: ${meta.duration}`);
  contentLines.push(`- **是否Buff**: ${meta.isBuff ? '是' : '否'}`);
  contentLines.push(`- **是否Debuff**: ${meta.isDebuff ? '是' : '否'}`);
  contentLines.push(`- **是否永久**: ${meta.permanent ? '是' : '否'}`);
  contentLines.push(`- **是否不可驱散**: ${meta.unremovable ? '是' : '否'}`);
  contentLines.push(`- **是否消耗回合**: ${meta.consumeTurn ? '是' : '否'}`);
  contentLines.push(`- **是否为控制效果**: ${state.consumeTurn ? '是' : '否'}`);
  contentLines.push(`- **是否导致沉默**: ${state.forbidCastSkill ? '是' : '否'}`);
  contentLines.push(`- **是否为契约状态**: ${state.isPactState ? '是' : '否'}`);
  contentLines.push(`- **触发时机**: ${meta.StateEffectTriggerWhen}`);
  contentLines.push('');


  // 新增：触发回调区块（统一用 allBattleHookDescMap）
  const callbackFields = Object.keys(allBattleHookDescMap);
  const callbacks = callbackFields.filter(f => typeof (state as any)[f] === 'function');
  if (callbacks.length > 0) {
    contentLines.push('## 触发时点 ');
    contentLines.push('');
    contentLines.push('| 说明 |');
    contentLines.push('|---|');
    for (const cb of callbacks) {
      contentLines.push(`| ${allBattleHookDescMap[cb] || ''} |`);
    }
    contentLines.push('');
  }

  // contentLines.push('## 原始数据 (JSON)');
  // contentLines.push('');
  // contentLines.push('```json');
  // contentLines.push(JSON.stringify(state, null, 2));
  // contentLines.push('```');
  return contentLines.join('\n');
}

function writeStates(states: Record<string, any>, group: string) {
  for (const key in states) {
    const state = states[key];
    if (!state || typeof state !== 'object') continue;
    const fileName = safeFileName(state.id || key) + '.md';
    const outPath = path.join(OUT_DIR, fileName);
    const md = buildMarkdown(state);
    fs.writeFileSync(outPath, md, 'utf-8');
  }
  console.log(`已导出 ${group} 状态到 ${OUT_DIR}`);
}

function main() {
  ensureOutDir();
  writeStates(allBattleState, '状态');
}

if (require.main === module) main();

export {};
