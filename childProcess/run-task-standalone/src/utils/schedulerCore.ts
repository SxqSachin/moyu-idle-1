// import { performance } from 'perf_hooks';

export function createMonotonicNow() {
  const epochOffset = Date.now() - performance.now();
  return () => epochOffset + performance.now();
}

export function createSmartSleep() {
  let resolver: (() => void) | null = null;
  return {
    sleep(ms: number) {
      return new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          if (resolver === resolve) resolver = null;
          resolve();
        }, ms);
        resolver = () => {
          clearTimeout(timer);
          resolver = null;
          resolve();
        };
      });
    },
    wake() {
      resolver?.();
    },
  };
}

export function hashStringToPositive(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h >>> 0);
}

export function alignNextStartAtOrAfter(now: number, phaseMs: number, interval: number): number {
  const k = Math.floor((now - phaseMs) / interval);
  let t = k * interval + phaseMs;
  if (t < now) t += interval;
  return t;
}

export function alignPrevStartAtOrBefore(now: number, phaseMs: number, interval: number): number {
  const k = Math.floor((now - phaseMs) / interval);
  return k * interval + phaseMs;
}

export class ScheduleMinHeap<T extends { roomUuid: string; nextScheduledStartMs: number }> {
  private a: string[] = [];
  private pos = new Map<string, number>();
  constructor(private getSchedule: (roomUuid: string) => T | undefined) {}

  private less(i: number, j: number): boolean {
    const si = this.getSchedule(this.a[i])!;
    const sj = this.getSchedule(this.a[j])!;
    return si.nextScheduledStartMs < sj.nextScheduledStartMs;
  }
  private swap(i: number, j: number) {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
    this.pos.set(this.a[i], i);
    this.pos.set(this.a[j], j);
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p); i = p;
    }
  }
  private down(i: number) {
    const n = this.a.length;
    while (true) {
      let m = i;
      const l = i * 2 + 1, r = l + 1;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m); i = m;
    }
  }

  size() { return this.a.length; }
  peekRoom(): string | undefined { return this.a[0]; }
  peekTime(): number | undefined {
    const r = this.peekRoom(); if (!r) return undefined;
    return this.getSchedule(r)!.nextScheduledStartMs;
  }

  has(roomUuid: string) { return this.pos.has(roomUuid); }

  push(roomUuid: string): void {
    if (this.pos.has(roomUuid)) return this.update(roomUuid);
    this.a.push(roomUuid);
    this.pos.set(roomUuid, this.a.length - 1);
    this.up(this.a.length - 1);
  }
  update(roomUuid: string): void {
    const i = this.pos.get(roomUuid);
    if (i == null) return this.push(roomUuid);
    this.up(i); this.down(i);
  }
  remove(roomUuid: string): void {
    const i = this.pos.get(roomUuid);
    if (i == null) return;
    const n = this.a.length - 1;
    if (i !== n) this.swap(i, n);
    this.a.pop();
    this.pos.delete(roomUuid);
    if (i !== n) this.down(i);
  }
  pop(): string | undefined {
    const top = this.peekRoom();
    if (top == null) return undefined;
    this.remove(top);
    return top;
  }
}
