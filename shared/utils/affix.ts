import type {
  AffixDefinition,
  AffixEffectResolved,
  AffixEffectTemplate,
  AffixKeyInstance,
  CharacterAffixInstance,
  RangeOrFixed,
  AffixKeyHooks,
} from "@/shared/types/affix";
import { resolveRange, isNumericRange } from "@/shared/types/affix";

// 递归解析对象中的数值区间，返回确定值对象
function deepResolve(obj: any, rnd: () => number): any {
  if (obj == null) return obj;
  if (typeof obj === "number") return obj;
  if (isNumericRange(obj)) return resolveRange(obj, rnd);
  if (Array.isArray(obj)) return obj.map((x) => deepResolve(x, rnd));
  if (typeof obj === "object") {
    const out: any = Array.isArray(obj) ? [] : {};
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      out[k] = deepResolve(v, rnd);
    }
    return out;
  }
  return obj;
}

// 将模板解析为实例（确定值）
// 取消按稀有度自动放大：定义中的数值即为最终展示与生成范围

export function resolveEffectTemplate(
  tpl: AffixEffectTemplate,
  rnd: () => number = Math.random,
  rarity?: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY"
): AffixEffectResolved {
  const item = tpl as any;
  const { key } = item || ({} as any);

    // 解析 statusEffect（模板允许 RangeOrFixed，实例需要具体数值）
    let statusEffectResolved: any[] | undefined = undefined;
  const seList = (item as any).statusEffect as any[] | undefined;
    if (Array.isArray(seList)) {
      statusEffectResolved = seList.map((se) => {
        if (se && typeof se === "object") {
          if ("increase" in se && se.increase != null) {
            const v = se.increase;
            const val = typeof v === "number" ? v : resolveRange(v, rnd);
            return { status: se.status, increase: val };
          }
          if ("decrease" in se && se.decrease != null) {
            const v = se.decrease;
            const val = typeof v === "number" ? v : resolveRange(v, rnd);
            return { status: se.status, decrease: val };
          }
        }
        return se;
      });
    }

    // 解析通用 payload（可为单值或对象，均支持区间）；
    // 若为对象项且包含 { value, name? }，仅解析 value，实例仅保留数值，元信息在展示时从模板读取
    const payloadRaw = (item as any).payload;
    let payloadResolved: any = undefined;
    if (payloadRaw !== undefined) {
      if (typeof payloadRaw === "number" || isNumericRange(payloadRaw)) {
        payloadResolved =
          typeof payloadRaw === "number"
            ? payloadRaw
            : resolveRange(payloadRaw, rnd);
      } else if (
        payloadRaw &&
        typeof payloadRaw === "object" &&
        !Array.isArray(payloadRaw)
      ) {
        const obj: any = {};
        for (const k of Object.keys(payloadRaw)) {
          const pv: any = (payloadRaw as any)[k];
          if (pv && typeof pv === "object" && "value" in pv) {
            const v = pv.value;
            obj[k] = typeof v === "number" ? v : resolveRange(v, rnd);
          } else {
            obj[k] =
              typeof pv === "number"
                ? pv
                : isNumericRange(pv)
                ? resolveRange(pv, rnd)
                : pv;
          }
        }
        payloadResolved = obj;
      }
    }

    // 解析固定成员 custom（结构与 payload 一致，但推荐使用 custom）
    const customRaw = (item as any).custom;
    let customResolved: any = undefined;
    if (customRaw !== undefined) {
      if (typeof customRaw === "number" || isNumericRange(customRaw)) {
        const val =
          typeof customRaw === "number"
            ? customRaw
            : resolveRange(customRaw, rnd);
        customResolved = Number(
          (Number.isInteger(val) ? val : Number(val)).toFixed(
            Number.isInteger(val) ? 0 : 1
          )
        );
      } else if (
        customRaw &&
        typeof customRaw === "object" &&
        !Array.isArray(customRaw)
      ) {
        const obj: any = {};
        for (const k of Object.keys(customRaw)) {
          const pv: any = (customRaw as any)[k];
          if (pv && typeof pv === "object" && "value" in pv) {
            const v = pv.value;
            const num = typeof v === "number" ? v : resolveRange(v, rnd);
            obj[k] = Number(
              (Number.isInteger(num) ? num : Number(num)).toFixed(
                Number.isInteger(num) ? 0 : 1
              )
            );
          } else {
            const num =
              typeof pv === "number"
                ? pv
                : isNumericRange(pv)
                ? resolveRange(pv, rnd)
                : pv;
            obj[k] =
              typeof num === "number"
                ? Number(
                    (Number.isInteger(num) ? num : Number(num)).toFixed(
                      Number.isInteger(num) ? 0 : 1
                    )
                  )
                : num;
          }
        }
        customResolved = obj;
      }
    }

    // 透传 hooks（函数）到实例层
    const hooks: AffixKeyHooks = {};
    for (const k of Object.keys(item as any)) {
      if (k === "key" || k === "statusEffect") continue;
      const v = (item as any)[k];
      if (typeof v === "function") {
        (hooks as any)[k] = v;
      }
    }

  const inst: any = { key, ...(hooks as any) };
  if (statusEffectResolved) inst.statusEffect = statusEffectResolved;
  if (payloadResolved !== undefined) inst.payload = payloadResolved;
  if (customResolved !== undefined) inst.custom = customResolved;
  return inst as AffixEffectResolved;
}

// 从定义构造一个词条实例（不含 id/用户/角色信息）
export function buildInstanceFromDefinition(
  def: AffixDefinition,
  extra: Partial<
    Omit<CharacterAffixInstance, "affixId" | "rarity" | "effect">
  > = {},
  rnd: () => number = Math.random
): CharacterAffixInstance {
  const effect = resolveEffectTemplate(def.effect, rnd, def.rarity as any);
  return {
    affixId: def.affixId,
    rarity: def.rarity,
    effect,
    ...extra,
  };
}

// 将一组定义解析为词条实例数组（用于 roll 之后的落地）
export function buildInstancesFromDefinitions(
  defs: AffixDefinition[],
  extra: Partial<
    Omit<CharacterAffixInstance, "affixId" | "rarity" | "effect">
  > = {},
  rnd: () => number = Math.random
): CharacterAffixInstance[] {
  return defs.map((d) => buildInstanceFromDefinition(d, extra, rnd));
}

// 从角色词条实例中收集所有 hooks（供引擎注册）
export function collectAffixHooks(
  affixes: CharacterAffixInstance[]
): AffixKeyHooks[] {
  const out: AffixKeyHooks[] = [];
  for (const inst of affixes) {
    const eff = inst.effect as any;
    if (!eff) continue;
    const hooks: AffixKeyHooks = {};
    for (const k of Object.keys(eff)) {
      if (k === "key" || k === "statusEffect") continue;
      const v = eff[k];
      if (typeof v === "function") {
        (hooks as any)[k] = v;
      }
    }
    if (Object.keys(hooks).length > 0) out.push(hooks);
  }
  return out;
}
