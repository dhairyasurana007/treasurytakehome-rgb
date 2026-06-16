import { NextResponse } from "next/server";

import { getBatchStore } from "@/lib/batch/batch-store";
import { buildExportCsv, isPartialExport } from "@/lib/batch/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const lookup = getBatchStore().lookupJob(jobId);
  if (lookup.status === "expired") {
    return NextResponse.json(
      { error: "This batch job has expired." },
      { status: 410 },
    );
  }
  if (lookup.status === "unknown") {
    return NextResponse.json(
      { error: "This batch job was not found." },
      { status: 404 },
    );
  }

  const items = getBatchStore().getJobExportItems(jobId);
  const partial = isPartialExport(items);
  const csv = buildExportCsv(items);
  const prefix = partial ? "partial-" : "";
  const filename = `${prefix}batch-${jobId.slice(0, 8)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
