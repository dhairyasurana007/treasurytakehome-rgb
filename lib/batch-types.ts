import type { ApplicationData, VerificationResult } from "@/lib/types";

export type BatchItemStatus = "pending" | "processing" | "completed" | "error";
export type BatchJobStatus = "pending" | "processing" | "completed";

export interface NewBatchItem {
  filename: string;
  application: ApplicationData;
  imagePath: string;
}

export interface ClaimedBatchItem extends NewBatchItem {
  id: string;
  jobId: string;
  position: number;
  attemptCount: number;
}

export interface BatchItemView {
  id: string;
  position: number;
  filename: string;
  status: BatchItemStatus;
  attemptCount: number;
  error: string | null;
  result: VerificationResult | null;
}

export interface BatchJobView {
  id: string;
  status: BatchJobStatus;
  createdAt: string;
  expiresAt: string;
  total: number;
  completed: number;
  errors: number;
  items: BatchItemView[];
}
