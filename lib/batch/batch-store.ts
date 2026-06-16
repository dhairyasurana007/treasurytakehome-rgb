import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type {
  BatchItemStatus,
  BatchJobStatus,
  BatchJobView,
  ClaimedBatchItem,
  NewBatchItem,
} from "@/lib/batch/batch-types";
import type { BatchManifestRow } from "@/lib/batch/csv";
import type { ApplicationData, VerificationResult } from "@/lib/types";

interface ItemRow {
  id: string;
  job_id: string;
  position: number;
  filename: string;
  application_json: string;
  image_path: string;
  status: BatchItemStatus;
  attempt_count: number;
  error: string | null;
  result_json: string | null;
}

interface JobRow {
  id: string;
  status: BatchJobStatus;
  created_at: string;
  expires_at: string;
  total: number;
}

export type JobLookup =
  | { status: "found"; job: BatchJobView }
  | { status: "expired" }
  | { status: "unknown" };

export class BatchStore {
  readonly database: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        manifest_json TEXT,
        job_id TEXT
      );

      CREATE TABLE IF NOT EXISTS draft_files (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        normalized_filename TEXT NOT NULL,
        path TEXT NOT NULL,
        checksum TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        UNIQUE(draft_id, normalized_filename)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        total INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        filename TEXT NOT NULL,
        application_json TEXT NOT NULL,
        image_path TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT,
        error TEXT,
        UNIQUE(job_id, position)
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS results (
        item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tombstones (
        id_hash TEXT PRIMARY KEY,
        expired_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS items_status_idx ON items(status, position);
      CREATE INDEX IF NOT EXISTS items_job_idx ON items(job_id, position);
      CREATE INDEX IF NOT EXISTS jobs_expiry_idx ON jobs(expires_at);
      CREATE INDEX IF NOT EXISTS drafts_expiry_idx ON drafts(expires_at);
    `);
    const draftColumns = this.database
      .prepare("PRAGMA table_info(drafts)")
      .all() as Array<{ name: string }>;
    if (!draftColumns.some((column) => column.name === "manifest_json")) {
      this.database.exec("ALTER TABLE drafts ADD COLUMN manifest_json TEXT");
    }
    if (!draftColumns.some((column) => column.name === "job_id")) {
      this.database.exec("ALTER TABLE drafts ADD COLUMN job_id TEXT");
    }
  }

  createDraft(now = new Date(), retentionHours = 2) {
    const id = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + retentionHours * 3_600_000);
    this.database
      .prepare(
        "INSERT INTO drafts (id, status, created_at, expires_at) VALUES (?, 'active', ?, ?)",
      )
      .run(id, now.toISOString(), expiresAt.toISOString());
    return { id, expiresAt: expiresAt.toISOString() };
  }

  private hashId(id: string) {
    const secret =
      process.env.TOMBSTONE_SECRET ?? "development-only-tombstone-secret";
    return crypto.createHmac("sha256", secret).update(id).digest("hex");
  }

  cleanupExpired(
    now = new Date(),
    tombstoneRetentionHours = Number(
      process.env.TOMBSTONE_RETENTION_HOURS ?? 48,
    ),
  ) {
    const expiredJobs = this.database
      .prepare("SELECT id FROM jobs WHERE expires_at <= ?")
      .all(now.toISOString()) as Array<{ id: string }>;
    const expiredDrafts = this.database
      .prepare(
        "SELECT id FROM drafts WHERE status = 'active' AND expires_at <= ?",
      )
      .all(now.toISOString()) as Array<{ id: string }>;

    const deleteJob = this.database.transaction((jobId: string) => {
      const files = this.database
        .prepare("SELECT image_path FROM items WHERE job_id = ?")
        .all(jobId) as Array<{ image_path: string }>;
      const drafts = this.database
        .prepare("SELECT id FROM drafts WHERE job_id = ?")
        .all(jobId) as Array<{ id: string }>;
      this.database
        .prepare(
          "INSERT OR REPLACE INTO tombstones (id_hash, expired_at) VALUES (?, ?)",
        )
        .run(this.hashId(jobId), now.toISOString());
      this.database.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
      this.database.prepare("DELETE FROM drafts WHERE job_id = ?").run(jobId);
      return {
        files: files.map((file) => file.image_path),
        draftIds: drafts.map((draft) => draft.id),
      };
    });

    for (const job of expiredJobs) {
      const deleted = deleteJob(job.id);
      for (const file of deleted.files) fs.rmSync(file, { force: true });
      for (const draftId of deleted.draftIds) {
        fs.rmSync(
          path.join(
            process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
            "drafts",
            draftId,
          ),
          { recursive: true, force: true },
        );
      }
    }

    for (const draft of expiredDrafts) {
      const files = this.database
        .prepare("SELECT path FROM draft_files WHERE draft_id = ?")
        .all(draft.id) as Array<{ path: string }>;
      this.database.prepare("DELETE FROM drafts WHERE id = ?").run(draft.id);
      for (const file of files) fs.rmSync(file.path, { force: true });
      fs.rmSync(
        path.join(
          process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
          "drafts",
          draft.id,
        ),
        { recursive: true, force: true },
      );
    }

    const tombstoneCutoff = new Date(
      now.getTime() - tombstoneRetentionHours * 3_600_000,
    );
    this.database
      .prepare("DELETE FROM tombstones WHERE expired_at < ?")
      .run(tombstoneCutoff.toISOString());

    return {
      jobs: expiredJobs.length,
      drafts: expiredDrafts.length,
    };
  }

  lookupJob(jobId: string, now = new Date()): JobLookup {
    const row = this.database
      .prepare("SELECT expires_at FROM jobs WHERE id = ?")
      .get(jobId) as { expires_at: string } | undefined;
    if (row && new Date(row.expires_at).getTime() <= now.getTime()) {
      this.cleanupExpired(now);
      return { status: "expired" };
    }
    if (row) {
      const job = this.getJob(jobId);
      return job ? { status: "found", job } : { status: "unknown" };
    }
    const tombstone = this.database
      .prepare("SELECT 1 FROM tombstones WHERE id_hash = ?")
      .get(this.hashId(jobId));
    return tombstone ? { status: "expired" } : { status: "unknown" };
  }

  getDraft(draftId: string) {
    const draft = this.database
      .prepare("SELECT * FROM drafts WHERE id = ?")
      .get(draftId) as
      | {
          id: string;
          status: string;
          expires_at: string;
          manifest_json: string | null;
        }
      | undefined;
    if (!draft) return null;
    const files = this.database
      .prepare(
        "SELECT filename, normalized_filename, path, checksum, mime_type, width, height FROM draft_files WHERE draft_id = ? ORDER BY filename",
      )
      .all(draftId) as Array<{
      filename: string;
      normalized_filename: string;
      path: string;
      checksum: string;
      mime_type: string;
      width: number;
      height: number;
    }>;
    return {
      id: draft.id,
      status: draft.status,
      expiresAt: draft.expires_at,
      manifest: draft.manifest_json
        ? (JSON.parse(draft.manifest_json) as BatchManifestRow[])
        : null,
      files,
    };
  }

  saveDraftManifest(draftId: string, rows: BatchManifestRow[]) {
    return this.database
      .prepare(
        "UPDATE drafts SET manifest_json = ? WHERE id = ? AND status = 'active'",
      )
      .run(JSON.stringify(rows), draftId).changes;
  }

  addDraftFile(
    draftId: string,
    file: {
      filename: string;
      normalizedFilename: string;
      path: string;
      checksum: string;
      mimeType: string;
      width: number;
      height: number;
    },
  ) {
    this.database
      .prepare(`
        INSERT INTO draft_files (
          id, draft_id, filename, normalized_filename, path, checksum,
          mime_type, width, height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        crypto.randomUUID(),
        draftId,
        file.filename,
        file.normalizedFilename,
        file.path,
        file.checksum,
        file.mimeType,
        file.width,
        file.height,
      );
  }

  finalizeDraft(draftId: string, items: NewBatchItem[], now = new Date()) {
    return this.database.transaction(() => {
      const draft = this.database
        .prepare("SELECT status FROM drafts WHERE id = ?")
        .get(draftId) as { status: string } | undefined;
      if (!draft || draft.status !== "active") return null;
      const jobId = this.createJob(items, now);
      this.database
        .prepare(
          "UPDATE drafts SET status = 'consumed', job_id = ? WHERE id = ?",
        )
        .run(jobId, draftId);
      return jobId;
    })();
  }

  createJob(
    items: NewBatchItem[],
    now = new Date(),
    retentionHours = 24,
  ): string {
    const jobId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + retentionHours * 3_600_000);
    const insertJob = this.database.prepare(
      "INSERT INTO jobs (id, status, created_at, expires_at, total) VALUES (?, 'pending', ?, ?, ?)",
    );
    const insertItem = this.database.prepare(`
      INSERT INTO items (
        id, job_id, position, filename, application_json, image_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);
    this.database.transaction(() => {
      insertJob.run(
        jobId,
        now.toISOString(),
        expiresAt.toISOString(),
        items.length,
      );
      items.forEach((item, position) => {
        insertItem.run(
          crypto.randomUUID(),
          jobId,
          position,
          item.filename,
          JSON.stringify(item.application),
          item.imagePath,
        );
      });
    })();
    return jobId;
  }

  recoverInterruptedItems() {
    return this.database
      .prepare(
        "UPDATE items SET status = 'pending', claimed_at = NULL WHERE status = 'processing'",
      )
      .run().changes;
  }

  claimPendingItem(now = new Date()): ClaimedBatchItem | null {
    return this.database.transaction(() => {
      const row = this.database
        .prepare(
          "SELECT * FROM items WHERE status = 'pending' ORDER BY job_id, position LIMIT 1",
        )
        .get() as ItemRow | undefined;
      if (!row) return null;
      const nextAttempt = row.attempt_count + 1;
      this.database
        .prepare(
          "UPDATE items SET status = 'processing', attempt_count = ?, claimed_at = ?, error = NULL WHERE id = ?",
        )
        .run(nextAttempt, now.toISOString(), row.id);
      this.database
        .prepare(
          "INSERT INTO attempts (item_id, attempt_number, started_at, status) VALUES (?, ?, ?, 'processing')",
        )
        .run(row.id, nextAttempt, now.toISOString());
      this.database
        .prepare("UPDATE jobs SET status = 'processing' WHERE id = ?")
        .run(row.job_id);
      return {
        id: row.id,
        jobId: row.job_id,
        position: row.position,
        filename: row.filename,
        application: JSON.parse(row.application_json) as ApplicationData,
        imagePath: row.image_path,
        attemptCount: nextAttempt,
      };
    })();
  }

  completeItem(
    item: ClaimedBatchItem,
    result: VerificationResult,
    now = new Date(),
  ) {
    this.database.transaction(() => {
      this.database
        .prepare(
          "INSERT OR REPLACE INTO results (item_id, result_json, created_at) VALUES (?, ?, ?)",
        )
        .run(item.id, JSON.stringify(result), now.toISOString());
      this.database
        .prepare(
          "UPDATE items SET status = 'completed', claimed_at = NULL, error = NULL WHERE id = ?",
        )
        .run(item.id);
      this.database
        .prepare(
          "UPDATE attempts SET status = 'completed', finished_at = ? WHERE item_id = ? AND attempt_number = ?",
        )
        .run(now.toISOString(), item.id, item.attemptCount);
      this.refreshJobStatus(item.jobId);
    })();
  }

  failItem(item: ClaimedBatchItem, error: string, now = new Date()) {
    this.database.transaction(() => {
      this.database
        .prepare(
          "UPDATE items SET status = 'error', claimed_at = NULL, error = ? WHERE id = ?",
        )
        .run(error, item.id);
      this.database
        .prepare(
          "UPDATE attempts SET status = 'error', error = ?, finished_at = ? WHERE item_id = ? AND attempt_number = ?",
        )
        .run(error, now.toISOString(), item.id, item.attemptCount);
      this.refreshJobStatus(item.jobId);
    })();
  }

  recordAttemptFailure(
    item: ClaimedBatchItem,
    error: string,
    requeue: boolean,
    now = new Date(),
  ) {
    this.database.transaction(() => {
      this.database
        .prepare(
          "UPDATE items SET status = ?, claimed_at = NULL, error = ? WHERE id = ?",
        )
        .run(requeue ? "pending" : "error", error, item.id);
      this.database
        .prepare(
          "UPDATE attempts SET status = 'error', error = ?, finished_at = ? WHERE item_id = ? AND attempt_number = ?",
        )
        .run(error, now.toISOString(), item.id, item.attemptCount);
      if (!requeue) this.refreshJobStatus(item.jobId);
    })();
  }

  requeueFailedItem(itemId: string, jobId?: string) {
    return this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE items
           SET status = 'pending', error = NULL
           WHERE id = ? AND status = 'error' ${jobId ? "AND job_id = ?" : ""}`,
        )
        .run(...(jobId ? [itemId, jobId] : [itemId]));
      if (result.changes && jobId) {
        this.database
          .prepare("UPDATE jobs SET status = 'pending' WHERE id = ?")
          .run(jobId);
      }
      return result.changes;
    })();
  }

  private refreshJobStatus(jobId: string) {
    const remaining = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM items WHERE job_id = ? AND status IN ('pending', 'processing')",
      )
      .get(jobId) as { count: number };
    if (remaining.count === 0) {
      this.database
        .prepare("UPDATE jobs SET status = 'completed' WHERE id = ?")
        .run(jobId);
    }
  }

  getJob(jobId: string): BatchJobView | null {
    const job = this.database
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(jobId) as JobRow | undefined;
    if (!job) return null;
    const items = this.database
      .prepare(`
        SELECT items.*, results.result_json
        FROM items
        LEFT JOIN results ON results.item_id = items.id
        WHERE items.job_id = ?
        ORDER BY items.position
      `)
      .all(jobId) as ItemRow[];
    return {
      id: job.id,
      status: job.status,
      createdAt: job.created_at,
      expiresAt: job.expires_at,
      total: job.total,
      completed: items.filter((item) => item.status === "completed").length,
      errors: items.filter((item) => item.status === "error").length,
      items: items.map((item) => ({
        id: item.id,
        position: item.position,
        filename: item.filename,
        status: item.status,
        attemptCount: item.attempt_count,
        error: item.error,
        result: item.result_json
          ? (JSON.parse(item.result_json) as VerificationResult)
          : null,
      })),
    };
  }

  getJobExportItems(jobId: string) {
    return this.database
      .prepare(
        `SELECT items.position, items.filename, items.application_json,
                items.status, items.error, results.result_json
         FROM items
         LEFT JOIN results ON results.item_id = items.id
         WHERE items.job_id = ?
         ORDER BY items.position`,
      )
      .all(jobId) as Array<{
      position: number;
      filename: string;
      application_json: string;
      status: BatchItemStatus;
      error: string | null;
      result_json: string | null;
    }>;
  }

  close() {
    this.database.close();
  }
}

declare global {
  var __batchStore: BatchStore | undefined;
}

export function getBatchStore() {
  if (!globalThis.__batchStore) {
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    globalThis.__batchStore = new BatchStore(path.join(dataDir, "batch.sqlite"));
  }
  return globalThis.__batchStore;
}
