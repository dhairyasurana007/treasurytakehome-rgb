import { NextResponse } from "next/server";

import { FIXTURE_ITEMS } from "@/lib/batch-fixtures";
import { getBatchStore } from "@/lib/batch-store";

function disabled() {
  return process.env.ENABLE_TEST_HARNESS !== "true";
}

export function POST() {
  if (disabled()) return new NextResponse(null, { status: 404 });
  const store = getBatchStore();
  const expiredAt = new Date(Date.now() - 3_600_000);
  const jobId = store.createJob(FIXTURE_ITEMS, expiredAt, 0);
  const lookup = store.lookupJob(jobId, new Date());
  return NextResponse.json({
    jobId,
    lookup: lookup.status,
    retained: store.database
      .prepare(
        "SELECT COUNT(*) AS count FROM jobs WHERE id = ? OR EXISTS (SELECT 1 FROM items WHERE job_id = ?)",
      )
      .get(jobId, jobId),
  });
}
