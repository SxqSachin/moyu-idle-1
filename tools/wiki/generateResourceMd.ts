import fs from 'fs';
import path from 'path';
import { allGameResource } from '../../shared/data/allGameResources';
import type { AllGameResourceID, GameResource } from '~/shared/types/gameResource';

import { allGameAction } from "~/shared/data/allGameActions"
import { allEquipmentTriggerData } from "~/server/data/allEquipmentTriggerData"
import { allBattleHookDescMap } from '../../shared/data/allHookInfo';
import { allCharacterStatus } from '../../shared/data/allCharacterStatus';

import enhanceInfo from "@/assets/resource/enhanceInfo.json"


// 兼容 js/ts 导出
// let allGameAction = {};
// try {
//   allGameAction = require('../../shared/data/allGameActions');
//   if (allGameAction.default) allGameAction = allGameAction.default;
// } catch (e) {
//   try {
//     allGameAction = require('../../shared/data/allGameActions.js');
//     if (allGameAction.default) allGameAction = allGameAction.default;
//   } catch (e2) {
//     try {
//       allGameAction = require('../../shared/data/allGameActions.ts');
//       if (allGameAction.default) allGameAction = allGameAction.default;
//     } catch (e3) {
//       allGameAction = {};
//     }
//   }
// }

const OUT_DIR = path.resolve(process.env.WIKI_OUTPUT_DIR || './wiki/resource');

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

function getEnhanceVariants(resourceId: AllGameResourceID) {
  // 返回所有以 resourceId 为 base 的强化版本 id
  if (!enhanceInfo) return [];
  // @ts-expect-error
  return Object.keys(enhanceInfo).filter(eid => enhanceInfo[eid]?.base === resourceId);
}

function getActionsProducing(resourceId: AllGameResourceID) {
  // 返回所有产出该物品的动作
  if (!allGameAction) return [];
  return Object.values(allGameAction).filter(a => Array.isArray(a.rewards) && a.rewards.some(o => o.id === resourceId));
}

function getActionsUsing(resourceId: AllGameResourceID) {
  // 返回所有消耗该物品的动作
  if (!allGameAction) return [];
  return Object.values(allGameAction).filter(a => Array.isArray(a.requirement) && a.requirement.some(i => i.id === resourceId));
}

