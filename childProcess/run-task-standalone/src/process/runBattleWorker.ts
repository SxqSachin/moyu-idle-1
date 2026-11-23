// Worker wrapper that supports both Node `worker_threads` workers and
// Bun's Web Worker implementation. Bun's Worker does not support passing
// initial `workerData`, so we accept parameters via a message.
import * as mod from "./runBattle";

async function runOnce(roomUuid: string) {
  try {
    // const mod = await import('./runBattle');
    const runBattle = mod.runBattle;
    if (typeof runBattle !== "function") {
      throw new Error("runBattle not found");
    }
    await runBattle(roomUuid);

    // console.log('runBattleWorker running for room:', roomUuid, mod.runBattle);

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

// Bun Web Worker path: listen for message events and execute when a
// `{ roomUuid }` message is received.
self.addEventListener("message", async (e: any) => {
  const data = e && e.data;
  const roomUuid = data && data.roomUuid;
  if (!roomUuid) {
    self.postMessage({ ok: false, reason: "no_room" });
    return;
  }
  const res = await runOnce(roomUuid);
  self.postMessage(res);
});