import { useState } from '#app'
import { emitGetKittyTraits, emitAddKittyTrait, emitRemoveKittyTrait, emitAddKittyTraitExp, onGetKittyTraitsSuccess, onGetKittyTraitsError, onAddKittyTraitSuccess, onAddKittyTraitError, onRemoveKittyTraitSuccess, onRemoveKittyTraitError, onAddKittyTraitExpSuccess, onAddKittyTraitExpError } from '~/api/game/socket/kittyTraits'
import type { KittyTraitRow } from '~/api/game/socket/kittyTraits'
import { ElNotification } from 'element-plus'

const GLOBAL_KEY = '__moyu_global_kitty_traits_listeners__'

/**
 * Register the global socket listeners for kitty traits once. Components that only need
 * business methods can call `useKittyTraits()` without registering listeners.
 * Returns an unregister function.
 */
export function registerKittyTraitsListeners() {
  const g = globalThis as any
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY]

  const state = useState<Record<string, KittyTraitRow[]>>('kittyTraits', () => ({}))
  const stateRef = state as any

  const unsubs: Array<() => void> = []

  const u1 = onGetKittyTraitsSuccess(({ list }: any) => {
    if (!list) return
    for (const r of list) {
      stateRef.value[r.kittyUuid] = list.filter((x: any) => x.kittyUuid === r.kittyUuid)
    }
  })
  unsubs.push(u1)

  const u2 = onGetKittyTraitsError(() => {
    ElNotification({ title: '获取特性失败', message: '获取特性失败，请稍后重试', type: 'error', duration: 3000 })
  })
  unsubs.push(u2)

  const u3 = onAddKittyTraitSuccess(({ row }: any) => {
    if (!row) return
    const arr = stateRef.value[row.kittyUuid] ?? []
    stateRef.value[row.kittyUuid] = [...arr.filter((x: any) => x.traitId !== row.traitId), row]
    ElNotification({ title: '添加特性', message: '已成功为猫咪添加特性', type: 'success', duration: 2000 })
  })
  unsubs.push(u3)

  const u4 = onAddKittyTraitError(({ message }: any) => {
    ElNotification({ title: '添加特性失败', message: message || '添加失败', type: 'error', duration: 3000 })
  })
  unsubs.push(u4)

  const u5 = onRemoveKittyTraitSuccess(({ kittyUuid, traitId }: any) => {
    const arr = stateRef.value[kittyUuid] ?? []
    stateRef.value[kittyUuid] = arr.filter((x: any) => x.traitId !== traitId)
    ElNotification({ title: '移除特性', message: '特性已移除', type: 'success', duration: 2000 })
  })
  unsubs.push(u5)

  const u6 = onRemoveKittyTraitError(({ message }: any) => {
    ElNotification({ title: '移除失败', message: message || '移除特性失败', type: 'error', duration: 3000 })
  })
  unsubs.push(u6)

  const u7 = onAddKittyTraitExpSuccess((data: any) => {
    if (!data || !data.row) return
    const row: KittyTraitRow = data.row
    const arr = stateRef.value[row.kittyUuid] ?? []
    stateRef.value[row.kittyUuid] = [...arr.filter((x: any) => x.traitId !== row.traitId), row]
    if (data.leveled && Array.isArray(data.leveled) && data.leveled.length) {
      ElNotification({ title: '特性升级', message: `特性升级: ${data.leveled.map((l: any) => `${l.fromLevel}→${l.toLevel}`).join(', ')}`, type: 'success', duration: 3000 })
    } else {
      ElNotification({ title: '获得经验', message: '为特性添加了经验', type: 'success', duration: 2000 })
    }
  })
  unsubs.push(u7)

  const u8 = onAddKittyTraitExpError(({ message }: any) => {
    ElNotification({ title: '添加经验失败', message: message || '添加经验失败', type: 'error', duration: 3000 })
  })
  unsubs.push(u8)

  const dispose = () => {
    unsubs.forEach(u => u && u())
    delete g[GLOBAL_KEY]
  }

  g[GLOBAL_KEY] = dispose
  return dispose
}

export const useKittyTraits = () => {
  const state = useState<Record<string, KittyTraitRow[]>>('kittyTraits', () => ({}))

  const fetch = (kittyUuid?: string) => emitGetKittyTraits(kittyUuid)
  const addTrait = (kittyUuid: string, traitId: string, initialLevel?: number) => emitAddKittyTrait(kittyUuid, traitId, initialLevel)
  const removeTrait = (kittyUuid: string, traitId: string) => emitRemoveKittyTrait(kittyUuid, traitId)
  const addExp = (kittyUuid: string, traitId: string, addExp: number) => emitAddKittyTraitExp(kittyUuid, traitId, addExp)

  return {
    state,
    fetch,
    addTrait,
    removeTrait,
    addExp,
  }
}

export default useKittyTraits