function buildMarkdown(resource: GameResource, resourceId: AllGameResourceID) {
  // 翻译映射
  const equipPartMap = {
    '': '无/None',
    leftHand: '左手/Left Hand',
    leftHand2: '左手/Left Hand',
    rightHand: '右手/Right Hand',
    rightHand2: '右手/Right Hand',
    head: '头部/Head',
    body: '身体/Body',
    arm: '手臂/Arm',
    leg: '腿/Leg',
    foot: '脚/Foot',
    cloak: '披风/Cloak',
    decorate1: '饰品1/Decorate1',
    decorate2: '饰品2/Decorate2',
    decorate3: '饰品3/Decorate3',
    decorate4: '饰品4/Decorate4',
    decorate5: '饰品5/Decorate5',
    decorate6: '饰品6/Decorate6',
    decorate7: '饰品7/Decorate7',
    decorate8: '饰品8/Decorate8',
    decorate9: '饰品9/Decorate9',
  };
  const equipTypeMap = {
    work: '工作/Work',
    battle: '战斗/Battle',
  };
  const contentLines = [];
  contentLines.push('---');
  contentLines.push(`id: ${resourceId}`);
  contentLines.push(`title: ${resource.name.replaceAll('"', '')}`);
  contentLines.push('---');
  contentLines.push('');
  contentLines.push(`# 装备：${resource.name}`);
  contentLines.push('');
  contentLines.push('## 描述');
  contentLines.push('');
  contentLines.push(resource.description || '');
  contentLines.push('');
  contentLines.push(`- **装备ID**: ${resourceId}`);
  contentLines.push(`- **装备部位**: ${equipPartMap[resource.equipPart ?? ''] || resource.equipPart || ''}`);
  contentLines.push(`- **装备类型**: ${(resource.equipmentType||[]).map(t => equipTypeMap[t]||t).join(', ')}`);
  // @ts-expect-error
  contentLines.push(`- **可强化**: ${enhanceInfo[resourceId] ? '是/Yes' : '否/No'}`);
  contentLines.push(`- **可分解**: ${allGameAction["dismantle_" + resourceId] ? '是/Yes' : '否/No'}`);
  contentLines.push('');

  // 获取方式区块：如为强化物品或有强化链，输出完整强化表格，否则正常显示来源
  const baseId = resourceId.split('+')[0];
  // 收集所有强化等级
  const enhanceRows = [];
  let hasEnhance = false;
  for (let i = 0; i <= 150; i++) {
    const eid = i === 0 ? baseId : `${baseId}+${i}`;
    // @ts-expect-error
    const einfo = enhanceInfo[eid];
    if (!einfo && i !== 0) break;
    const res = allGameResource[eid];
    if (!res) break;
    hasEnhance = true;
    enhanceRows.push({
      id: eid,
      name: res.name,
      exp: einfo?.rewardEnhanceExp ?? '',
      basePercent: einfo?.enhanceBasePercent ?? '',
      materials: einfo?.enhanceRequireResource ?? [],
    });
  }
  let enhanceChainBlock = '';
  if (hasEnhance && enhanceRows.length > 1) {
    const lines = [];
    lines.push('## 强化链/Enhance Chain');
    lines.push('');
    lines.push('| 等级 | 装备 | 经验 | 基础成功率 | 所需材料 |');
    lines.push('|---|---|---|---|---|');
    for (let i = 1; i < enhanceRows.length; i++) {
      const row = enhanceRows[i];
      const matStr = row.materials.map((m: any) => `[[物品/${allGameResource[m.resourceId]?.name || m.resourceId}]]*${m.count}`).join('、');
      lines.push(`| +${i} | [[物品/${row.name}]] | ${row.exp} | ${row.basePercent ? (row.basePercent * 100).toFixed(2) + '%' : ''} | ${matStr} |`);
    }
    lines.push('');
    enhanceChainBlock = lines.join('\n');
  } else {
    // 过滤掉分解类动作（如名字含“分解”或id含'decompose'）
    const actionsFrom = getActionsProducing(resourceId).filter(act => {
      const name = act.name || '';
      const id = act.id || '';
      return !(name.includes('分解') || id.includes('decompose'));
    });
    if (actionsFrom.length > 0) {
      contentLines.push('## 获取方式');
      contentLines.push('');
      for (const act of actionsFrom) {
        contentLines.push(`- [[动作/${act.name}]]`);
      }
      contentLines.push('');
    }
  }

  // 装备作用
  if (Array.isArray(resource.onEquip) && resource.onEquip.length > 0) {
    contentLines.push('## 装备作用');
    contentLines.push('');
    for (const effect of resource.onEquip) {
      // 文字描述优先
      if (Array.isArray(effect.textDetail) && effect.textDetail.length > 0) {
        for (const td of effect.textDetail) {
          contentLines.push(`- **${td.title}**: ${td.description}`);
        }
      }
      // 属性/状态/经验等效果
      if (Array.isArray(effect.statusEffect)) {
        for (const se of effect.statusEffect) {
          // 属性翻译
          const statusInfo = allCharacterStatus[se.status] || {};
          const statusLabel = statusInfo.name ? `${statusInfo.name}/${se.status}` : se.status;
          contentLines.push(`- 属性变化: ${statusLabel} ${se.increase ? '+'+se.increase : ''}${se.decrease ? '-'+se.decrease : ''}`);
        }
      }
      if (effect.hpRegen && effect.hpRegen.increase) {
        contentLines.push(`- 生命恢复: +${effect.hpRegen.increase}`);
      }
      if (effect.mpRegen && effect.mpRegen.increase) {
        contentLines.push(`- 法力恢复: +${effect.mpRegen.increase}`);
      }
      if (Array.isArray(effect.actionDurationEffect)) {
        for (const ade of effect.actionDurationEffect) {
          // 动作翻译
          let actionLabel = ade.action;
          if (allGameAction[ade.action]) {
            actionLabel = allGameAction[ade.action].name ? `${allGameAction[ade.action].name}/${ade.action}` : ade.action;
          }
          // @ts-ignore
          let v = ade.increasePercent ? `+${(ade.increasePercent*100).toFixed(2)}%` : ade.decreasePercent ? `-${(ade.decreasePercent*100).toFixed(2)}%` : ade.increase ? `+${ade.increase/1000}s` : ade.decrease ? `-${ade.decrease/1000}s` : '';
          contentLines.push(`- 行动用时变化: ${actionLabel} ${v}`);
        }
      }
      if (Array.isArray(effect.workActionExtEffect)) {
        for (const wae of effect.workActionExtEffect) {
          // 动作翻译
          let actionLabel = wae.action;
          if (allGameAction[wae.action]) {
            // @ts-ignore
            actionLabel = allGameAction[wae.action].name ? `${allGameAction[wae.action].name}/${wae.action}` : wae.action;
          }
          // @ts-ignore
          let v = wae.increasePercent ? `+${(wae.increasePercent*100).toFixed(2)}%` : wae.decreasePercent ? `-${(wae.decreasePercent*100).toFixed(2)}%` : '';
          contentLines.push(`- 行动经验变化: ${actionLabel} ${v}`);
        }
      }
      if (effect.alchemyModify && effect.alchemyModify.mutationPercentIncrease) {
        contentLines.push(`- 炼金台突变概率: +${(effect.alchemyModify.mutationPercentIncrease*100).toFixed(2)}%`);
      }
      // 其他效果可继续补充
    }
    contentLines.push('');
  }



  // 装备回调（allEquipmentTriggerData，强化物品需回溯base）
  let triggerKey = resourceId.split('+')[0];
  if (allEquipmentTriggerData && allEquipmentTriggerData[triggerKey]) {
    const triggerInfo = allEquipmentTriggerData[triggerKey];
    // @ts-ignore
    const callbackNames = Object.keys(triggerInfo).filter(k => typeof triggerInfo[k] === 'function' || (typeof triggerInfo[k] === 'object' && triggerInfo[k] && typeof triggerInfo[k].effect === 'function'));
    if (callbackNames.length > 0) {
      contentLines.push('## 效果触发');
      contentLines.push('');
      contentLines.push('| 触发时点 |');
      contentLines.push('|---|');
      for (const cb of callbackNames) {
        let desc = '';
        // @ts-ignore
        if (typeof triggerInfo[cb] === 'object' && triggerInfo[cb] && typeof triggerInfo[cb].effect === 'function') {
          desc = allBattleHookDescMap['skillOverride'] || '技能重写/Skill Override';
        } else if (allBattleHookDescMap[cb]) {
          desc = allBattleHookDescMap[cb];
        } else {
          desc = '（需补充说明）';
        }
        contentLines.push(`| ${desc} |`);
      }
      contentLines.push('');
    }
  }

  // 用途
  const actionsTo = getActionsUsing(resourceId);
  if (actionsTo.length > 0) {
    contentLines.push('## 用途/Usage');
    contentLines.push('');
    for (const act of actionsTo) {
      contentLines.push(`- [[动作/${act.name}]]`);
    }
    contentLines.push('');
  }

  if (enhanceChainBlock) contentLines.push(enhanceChainBlock);
  return contentLines.join('\n');
}

function main() {
  ensureOutDir();
  for (const [rid, res] of Object.entries(allGameResource)) {
    // 不再只导出装备，所有资源都导出
    const md = buildMarkdown(res, rid);
    const outPath = path.join(OUT_DIR, safeFileName(rid) + '.md');
    fs.writeFileSync(outPath, md, 'utf-8');
  }
  console.log('已导出所有装备类物品到', OUT_DIR);
}

if (require.main === module) main();

export {};