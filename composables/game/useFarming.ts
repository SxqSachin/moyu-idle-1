import { ref, computed } from "vue";
import { ElNotification } from 'element-plus';
import type { FarmPlotDTO, ReqFarmPlots, ReqUnlockPlot, ReqPlantPlot, ReqHarvestPlot, ReqToggleAutoReplant, ReqCreatePlot, ReqShovelPlot } from "~/shared/types/farming";
import {
  emitFarmGetPlots,
  emitFarmUnlockPlot,
  emitFarmPlantPlot,
  emitFarmHarvest,
  emitFarmToggleAutoReplant,
  onFarmPlotsSuccess,
  onFarmPlotsFail,
  onFarmUnlockSuccess,
  onFarmUnlockFail,
  onFarmPlantSuccess,
  onFarmPlantFail,
  onFarmHarvestSuccess,
  onFarmHarvestFail,
  onFarmAutoReplantSuccess,
  onFarmAutoReplantFail,
  emitFarmCreatePlot,
  onFarmCreatePlotSuccess,
  onFarmCreatePlotFail,
  emitFarmShovel,
  onFarmShovelSuccess,
  onFarmShovelFail,
} from "~/api/game/socket/farming";
import { onInventoryModify } from "~/api/game/socket/inventory";
import { allGameResource } from "~/shared/data/allGameResources";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

const plotsRef = ref<FarmPlotDTO[]>([]);
const lastError = ref<string>("");
const isLoading = ref<boolean>(false);

function upsertPlot(plot: FarmPlotDTO | null) {
  if (!plot) return;
  const idx = plotsRef.value.findIndex(p => p.id === plot.id);
  if (idx >= 0) {
    plotsRef.value[idx] = plot;
  } else {
    plotsRef.value.push(plot);
  }
  plotsRef.value.sort((a, b) => (a.area.localeCompare(b.area)) || (a.plotIndex - b.plotIndex));
}

function replaceList(list: (FarmPlotDTO | null)[]) {
  plotsRef.value = list.filter(Boolean) as FarmPlotDTO[];
  plotsRef.value.sort((a, b) => (a.area.localeCompare(b.area)) || (a.plotIndex - b.plotIndex));
}

// Register listeners once per app context
let registered = false;
// 用于在动作（解锁/播种/收获）之后，捕捉一次性的资源增减并弹出提示
type PendingAction = { kind: 'unlock' | 'plant' | 'harvest' | 'shovel' } | null;
const pendingAction = ref<PendingAction>(null);

function formatItemCountInfo(info: ItemCountInfo) {
  const gained: { name: string; count: number }[] = [];
  const consumed: { name: string; count: number }[] = [];
  const ids = Object.keys(info) as (keyof ItemCountInfo)[];
  for (const id of ids) {
    const entry = info[id];
    if (!entry || typeof entry.count !== 'number') continue;
    const res = allGameResource[id as any];
    const name = res?.name ?? String(id);
    if (entry.count > 0) gained.push({ name, count: entry.count });
    if (entry.count < 0) consumed.push({ name, count: Math.abs(entry.count) });
  }
  return { gained, consumed };
}

