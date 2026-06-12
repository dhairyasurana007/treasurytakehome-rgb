import fs from "node:fs";

import { getBatchStore } from "@/lib/batch-store";
import {
  BatchProcessingError,
  BatchWorker,
} from "@/lib/batch-worker";
import { compareFields } from "@/lib/compare";
import {
  extractLabelFields,
  ExtractionConfigurationError,
  ExtractionProviderError,
} from "@/lib/extract";
import { validateImageBytes } from "@/lib/image-validation";
import { ValidationError } from "@/lib/validation-error";

declare global {
  var __batchRuntimeStarted: boolean | undefined;
  var __batchCleanupTimer: NodeJS.Timeout | undefined;
  var __batchWorker: BatchWorker | undefined;
}

function getWorker() {
  if (!globalThis.__batchWorker) {
    const store = getBatchStore();
    globalThis.__batchWorker = new BatchWorker(
      store,
      async (item) => {
        if (
          process.env.ENABLE_TEST_HARNESS === "true" &&
          item.filename.toLowerCase().includes("retry-once") &&
          item.attemptCount === 1
        ) {
          throw new BatchProcessingError(
            "Fixture item requires a manual retry.",
            "permanent",
          );
        }
        if (
          process.env.ENABLE_TEST_HARNESS === "true" &&
          item.filename.toLowerCase().includes("slow")
        ) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        try {
          const validated = validateImageBytes(fs.readFileSync(item.imagePath));
          const extracted = await extractLabelFields(validated.bytes, {
            mimeType: validated.mimeType,
          });
          return compareFields(extracted, item.application);
        } catch (error) {
          if (error instanceof ValidationError) {
            throw new BatchProcessingError(error.message, "validation");
          }
          if (error instanceof ExtractionConfigurationError) {
            throw new BatchProcessingError(
              "Label analysis is not configured.",
              "authentication",
            );
          }
          if (error instanceof ExtractionProviderError) {
            throw new BatchProcessingError(
              "The label could not be analyzed.",
              "transient",
            );
          }
          throw error;
        }
      },
      { concurrency: Number(process.env.BATCH_CONCURRENCY ?? 4) },
    );
  }
  return globalThis.__batchWorker;
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

export function runBatchWorker() {
  ensureBatchRuntimeStarted();
  void getWorker().runUntilIdle();
}
