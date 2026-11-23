// Worker 池实现（仅针对 Bun 的 Web Worker）
// 要求：
// - 不使用环境变量，池大小写死或在文件中修改
// - 全部注释为中文
// - 不使用 any 类型
// - 所有 catch 必须包含错误信息并向上抛出

type WorkerMessage = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

interface WorkerLike {
  postMessage(message: unknown): void;
  onmessage?: (e: { data: WorkerMessage }) => void;
  onerror?: (e: { message: string }) => void;
  addEventListener?: (type: string, listener: (e: { data?: WorkerMessage }) => void) => void;
  terminate?: () => void;
}

type WorkerWrapper = {
  id: number;
  worker: WorkerLike;
  busy: boolean;
  currentResolve?: (v: WorkerMessage) => void;
  currentReject?: (e: Error) => void;
  // 空闲回收定时器（当 worker 空闲超过阈值时回收）
  idleTimer?: ReturnType<typeof setTimeout>;
  // 当前任务的超时定时器（任务超时后会 terminate worker）
  currentTaskTimer?: ReturnType<typeof setTimeout>;
  // 当前任务关联的房间 id（可选），用于在异常时上报该任务的上下文
  currentTaskRoom?: string | null;
};

// 池最大容量（如需调整直接修改此处）
const POOL_MAX = 4;

// 空闲 worker 最长保留时间（ms），超过后会 terminate 并从池中移除
const IDLE_TIMEOUT_MS = 60_000; // 60s，可根据实际内存/负载调整

// 单个任务最长执行时间（ms），超过后会 terminate 该 worker 并替换
const TASK_TIMEOUT_MS = 30_000; // 30s，可根据 runBattle 特性调整

let workerSeq = 0;
const allWorkers = new Set<WorkerWrapper>();
const idleWorkers: WorkerWrapper[] = [];
const pendingAcquires: Array<(w: WorkerWrapper) => void> = [];

// worker 异常回报：外部可以注册回调以收到 worker 异常信息，用于清理/修复房间状态
export type WorkerFailureInfo = {
  workerId: number;
  when: 'onerror' | 'timeout' | 'terminated' | 'other';
  reason: string;
  roomUuid?: string | null;
};

let workerFailureHandler: ((info: WorkerFailureInfo) => void) | null = null;
export function setWorkerFailureHandler(fn: (info: WorkerFailureInfo) => void) {
  workerFailureHandler = fn;
}

/**
 * 创建一个新的 WorkerWrapper，并安装消息/错误处理器
 * 若创建失败会抛出带有错误信息的 Error
 */
