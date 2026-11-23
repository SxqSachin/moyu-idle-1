import type { AchievementDefinition, AchievementRuleType } from '~/shared/types/achievement';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'collect_iron',
    name: '采集者：铁矿收集者',
    description: '收集 100 块铁矿',
    rule: {
      type: 'resourceCounter',
      key: 'item:iron',
      thresholds: 100
    },
    meta: { persist: true },
    active: true,
  },
  {
    id: 'kill_goblin_100',
    name: '屠戮者：哥布林猎手',
    description: '击杀 100 只哥布林',
    rule: {
      type: 'enemyKillCounter',
      key: 'kill:goblin',
      thresholds: 100
    },
    meta: { persist: true },
    active: true,
  },
];

export const ACHIEVEMENT_MAP_BY_ID: Record<string, AchievementDefinition> = ACHIEVEMENTS.reduce((acc, a) => {
  acc[a.id] = a;
  return acc;
}, {} as Record<string, AchievementDefinition>);

export const ACHIEVEMENTS_BY_RULE_TYPE: Record<AchievementRuleType, AchievementDefinition[]> = ACHIEVEMENTS.reduce((acc, a) => {
  if (a.rule && a.rule.type) {
    const key = a.rule.type;
    acc[key] = acc[key] || [];
    acc[key].push(a);
  }
  return acc;
}, {} as Record<string, AchievementDefinition[]>);

export const ACHIEVEMENT_MAP_BY_KEY: Record<string, AchievementDefinition[]> = ACHIEVEMENTS.reduce((acc, a) => {
  if (a.rule && (a.rule as any).key) {
    const key = (a.rule as any).key as string;
    acc[key] = acc[key] || [];
    acc[key].push(a);
  }
  return acc;
}, {} as Record<string, AchievementDefinition[]>);
