import { NextResponse } from "next/server";

import { ensureBatchRuntimeStarted } from "@/lib/runtime";

export function GET() {
  ensureBatchRuntimeStarted();
  return NextResponse.json({
    status: "ok",
    service: "ttb-label-verifier",
  });
}
