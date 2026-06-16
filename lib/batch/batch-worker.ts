import type { BatchJobView, ClaimedBatchItem } from "@/lib/batch/batch-types";
import type { BatchStore } from "@/lib/batch/batch-store";
import type { VerificationResult } from "@/lib/types";

export type BatchProcessor = (
  item: ClaimedBatchItem,
) => Promise<VerificationResult>;
export type BatchFailureKind =
  | "transient"
  | "rate-limit"
  | "validation"
  | "authentication"
  | "permanent";

export class BatchProcessingError extends Error {
  constructor(
    message: string,
    readonly kind: BatchFailureKind,
  ) {
    super(message);
  }
}

interface WorkerOptions {
  concurrency?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export class BatchWorker {
  private running = false;
  private readonly configuredConcurrency: number;
  private effectiveConcurrency: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly store: BatchStore,
    private readonly processor: BatchProcessor,
    options: number | WorkerOptions = {},
  ) {
    const normalized =
      typeof options === "number" ? { concurrency: options } : options;
    this.configuredConcurrency = Math.max(1, normalized.concurrency ?? 4);
    this.effectiveConcurrency = this.configuredConcurrency;
    this.maxAttempts = normalized.maxAttempts ?? 3;
    this.baseBackoffMs = normalized.baseBackoffMs ?? 250;
    this.sleep = normalized.sleep ?? defaultSleep;
  }

  recover() {
    return this.store.recoverInterruptedItems();
  }

  get concurrency() {
    return {
      configured: this.configuredConcurrency,
      effective: this.effectiveConcurrency,
    };
  }

  async runUntilIdle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const claimed = Array.from({ length: this.effectiveConcurrency }, () =>
          this.store.claimPendingItem(),
        ).filter((item): item is ClaimedBatchItem => item !== null);
        if (!claimed.length) break;
        await Promise.all(claimed.map((item) => this.processItem(item)));
      }
    } finally {
      this.running = false;
    }
  }

  private async processItem(item: ClaimedBatchItem) {
    try {
      const result = await this.processor(item);
      this.store.completeItem(item, result);
      if (this.effectiveConcurrency < this.configuredConcurrency) {
        this.effectiveConcurrency += 1;
      }
    } catch (error) {
      const processingError =
        error instanceof BatchProcessingError
          ? error
          : new BatchProcessingError(
              error instanceof Error ? error.message : "Processing failed.",
              "permanent",
            );
      const retryable =
        processingError.kind === "transient" ||
        processingError.kind === "rate-limit";
      const requeue = retryable && item.attemptCount < this.maxAttempts;
      if (processingError.kind === "rate-limit") {
        this.effectiveConcurrency = Math.max(
          1,
          Math.floor(this.effectiveConcurrency / 2),
        );
      }
      this.store.recordAttemptFailure(item, processingError.message, requeue);
      if (requeue) {
        const retryIndex = item.attemptCount - 1;
        await this.sleep(this.baseBackoffMs * 2 ** retryIndex);
      }
    }
  }

  getJob(jobId: string): BatchJobView | null {
    return this.store.getJob(jobId);
  }
}
