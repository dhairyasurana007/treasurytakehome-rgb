"use client";

import { useState, type FormEvent } from "react";

import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";

const applicationData = {
  beverage_type: "distilled_spirits",
  values: {
    brand_name: "OLD TOM DISTILLERY",
    class_type: "Kentucky Straight Bourbon Whiskey",
    abv: "45%",
    net_contents: "750 mL",
    bottler: "Old Tom Distillery, Louisville, KY",
    country: "United States",
    government_warning: CANONICAL_GOVERNMENT_WARNING,
  },
  applicability: {
    brand_name: true,
    class_type: true,
    abv: true,
    net_contents: true,
    bottler: true,
    country: true,
    government_warning: true,
  },
};

export default function ProviderHarness() {
  const [scenario, setScenario] = useState("success");
  const [message, setMessage] = useState("Choose a test image.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("applicationData", JSON.stringify(applicationData));
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "x-test-provider-scenario": scenario },
      body: form,
    });
    const body = (await response.json()) as {
      overall_status?: string;
      error?: string;
    };
    setMessage(
      response.ok
        ? `Verification complete: ${body.overall_status}.`
        : `Verification failed: ${body.error}`,
    );
  }

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Provider response harness</h1>
      <form className="validation-harness" onSubmit={submit}>
        <label htmlFor="provider-image">Test image</label>
        <input id="provider-image" name="image" type="file" required />
        <label htmlFor="provider-scenario">Provider scenario</label>
        <select
          id="provider-scenario"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          <option value="success">Success</option>
          <option value="error">Provider error</option>
        </select>
        <button type="submit">Run verification</button>
      </form>
      <p aria-live="polite" data-testid="provider-result">
        {message}
      </p>
    </main>
  );
}
