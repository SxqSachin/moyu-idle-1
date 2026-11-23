import fs from 'fs';
import path from 'path';
import { allGameAction, allGameActionMainType } from '../../shared/data/allGameActions';
import { allGameResource, allGameResourceWithInternal } from '../../shared/data/allGameResources';
import { allCharacterStatus } from '../../shared/data/allCharacterStatus';
import { allGameBuilding } from '../../shared/data/allGameBuilding';
import type { GameAction, AllGameActionID, GameMainActionInfo } from '~/shared/types/gameAction';

const OUT_DIR = path.resolve(process.env.WIKI_OUTPUT_DIR || './wiki/action');

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

function buildMarkdown(action: GameAction, actionId: AllGameActionID) {
  const contentLines = [];
  contentLines.push('---');
  contentLines.push(`id: ${actionId}`);
  contentLines.push(`title: ${action.name}`);
  contentLines.push('---');
  contentLines.push('');
  contentLines.push(`# 动作：${action.name}`);
  contentLines.push('');
  contentLines.push('## 基本信息');
  contentLines.push('');
  contentLines.push(`- **动作ID**: ${actionId}`);
  contentLines.push(`- **名称**: ${action.name}`);
  contentLines.push(`- **描述**: ${action.description || ''}`);
  contentLines.push(`- **基础时长（毫秒）**: ${action.baseDuration ?? ''}`);
//   contentLines.push(`- **图标**: ${action.icon || ''}`);
  contentLines.push('');

  // 类型区块
  contentLines.push('## 类型(Type)');
  contentLines.push('');
  for (const [typeKey, typeInfo] of Object.entries(allGameActionMainType)) {
    if (typeInfo.actions.includes(actionId)) {
      contentLines.push(`- **${typeInfo.name}/${typeKey}**`);
    //   contentLines.push(`  - id: ${typeInfo.id}`);
    //   contentLines.push(`  - name: ${typeInfo.name}`);
    //   contentLines.push(`  - icon: ${typeInfo.icon}`);
    //   contentLines.push(`  - color: ${typeInfo.color}`);
      contentLines.push('');
    }
  }

  // 需求区块
  if (action.requirement) {
    contentLines.push('## 需求(Requirement)');
    contentLines.push('');
    if (action.requirement.resource && action.requirement.resource.length > 0) {
      contentLines.push('- **资源**:');
      for (const r of action.requirement.resource) {
        if (r && r.id) {
          const resName = allGameResourceWithInternal[r.id]?.name || r.id;
          contentLines.push(`  - [[物品/${resName}]] x${r.count}`);
        }
      }
    }
    if (action.requirement.characterStatus && action.requirement.characterStatus.length > 0) {
      contentLines.push('- **角色属性**:');
      for (const s of action.requirement.characterStatus) {
        // @ts-ignore
        const statusInfo = allCharacterStatus[s.status];
        const statusLabel = statusInfo ? `${statusInfo.name}/${s.status}` : s.status;
        contentLines.push(`  - ${statusLabel} >= ${s.min}`);
      }
    }
    if (action.requirement.building && action.requirement.building.length > 0) {
      contentLines.push('- **建筑**:');
      for (const b of action.requirement.building) {
        const buildingInfo = allGameBuilding[b.id];
        const buildingLabel = buildingInfo ? `${buildingInfo.name}` : b.id;
        contentLines.push(`  - [[建筑/${buildingLabel}]] 等级>=${b.minLevel}`);
      }
    }
    contentLines.push('');
  }

  // 奖励区块
  if (action.rewards && action.rewards.length > 0) {
    contentLines.push('## 奖励(Rewards)');
    contentLines.push('');
    for (const reward of action.rewards) {
      if (reward.id) {
        contentLines.push(`- [[物品/${allGameResourceWithInternal[reward.id].name}]] x${reward.count ?? ''}`);
      } else if (reward.buildingId) {
        contentLines.push(`- [[建筑/${reward.buildingId}]]`);
      }
    }
    contentLines.push('');
  }

  // 其他字段
  if (action.secondaryClassification) {
    contentLines.push(`- **二级分类**: ${action.secondaryClassification}`);
  }
  if (action.banToKitty) {
    contentLines.push('- **禁止猫咪执行**: 是');
  }
  if (action.hidden) {
    contentLines.push('- **隐藏动作**: 是');
  }
  if (action.ignoreDismantle) {
    contentLines.push('- **不可分解**: 是');
  }

  return contentLines.join('\n');
}

function main() {
  ensureOutDir();
  for (const [aid, act] of Object.entries(allGameAction)) {
    if (aid.startsWith('dismantle_')) {
        return;
    }
    const md = buildMarkdown(act, aid as AllGameActionID);
    const outPath = path.join(OUT_DIR, safeFileName(aid) + '.md');
    fs.writeFileSync(outPath, md, 'utf-8');
  }
  console.log('已导出所有动作到', OUT_DIR);
}

if (require.main === module) main();

export {};