import { notFound } from "next/navigation";

import ProviderHarness from "./provider-harness";

export const dynamic = "force-dynamic";

export default function ProviderHarnessPage() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  return <ProviderHarness />;
}
