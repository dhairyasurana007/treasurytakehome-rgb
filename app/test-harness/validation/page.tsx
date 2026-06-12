import { notFound } from "next/navigation";

import ValidationHarness from "./validation-harness";

export const dynamic = "force-dynamic";

export default function ValidationHarnessPage() {
  if (process.env.ENABLE_TEST_HARNESS !== "true") notFound();
  return <ValidationHarness />;
}
