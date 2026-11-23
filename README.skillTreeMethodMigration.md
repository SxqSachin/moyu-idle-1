# Skill Tree Method-Based API Migration

This document summarizes the refactor from legacy array-based node definitions to the new method-based API.

## Motivation
- Remove direct structural coupling to `levels[]` / `requires[]` arrays.
- Allow future dynamic level definitions (scaling formulas, conditional costs) without rewriting downstream code.
- Centralize types in `shared/types/skillTree.ts` for reuse across server & client.
- Provide a clearer contract for tooling (derivation, validation, aggregation) via `getMaxLevel`, `getLevelDef`, `getRequires`.

## Old vs New
| Aspect | Legacy | New |
| ------ | ------ | --- |
| Level count | `node.maxLevel` (redundant) & `levels.length` | `node.getMaxLevel()` |
| Level data | `node.levels[i]` | `node.getLevelDef(i)` |
| Prereqs for next level | `node.requires` (static list for all future levels) | `node.getRequires(nextLevel)` (nextLevel is 1-based target) |
| Effects iteration | Loop `for i<level: node.levels[i].effects` | Loop `for i<level: node.getLevelDef(i).effects` |
| Business effects | `businessEffects()` (unchanged) | Same (unchanged) |
| Flags & multipliers | Flat/percent/flag objects with legacy fields | Normalized `StatEffect` (`key`, `kind`, `value`) |

## Core Types (New)
Defined in `shared/types/skillTree.ts`:
- `SkillTreeNode`
- `SkillTreeLevelDef { cost, effects }`
- `StatEffect` union (`flat | percentAdd | percentMul | flag`)
- `SkillTreeRequirement` union (`node | skillPointsSpent | attribute | status | flag | notWith`)

## Transitional Helper
`buildNodeFromArrays({...})` converts legacy-like definitions into method-based nodes while preserving original arrays in `_legacyLevelsArray` for optional introspection until fully removed.

## Aggregators Updated
- Server file `server/utils/game/skillTree.ts` now iterates via method API.
- Numeric multiplier accumulation uses `(1 + value)` chaining for `percentMul`.
- Flags stored by `key` instead of legacy `flag` property.

## Utility Display Functions Updated
`shared/utils/skillTreeEffects.ts` consumes new `StatEffect` shape & method API.

## Derivation
Auto-derivation currently still runs on legacy node definitions *before* transformation (safe because we run derivation first, then wrap). A future improvement can implement a second pass directly on method nodes using `enumerateLevelDefs(node)` helper.

## How To Use (Examples)
```ts
function totalCost(node: SkillTreeNode, owned: number) {
  let sum = 0; for (let i=0;i<owned;i++) sum += node.getLevelDef(i).cost; return sum;
}

function canBuyNext(node: SkillTreeNode, owned: number, ctx: Ctx) {
  const reqs = node.getRequires(owned + 1) || [];
  // run requirement evaluation similar to checkPrerequisites
}
```

## Migration Checklist for New Code
- DO NOT access `node.levels` or `node.requires` directly.
- Use `getLevelDef(i)` and `getRequires(nextLevel)`.
- For iteration: `for (let i=0;i<node.getMaxLevel();i++) { ... }`.
- For inspecting all effects of owned levels: loop 0..owned-1 and accumulate.

## Future Extensions Enabled
- Dynamic prerequisite scaling by level (different prereqs for higher levels).
- Procedural level definitions (generate on the fly) without changing consumer code.
- Lazy loading large effect sets.

## Clean-Up Plan
- Remove legacy interfaces & `_legacy*` fields once all node declarations authored directly with method factory or native interface.
- Move auto-derivation to operate after transformation or refactor to accept `SkillTreeNode` directly.

## Known Gaps / TODO
- Rebuild reverse dependency map using all potential level prereqs if they diverge across levels (currently only level 1).
- Provide validation script to ensure `getRequires()` stable for initial levels where legacy design assumed uniform requirements.

## Contact
Add questions / adjustments inside `shared/types/skillTree.ts` or open an issue referencing this doc.
