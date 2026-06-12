import { getBatchStore } from "@/lib/batch-store";

declare global {
  var __batchRuntimeStarted: boolean | undefined;
  var __batchCleanupTimer: NodeJS.Timeout | undefined;
}

export function ensureBatchRuntimeStarted() {
  if (globalThis.__batchRuntimeStarted) return;
  globalThis.__batchRuntimeStarted = true;

  const store = getBatchStore();
  store.recoverInterruptedItems();
  store.cleanupExpired();

  globalThis.__batchCleanupTimer = setInterval(
    () => store.cleanupExpired(),
    60_000,
  );
  globalThis.__batchCleanupTimer.unref();
}