function createWorkerWrapper(): WorkerWrapper {
  const id = ++workerSeq;
  let rawWorker: WorkerLike;
  try {
    // 使用 Bun 的 Worker 构造器加载 worker 文件
    // 当在构建工具下 this 可能会被替换，依然使用 URL 相对路径
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - 在 Bun 环境 Worker 类型可用
    rawWorker = new Worker(new URL('./runBattleWorker.ts', import.meta.url), {
        // @ts-ignore - 在 Bun 环境 Worker 类型可用
        // smol: true,
    });
  } catch (err) {
    throw new Error('创建 Worker 失败: ' + String(err));
  }

  const wrap: WorkerWrapper = { id, worker: rawWorker, busy: false };

  rawWorker.onmessage = (e) => {
    const msg = e && e.data ? e.data : {};
    if (wrap.currentResolve) {
      // 收到消息，先清理任务超时定时器
      if (wrap.currentTaskTimer) {
        clearTimeout(wrap.currentTaskTimer);
        wrap.currentTaskTimer = undefined;
      }
      const resolve = wrap.currentResolve;
      const reject = wrap.currentReject;
      wrap.currentResolve = undefined;
      wrap.currentReject = undefined;
      wrap.busy = false;
      // 任务完成后清理当前任务关联信息
      wrap.currentTaskRoom = undefined;
      try {
        if (msg.ok) {
          resolve(msg);
        } else if (msg.error) {
          // 对 error 字段做更稳健的字符串化
          const errMsg = typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error);
          if (reject) {
            reject(new Error(errMsg));
          } else {
            // 理论上不应该出现只有 resolve 而没有 reject 的情况，作为兜底我们把错误信息透传回去
            try { resolve({ error: errMsg }); } catch (_) {}
          }
        } else {
          resolve(msg);
        }
      } catch (e) {
        // 如果回调抛出，也只记录，不阻止池的恢复
        try { if (reject) reject(new Error('回调处理错误: ' + String(e))); } catch (_) {}
      }
    }

    // 如果有等待的 acquire，优先交付，否则放入空闲队列并启动空闲回收定时器
    if (pendingAcquires.length > 0) {
      const acq = pendingAcquires.shift()!;
      acq(wrap);
    } else {
      // 启动空闲回收定时器（已有定时器则先清理）
      if (wrap.idleTimer) {
        clearTimeout(wrap.idleTimer);
        wrap.idleTimer = undefined;
      }
      wrap.idleTimer = setTimeout(() => {
        try {
          // 超时回收：终止 worker 并从池移除
          wrap.worker.terminate && wrap.worker.terminate();
        } catch (_) {}
        allWorkers.delete(wrap);
        const idx = idleWorkers.indexOf(wrap);
        if (idx >= 0) idleWorkers.splice(idx, 1);
        // 若池还未满且有等待者，创建替代 worker 并交付
        if (pendingAcquires.length > 0 && allWorkers.size < POOL_MAX) {
          try {
            const nw = createWorkerWrapper();
            allWorkers.add(nw);
            const acq = pendingAcquires.shift()!;
            acq(nw);
          } catch (err) {
            // 创建失败则忽略，等待下一轮
          }
        }
      }, IDLE_TIMEOUT_MS);
      idleWorkers.push(wrap);
    }
  };

  rawWorker.onerror = (e) => {
    const message = (e && typeof e === 'object' && 'message' in (e as any)) ? String((e as any).message) : String(e);
    const err = new Error('Worker 错误: ' + message);
    // 上报给外部注册的回调（若有），便于主进程处理房间状态
    try {
      if (workerFailureHandler) {
        workerFailureHandler({ workerId: wrap.id, when: 'onerror', reason: message, roomUuid: wrap.currentTaskRoom ?? null });
      }
    } catch (_) {}
    // 清理可能存在的定时器
    if (wrap.currentTaskTimer) { clearTimeout(wrap.currentTaskTimer); wrap.currentTaskTimer = undefined; }
    if (wrap.idleTimer) { clearTimeout(wrap.idleTimer); wrap.idleTimer = undefined; }
    if (wrap.currentReject) {
      try { wrap.currentReject(err); } catch (_) {}
      wrap.currentResolve = undefined;
      wrap.currentReject = undefined;
    }
    // 从池中移除该 worker
    allWorkers.delete(wrap);
    const idx = idleWorkers.indexOf(wrap);
    if (idx >= 0) idleWorkers.splice(idx, 1);
    // 如有等待者，尝试创建替代 worker 并交付
    if (pendingAcquires.length > 0 && allWorkers.size < POOL_MAX) {
      try {
        const nw = createWorkerWrapper();
        allWorkers.add(nw);
        const acq = pendingAcquires.shift()!;
        acq(nw);
      } catch (_) {}
    }
  };

  // Bun 在 worker 上会触发 close 事件；通过 addEventListener 监听并统一上报/清理。
  // 这个事件和 onerror 不同：它表示 worker 正在被关闭（例如主线程 terminate/进程退出等），
  // 我们在此处也将其视作需要上报的失败场景，便于主进程对房间做额外处理。
  try {
    if (rawWorker.addEventListener) {
      rawWorker.addEventListener('close', (ev: any) => {
          // 不再通过全局 handler 上报 close 事件；将 close 视作一次任务失败并在下文 reject

        // 清理可能存在的定时器
        if (wrap.currentTaskTimer) { clearTimeout(wrap.currentTaskTimer); wrap.currentTaskTimer = undefined; }
        if (wrap.idleTimer) { clearTimeout(wrap.idleTimer); wrap.idleTimer = undefined; }
        // 如果任务仍未返回，尝试 reject 对应的 Promise
        if (wrap.currentReject) {
          try { wrap.currentReject(new Error('Worker 被关闭 (close event)')); } catch (_) {}
          wrap.currentResolve = undefined;
          wrap.currentReject = undefined;
        }

        // 从池中移除该 worker
        allWorkers.delete(wrap);
        const idx = idleWorkers.indexOf(wrap);
        if (idx >= 0) idleWorkers.splice(idx, 1);

        // 如有等待者，尝试创建替代 worker 并交付
        if (pendingAcquires.length > 0 && allWorkers.size < POOL_MAX) {
          try {
            const nw = createWorkerWrapper();
            allWorkers.add(nw);
            const acq = pendingAcquires.shift()!;
            acq(nw);
          } catch (_) {}
        }
      });
    }
  } catch (_) {}

  allWorkers.add(wrap);
  return wrap;
}

/**
 * 获取一个可用的 worker：优先返回空闲者，否则在池未满时创建新者，
 * 否则排队等待。
 */
