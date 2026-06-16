import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.restoreAllMocks();
  globalThis.__batchRuntimeStarted = undefined;
  globalThis.__batchWorker = undefined;
  if (globalThis.__batchCleanupTimer) {
    clearInterval(globalThis.__batchCleanupTimer);
    globalThis.__batchCleanupTimer = undefined;
  }
});

describe("batch runtime", () => {
  it("recovers and cleans at startup, then cleans periodically", async () => {
    vi.useFakeTimers();
    const store = {
      recoverInterruptedItems: vi.fn(),
      cleanupExpired: vi.fn(),
    };
    vi.doMock("@/lib/batch/batch-store", () => ({
      getBatchStore: () => store,
    }));
    const { ensureBatchRuntimeStarted } = await import("@/lib/batch/runtime");

    ensureBatchRuntimeStarted();
    expect(store.recoverInterruptedItems).toHaveBeenCalledOnce();
    expect(store.cleanupExpired).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(store.cleanupExpired).toHaveBeenCalledTimes(2);

    ensureBatchRuntimeStarted();
    expect(store.recoverInterruptedItems).toHaveBeenCalledOnce();
  });
});
