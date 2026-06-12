import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BatchStore } from "@/lib/batch-store";
import {
  finalizeDraft,
  storeDraftImage,
  storeDraftManifest,
} from "@/lib/draft-service";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const warning =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
const csv = Buffer.from(
  `filename,beverage_type,brand_name,class_type,abv,net_contents,bottler,country,government_warning\nlabel.png,distilled_spirits,Brand,Bourbon,45%,750 mL,Bottler,USA,"${warning}"`,
);

let directory: string;
let store: BatchStore;
let originalDataDir: string | undefined;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "draft-service-"));
  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  store = new BatchStore(path.join(directory, "test.sqlite"));
});

afterEach(() => {
  store.close();
  process.env.DATA_DIR = originalDataDir;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("atomic draft finalization", () => {
  it("creates a visible job only after full durable coverage", async () => {
    const draft = store.createDraft();
    await storeDraftManifest(
      store,
      draft.id,
      new File([csv], "manifest.csv", { type: "text/csv" }),
    );
    expect(() => finalizeDraft(store, draft.id)).toThrow("does not match");
    await storeDraftImage(
      store,
      draft.id,
      new File([PNG_1X1], "LABEL.PNG", { type: "text/plain" }),
    );
    const jobId = finalizeDraft(store, draft.id);
    expect(store.getJob(jobId)).toMatchObject({ total: 1, status: "pending" });
    expect(store.getDraft(draft.id)?.status).toBe("consumed");
  });

  it("rejects duplicate uploaded basenames", async () => {
    const draft = store.createDraft();
    await storeDraftImage(
      store,
      draft.id,
      new File([PNG_1X1], "Label.png"),
    );
    await expect(
      storeDraftImage(store, draft.id, new File([PNG_1X1], "label.PNG")),
    ).rejects.toThrow("more than once");
  });

  it("rejects checksum changes before job creation", async () => {
    const draft = store.createDraft();
    await storeDraftManifest(store, draft.id, new File([csv], "manifest.csv"));
    await storeDraftImage(store, draft.id, new File([PNG_1X1], "label.png"));
    const filePath = store.getDraft(draft.id)?.files[0].path;
    fs.appendFileSync(filePath!, "tampered");
    expect(() => finalizeDraft(store, draft.id)).toThrow("checksum");
  });
});
