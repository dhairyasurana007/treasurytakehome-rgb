import { describe, expect, it } from "vitest";

import { APP_NAME, HEALTH_PATH } from "@/lib/app-config";

describe("application configuration", () => {
  it("exposes stable service metadata", () => {
    expect(APP_NAME).toBe("TTB Label Verifier");
    expect(HEALTH_PATH).toBe("/api/health");
  });
});