function acquireWorker(): Promise<WorkerWrapper> {
  return new Promise((resolve) => {
    if (idleWorkers.length > 0) {
      const w = idleWorkers.shift()!;
      // 获取到空闲 worker，取消其空闲回收定时器
      if (w.idleTimer) { clearTimeout(w.idleTimer); w.idleTimer = undefined; }
      resolve(w);
      return;
    }
    // 若存在已创建但尚未被使用的 worker（prewarmed），优先复用它们以避免再次创建
    for (const w of allWorkers) {
      if (!w.busy && idleWorkers.indexOf(w) === -1) {
        // 该 worker 为预创建但尚未被移动到 idle 队列，直接返回复用
        resolve(w);
        return;
      }
    }
    if (allWorkers.size < POOL_MAX) {
      const nw = createWorkerWrapper();
      resolve(nw);
      return;
    }
    pendingAcquires.push(resolve);
  });
}

/**
 * 分配任务给池中的 Worker 并返回 Worker 的回复信息。
 * 如果发送消息失败会抛出带有错误信息的 Error。
 */
export async function runTaskInPool(roomUuid: string): Promise<WorkerMessage> {
  if (!roomUuid) throw new Error('roomUuid 不能为空');
  const wrapper = await acquireWorker();
//   console.log('分配任务给 Worker #' + wrapper.id + '，处理房间 ' + roomUuid);
  wrapper.busy = true;
  return new Promise<WorkerMessage>((resolve, reject) => {
    wrapper.currentResolve = (v: WorkerMessage) => resolve(v);
    wrapper.currentReject = (e: Error) => reject(e);
    try {
      // 在发送消息前记录当前任务房间，这样若 worker 异常可以知道关联房间
      wrapper.currentTaskRoom = roomUuid;
      wrapper.worker.postMessage({ roomUuid });
      // 启动单任务超时计时器，超时则终止该 worker 并替换
      if (wrapper.currentTaskTimer) { clearTimeout(wrapper.currentTaskTimer); wrapper.currentTaskTimer = undefined; }
      wrapper.currentTaskTimer = setTimeout(() => {
        const terr = new Error('Worker 任务超时: ' + String(TASK_TIMEOUT_MS) + 'ms');
        // 清理当前回调，防止 later double-resolve
        try {
          if (wrapper.currentReject) wrapper.currentReject(terr);
        } catch (_) {}
        wrapper.currentResolve = undefined;
        wrapper.currentReject = undefined;
        wrapper.busy = false;
        // 上报任务超时导致的 worker 终止
        try { if (workerFailureHandler) workerFailureHandler({ workerId: wrapper.id, when: 'timeout', reason: terr.message, roomUuid: wrapper.currentTaskRoom ?? null }); } catch (_) {}
        // 终止并从池中移除该 worker
        try { wrapper.worker.terminate && wrapper.worker.terminate(); } catch (_) {}
        allWorkers.delete(wrapper);
        const idx = idleWorkers.indexOf(wrapper);
        if (idx >= 0) idleWorkers.splice(idx, 1);
        // 尝试补充一个新 worker（若有等待者或维持池容量）
        if (pendingAcquires.length > 0 && allWorkers.size < POOL_MAX) {
          try {
            const nw = createWorkerWrapper();
            allWorkers.add(nw);
            const acq = pendingAcquires.shift()!;
            acq(nw);
          } catch (_) {}
        }
      }, TASK_TIMEOUT_MS);
    } catch (err) {
      wrapper.currentResolve = undefined;
      wrapper.currentReject = undefined;
      wrapper.busy = false;
      reject(new Error('向 Worker 发送消息失败: ' + String(err)));
    }
  });
}

/**
 * 导出池当前大小信息，便于监控
 */
export function getPoolInfo(): { total: number; idle: number } {
  return { total: allWorkers.size, idle: idleWorkers.length };
}

/**
 * 预创建若干 worker 并放入空闲队列，避免首次运行时创建带来的延迟。
 * - count: 希望预创建的数量（上限为 POOL_MAX），不传则使用 POOL_MAX
 * - 此函数尽量容错：创建失败会记录错误但继续尝试，其它成功的 worker 仍会保留
 */
export async function initPool(count?: number): Promise<void> {
  const target = Math.max(0, Math.min(POOL_MAX, count ?? POOL_MAX));
  const toCreate = Math.max(0, target - allWorkers.size);
  if (toCreate <= 0) return;
  for (let i = 0; i < toCreate; i++) {
    try {
      // 预创建 worker，但不将其加入 idle 列表。只有在 worker 首次完成任务并进入 onmessage 路径后
      // 才会被放入 idleWorkers 并启动空闲回收计时器。这避免预热 worker 被立即回收或视为已空闲。
      createWorkerWrapper();
    } catch (err) {
      try {
        // 在库内我们没有 logger（为保持文件独立），使用控制台记录创建错误
        console.error('initPool: 创建 worker 失败:', err);
      } catch (_) {}
    }
  }
}