function ensureListeners() {
  if (registered) return;
  registered = true;

  onFarmPlotsSuccess(({ list }) => {
    isLoading.value = false;
    replaceList(list);
  });
  onFarmPlotsFail(({ msg }) => {
    isLoading.value = false;
    lastError.value = msg;
    if (process.client) ElNotification({ title: '获取田地失败', message: msg, type: 'error', duration: 1500 });
  });

  onFarmUnlockSuccess(({ plot }) => upsertPlot(plot));
  onFarmUnlockFail(({ msg }) => {
    lastError.value = msg;
    if (process.client) ElNotification({ title: '解锁田地失败', message: msg, type: 'error', duration: 1500 });
  });

  onFarmPlantSuccess(({ plot }) => upsertPlot(plot));
  onFarmPlantFail(({ msg }) => {
    lastError.value = msg;
    if (process.client) ElNotification({ title: '播种失败', message: msg, type: 'error', duration: 1500 });
  });

  // tick 相关交互已移除，改为后端定时服务推进

  onFarmHarvestSuccess(({ plot }) => upsertPlot(plot));
  onFarmHarvestFail(({ msg }) => {
    lastError.value = msg;
    if (process.client) ElNotification({ title: '收获失败', message: msg, type: 'error', duration: 1500 });
  });

  onFarmAutoReplantSuccess(({ plot }) => upsertPlot(plot));
  onFarmAutoReplantFail(({ msg }) => {
    lastError.value = msg;
    if (process.client) ElNotification({ title: '自动补种设置失败', message: msg, type: 'error', duration: 1500 });
  });

  onFarmCreatePlotSuccess(({ plot }) => {
    upsertPlot(plot);
  });
  onFarmShovelSuccess(({ plot }) => {
    upsertPlot(plot);
    ElNotification({ title: '清理作物完成', message: `已清空田地 #${plot.plotIndex + 1}`, type: 'success', duration: 1500 });
  });
  onFarmShovelFail(({ msg }) => {
    lastError.value = msg;
    ElNotification({ title: '清理作物失败', message: msg, type: 'error', duration: 1500 });
  });
  onFarmCreatePlotFail(({ msg }) => {
    lastError.value = msg;
    ElNotification({ title: '新建田地失败', message: msg, type: 'error', duration: 1500 });
  });

  // 统一监听背包资源变更；在有待处理动作标记时，展示上下文提示
  onInventoryModify((delta) => {
    if (!pendingAction.value) return;
    const { gained, consumed } = formatItemCountInfo(delta);
    const kind = pendingAction.value.kind;
    pendingAction.value = null; // 仅处理一次

    // 根据动作类型选择要展示的资源方向
    let title = '';
    let parts: string[] = [];
    if (kind === 'unlock' || kind === 'plant') {
      title = kind === 'unlock' ? '解锁成功' : '播种成功';
      if (consumed.length) {
        parts.push(`消耗：${consumed.map(e => `${e.name} x${e.count}`).join('，')}`);
      }
    } else if (kind === 'harvest') {
      title = '收获成功';
      if (gained.length) {
        parts.push(`获得：${gained.map(e => `${e.name} x${e.count}`).join('，')}`);
      }
    } else if (kind === 'shovel') {
      title = '清理作物完成';
      // 清理作物默认无物品变更，这里不展示物品摘要
    }

    if (parts.length && process.client) {
      ElNotification({ title, message: parts.join('\n'), type: 'success', duration: 3000 });
    }
  });
}

export function useFarming() {
  ensureListeners();

  // Actions
  const listPlots = (payload: ReqFarmPlots = {}) => {
    isLoading.value = true;
    emitFarmGetPlots(payload);
  };

  const unlockPlot = (payload: ReqUnlockPlot) => {
    // 标记下一次 inventory 变更用于解锁提示
    pendingAction.value = { kind: 'unlock' };
    return emitFarmUnlockPlot(payload);
  };
  const plantPlot = (payload: ReqPlantPlot) => {
    // 标记下一次 inventory 变更用于播种提示
    pendingAction.value = { kind: 'plant' };
    return emitFarmPlantPlot(payload);
  };
  const harvest = (payload: ReqHarvestPlot) => {
    // 标记下一次 inventory 变更用于收获提示
    pendingAction.value = { kind: 'harvest' };
    return emitFarmHarvest(payload);
  };
  const setAutoReplant = (payload: ReqToggleAutoReplant) => emitFarmToggleAutoReplant(payload);
  const createPlot = (payload: ReqCreatePlot = {}) => emitFarmCreatePlot(payload);
  const shovel = (payload: ReqShovelPlot) => {
    pendingAction.value = { kind: 'shovel' };
    return emitFarmShovel(payload);
  };

  const byArea = computed(() => {
    const m = new Map<string, FarmPlotDTO[]>();
    for (const p of plotsRef.value) {
      if (!m.has(p.area)) m.set(p.area, []);
      m.get(p.area)!.push(p);
    }
    for (const [k, v] of m) v.sort((a, b) => a.plotIndex - b.plotIndex);
    return m;
  });

  const readyPlots = computed(() => plotsRef.value.filter(p => p.state === 'READY'));
  const growingPlots = computed(() => plotsRef.value.filter(p => p.state === 'GROWING'));

  return {
    // state
    plots: plotsRef,
    byArea,
    readyPlots,
    growingPlots,
    isLoading,
    lastError,

    // actions
    listPlots,
    unlockPlot,
    plantPlot,
    harvest,
    shovel,
    setAutoReplant,
    createPlot,
  };
}
