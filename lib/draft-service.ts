import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { BatchStore } from "@/lib/batch-store";
import { normalizeBasename, parseBatchCsv } from "@/lib/csv";
import { validateImageBytes, validateImageFile } from "@/lib/image-validation";
import { ValidationError } from "@/lib/validation-error";

function draftDirectory(draftId: string) {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dataDir, "drafts", draftId);
}

export async function storeDraftManifest(
  store: BatchStore,
  draftId: string,
  file: File,
) {
  const draft = store.getDraft(draftId);
  if (!draft || draft.status !== "active") {
    throw new ValidationError("The upload draft was not found.", "draft-not-found");
  }
  const rows = parseBatchCsv(new Uint8Array(await file.arrayBuffer()));
  if (!store.saveDraftManifest(draftId, rows)) {
    throw new ValidationError("The upload draft is no longer active.", "draft-inactive");
  }
  return rows;
}

export async function storeDraftImage(
  store: BatchStore,
  draftId: string,
  file: File,
) {
  const draft = store.getDraft(draftId);
  if (!draft || draft.status !== "active") {
    throw new ValidationError("The upload draft was not found.", "draft-not-found");
  }
  const filename = path.win32.basename(file.name).split("/").pop() ?? "";
  const normalizedFilename = normalizeBasename(filename);
  if (!filename || filename.length > 255) {
    throw new ValidationError("The image filename is invalid.", "invalid-filename");
  }
  if (draft.files.some((item) => item.normalized_filename === normalizedFilename)) {
    throw new ValidationError(
      `The filename ${filename} was uploaded more than once.`,
      "duplicate-filename",
    );
  }
  const validated = await validateImageFile(file);
  const bytes = Buffer.from(validated.bytes);
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const directory = draftDirectory(draftId);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${crypto.randomUUID()}.upload`);
  fs.writeFileSync(filePath, bytes, { flag: "wx" });
  try {
    store.addDraftFile(draftId, {
      filename,
      normalizedFilename,
      path: filePath,
      checksum,
      mimeType: validated.mimeType,
      width: validated.width,
      height: validated.height,
    });
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    throw error;
  }
  return { filename, checksum };
}

export function finalizeDraft(store: BatchStore, draftId: string) {
  const draft = store.getDraft(draftId);
  if (!draft || draft.status !== "active") {
    throw new ValidationError("The upload draft was not found.", "draft-not-found");
  }
  if (!draft.manifest) {
    throw new ValidationError("Upload the CSV manifest first.", "manifest-missing");
  }
  const files = new Map(
    draft.files.map((file) => [file.normalized_filename, file]),
  );
  if (files.size !== draft.manifest.length) {
    throw new ValidationError(
      "The number of uploaded images does not match the CSV.",
      "image-coverage-mismatch",
    );
  }
  const items = draft.manifest.map((row) => {
    const file = files.get(row.normalizedFilename);
    if (!file) {
      throw new ValidationError(
        `No uploaded image matches ${row.filename}.`,
        "image-coverage-mismatch",
      );
    }
    const bytes = fs.readFileSync(file.path);
    validateImageBytes(bytes);
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
    if (checksum !== file.checksum) {
      throw new ValidationError(
        `The uploaded image ${file.filename} failed its checksum verification.`,
        "checksum-mismatch",
      );
    }
    return {
      filename: row.filename,
      application: row.application,
      imagePath: file.path,
    };
  });
  const jobId = store.finalizeDraft(draftId, items);
  if (!jobId) {
    throw new ValidationError("The draft could not be finalized.", "draft-inactive");
  }
  return jobId;
}
