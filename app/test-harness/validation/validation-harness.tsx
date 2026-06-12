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

export default function ValidationHarness() {
  const [message, setMessage] = useState("Choose a test image.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("applicationData", JSON.stringify(applicationData));
    const response = await fetch("/api/test-harness/validate", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as {
      valid?: boolean;
      error?: string;
      modelSubmitted: boolean;
    };
    setMessage(
      body.valid
        ? `Valid image. Model submitted: ${body.modelSubmitted}.`
        : `${body.error} Model submitted: ${body.modelSubmitted}.`,
    );
  }

  return (
    <main className="harness-shell">
      <p className="section-label">Test environment only</p>
      <h1>Input validation harness</h1>
      <form className="validation-harness" onSubmit={submit}>
        <label htmlFor="validation-image">Test image</label>
        <input
          id="validation-image"
          name="image"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          required
        />
        <button type="submit">Validate upload</button>
      </form>
      <p aria-live="polite" data-testid="validation-result">
        {message}
      </p>
    </main>
  );
}
