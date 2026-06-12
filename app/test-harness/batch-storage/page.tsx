import { notFound } from "next/navigation";

import BatchStorageHarness from "./storage-harness";

export const dynamic = "force-dynamic";

export default function BatchStorageHarnessPage() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  return <BatchStorageHarness />;
}
