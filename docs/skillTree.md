# 技能树系统接口文档

## 概述
当前支持两棵技能树：
- battle（战斗）
- life（生活）

每棵树点数独立，点数获取由后端 `computeTotalEarnedTreePoints` 计算（基于角色状态等级与属性）。

## 核心概念
- totalEarned: 已“获得”的点数（可随角色发展增加，可重算）
- totalSpent: 历史累计花费（单调递增，不因撤回减少，用于统计）
- effectiveSpent: 当前有效占用（会因撤回减少）
- available = totalEarned - effectiveSpent
- 节点每一级有独立 cost 与 effects 数组
- 回退（deallocate）按最后一级 cost 返还 effectiveSpent，不回退 totalSpent

## Socket 事件一览
| 事件 | 方向 | 描述 |
| ---- | ---- | ---- |
| skillTree:summary | C->S | 请求某棵树当前概览 |
| skillTree:summary:success | S->C | { treeId, summary } |
| skillTree:summary:fail | S->C | { treeId?, msg } |
| skillTree:allocate | C->S | 加点：{ treeId, nodeId } |
| skillTree:allocate:success | S->C | { treeId, nodeId, summary } |
| skillTree:allocate:fail | S->C | { treeId?, nodeId?, msg } |
| skillTree:deallocate | C->S | 撤回：{ treeId, nodeId } |
| skillTree:deallocate:success | S->C | { treeId, nodeId, summary } |
| skillTree:deallocate:fail | S->C | { treeId?, nodeId?, msg } |
| skillTree:effects | C->S | 请求聚合效果：{ treeId } |
| skillTree:effects:success | S->C | { treeId, effects } |
| skillTree:effects:fail | S->C | { treeId?, msg } |

## Summary 数据结构
```ts
interface SkillTreeNodeRuntimeInfo {
  nodeId: string
  level: number
  maxLevel: number
  investedCost: number      // Σ 已升到当前等级的总消耗
  nextCost: number | null   // 下一等级所需点数，满级为 null
  canAllocate: boolean
  canDeallocate: boolean
  unmetReasons: string[]    // 升到下一等级不满足的前置原因
}
interface SkillTreeSummary {
  treeId: 'battle' | 'life'
  totalEarned: number
  totalSpent: number
  effectiveSpent: number
  available: number
  nodes: SkillTreeNodeRuntimeInfo[]
}
```

## 聚合效果结构
```ts
interface AggregatedSkillTreeEffects {
  treeId: 'battle' | 'life'
  flat: Record<string, number>          // flat 累加
  percentAdd: Record<string, number>    // 百分比加法。0.15 = +15%
  percentMul: Record<string, number>    // 乘法存实际乘积。例如 1.10 = +10%（与其它来源再乘）
  flags: string[]                       // 解锁类标记
}
```

## 效果合并逻辑
- flat: 逐节点逐级把 perLevel 累加
- percent(kind=percent, stacking=add): 按 perLevelPercent 累加
- percent(kind=percent, stacking=mul): 以 (1 + perLevelPercent) 累乘
- flag: 去重收集

使用端若需要把 percentMul 转换为最终增益，可计算 (value - 1) 作为乘法增幅。

## 错误处理
常见错误 msg：
- "未知的技能树" / "未知的节点"
- "已达最大等级"
- "可用点数不足"
- 前置不满足时返回首个原因（如："需要节点 b_precision 等级≥3"）
- 撤回被依赖："存在依赖该等级的节点，无法撤回"
- 内部防御性错误：以“内部错误：”前缀（出现即需排查）

## 前端集成建议
1. 首次打开面板：发送 summary 与 effects 两个请求
2. allocate / deallocate 成功后直接用返回的 summary 更新本地；可延迟数百毫秒再请求 effects（若 effects 面板实时显示则立即请求）
3. UI 上建议分层（tier）或按前置连线展示；当前示例组件使用简单表格，可拓展为节点图
4. 若存在多角色：在事件 payload 中附加 characterUuid（后端已支持可选）

## 扩展点
- 可在节点定义中加入 unlockFlags 或 ICON 字段
- 增加树版本号时可做迁移脚本（检测 level 超过新 maxLevel 时降级并返还点数）
- 可添加 bulk allocate 接口（一次升多级）减少网络往返

## 安全/并发
- 分配与撤回均使用分布式锁 + 事务
- ledger 采用 totalSpent(历史) 与 effectiveSpent(当前) 分离，防止重复返还漏洞
- 防御性检查：cost>0、effectiveSpent 不得超出 totalEarned 或 <0

## 示例（成功返回 allocate）
```json
{
  "treeId": "battle",
  "nodeId": "b_attack_focus",
  "summary": {
    "treeId": "battle",
    "totalEarned": 12,
    "totalSpent": 5,
    "effectiveSpent": 5,
    "available": 7,
    "nodes": [ { "nodeId": "b_attack_focus", "level": 2, ... } ]
  }
}
```

## 示例（失败返回 allocate）
```json
{ "treeId": "battle", "nodeId": "b_attack_focus", "msg": "可用点数不足" }
```

---
最后更新时间：自动生成（请根据需要手动更新时间）。
