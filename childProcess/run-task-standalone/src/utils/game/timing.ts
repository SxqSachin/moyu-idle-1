type ProbeOptions = {
  global?: boolean;              // global switch
  sampleRate?: number;           // 0..1
  roomWhitelist?: string[];      // fixed rooms to always log
  roomUuid?: string;             // optional room context
  battleUuid?: string;           // optional battle context
  logger?: (msg: string) => void;// default console.debug
  thresholdMs?: number;          // only log when duration >= threshold
};

export type TimingProbe = {
  shouldLog: boolean;
  mark: (label: string) => void;
  logDuration: (from: string, to: string) => void;
};

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function createTimingProbe(name: string, opt: ProbeOptions = {}): TimingProbe {
  const {
    global = true,
    sampleRate = 0.02,
    roomWhitelist = [],
    roomUuid,
    battleUuid,
    logger = (msg: string) => console.log(msg),
    thresholdMs = 0,
  } = opt;

  const shouldLog = !!global && (
    (roomWhitelist.length > 0 && roomUuid ? roomWhitelist.includes(roomUuid) : false) ||
    (roomUuid ? ((stableHash(roomUuid) % 1000) / 1000) < sampleRate : true)
  );

  const marks: Record<string, number> = {};
  const prefix = `[Timing:${name}]`;

  const mark = (label: string) => {
    if (!shouldLog) return;
    marks[label] = Date.now();
  };

  const logDuration = (from: string, to: string) => {
    if (!shouldLog) return;
    const a = marks[from];
    const b = marks[to];
    const duration = (a && b) ? (b - a) : 0;
    if (duration <= 0) return; // 忽略无效时间
    if (thresholdMs && duration < thresholdMs) return; // 低于阈值不打印
    if (a && b) {
      const ctx = `room:${roomUuid ?? '-'}, battle:${battleUuid ?? '-'}`;
      logger(`${prefix} ${from} -> ${to}: ${duration}ms (${ctx})`);
    }
  };

  return { shouldLog, mark, logDuration };
}
