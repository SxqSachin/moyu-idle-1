import type { LearnedSkillFlatItem, SkillTreeNode, StatEffect } from '~/shared/types/skillTree'

// With simplified StatEffect (only desc), computed aggregation for numeric stats is deprecated.
// Keep a minimal structure for UI compatibility.
export interface ComputedNodeEffects { level: number; lines: string[] }

// Legacy labels removed – numeric/stat translation no longer needed here.

export function computeNodeEffects(node: SkillTreeNode, level: number): ComputedNodeEffects {
  const lvl = Math.max(0, Math.min(level, node.maxLevel))
  const lines: string[] = []
  for (let i = 0; i < lvl; i++) {
    const lvDef = node.getLevelDef(i)
    if (!lvDef) continue
    const eff = lvDef.effects as StatEffect | undefined
    if (eff && eff.desc) lines.push(eff.desc)
  }
  return { level: lvl, lines }
}

export interface FormattedEffectLine { text: string; kind: string }

export function formatEffectsForDisplay(node: SkillTreeNode, level: number): FormattedEffectLine[] {
  const comp = computeNodeEffects(node, level)
  if (comp.level === 0) return []
  return comp.lines.map(t => ({ kind: 'desc', text: t }))
}

export function formatNextLevelDelta(node: SkillTreeNode, currentLevel: number): FormattedEffectLine[] {
  const cur = computeNodeEffects(node, currentLevel)
  const next = computeNodeEffects(node, currentLevel + 1)
  if (next.level <= cur.level) return []
  const lvDef = node.getLevelDef(currentLevel)
  const eff = lvDef?.effects as StatEffect | undefined
  if (eff?.desc) return [{ kind: 'desc', text: eff.desc }]
  return []
}

export function labelStat(stat: string) { return stat }

export function findSkillNodeInfo(learnedSkill: LearnedSkillFlatItem[] | undefined, id: string): LearnedSkillFlatItem | undefined {
  if (!learnedSkill) return undefined
  return learnedSkill.find(s => s.nodeId === id)
}