import { notFound } from "next/navigation";

import BatchUploadHarness from "./upload-harness";

export const dynamic = "force-dynamic";

export default function BatchUploadHarnessPage() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  return <BatchUploadHarness />;
}
