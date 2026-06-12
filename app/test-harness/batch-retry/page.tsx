import { notFound } from "next/navigation";

import BatchRetryHarness from "./retry-harness";

export const dynamic = "force-dynamic";

export default function BatchRetryHarnessPage() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  return <BatchRetryHarness />;
}
