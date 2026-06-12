import type { BatchJobView, ClaimedBatchItem } from "@/lib/batch-types";
import type { BatchStore } from "@/lib/batch-store";
import type { VerificationResult } from "@/lib/types";

export type BatchProcessor = (
  item: ClaimedBatchItem,
) => Promise<VerificationResult>;

export class BatchWorker {
  private running = false;

  constructor(
    private readonly store: BatchStore,
    private readonly processor: BatchProcessor,
    private readonly concurrency = 4,
  ) {}

  recover() {
    return this.store.recoverInterruptedItems();
  }

  async runUntilIdle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const claimed = Array.from({ length: this.concurrency }, () =>
          this.store.claimPendingItem(),
        ).filter((item): item is ClaimedBatchItem => item !== null);
        if (!claimed.length) break;
        await Promise.all(
          claimed.map(async (item) => {
            try {
              const result = await this.processor(item);
              this.store.completeItem(item, result);
            } catch (error) {
              this.store.failItem(
                item,
                error instanceof Error ? error.message : "Processing failed.",
              );
            }
          }),
        );
      }
    } finally {
      this.running = false;
    }
  }

  getJob(jobId: string): BatchJobView | null {
    return this.store.getJob(jobId);
  }
}
