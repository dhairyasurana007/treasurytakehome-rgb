"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import LabelPreview from "@/components/single-label/label-preview";
import ResultsPanel from "@/components/single-label/results-panel";
import {
  FIELD_CONFIG,
  INITIAL_APPLICABILITY,
  INITIAL_VALUES,
} from "@/components/single-label/fields";
import type { ApplicationData, VerificationResult } from "@/lib/types";

export default function SingleLabelWorkspace() {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showBboxes, setShowBboxes] = useState(false);
  const [beverageType, setBeverageType] =
    useState<ApplicationData["beverage_type"]>("distilled_spirits");
  const [values, setValues] = useState(INITIAL_VALUES);
  const [applicability, setApplicability] = useState(INITIAL_APPLICABILITY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "results" | "error"
  >("idle");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const startTimeRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [timerLabel, setTimerLabel] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    if (status !== "submitting") return;
    const id = setInterval(() => {
      if (startTimeRef.current) {
        setTimerLabel(
          ((Date.now() - startTimeRef.current) / 1000).toFixed(1) + "s",
        );
      }
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  const applicableCount = useMemo(
    () =>
      FIELD_CONFIG.filter((field) => applicability[field.key]).length + 1,
    [applicability],
  );

  const formIncomplete = useMemo(() => {
    if (!image) return true;
    if (!values.government_warning.trim()) return true;
    return FIELD_CONFIG.some(
      (field) => applicability[field.key] && !values[field.key].trim(),
    );
  }, [image, values, applicability]);

  function handleSelect(file: File) {
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, image: "" }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!image) nextErrors.image = "Choose a label image.";
    else if (image.size > 5 * 1024 * 1024)
      nextErrors.image = "The image must be 5 MB or smaller.";
    for (const field of FIELD_CONFIG) {
      if (applicability[field.key] && !values[field.key].trim()) {
        nextErrors[field.key] = `Enter ${field.label.toLocaleLowerCase()}.`;
      }
    }
    if (!values.government_warning.trim()) {
      nextErrors.government_warning = "Enter the government warning.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate() || !image) return;

    setStatus("submitting");
    setRequestError("");
    setResult(null);
    setElapsedMs(null);
    startTimeRef.current = Date.now();
    const form = new FormData();
    form.set("image", image);
    form.set(
      "applicationData",
      JSON.stringify({
        beverage_type: beverageType,
        values,
        applicability,
      } satisfies ApplicationData),
    );
    form.set("includeBboxes", String(showBboxes));

    try {
      const response = await fetch("/api/verify", { method: "POST", body: form });
      const body = (await response.json()) as VerificationResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error);
      setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()));
      setResult(body);
      setStatus("results");
    } catch (error) {
      setRequestError(
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setStatus("error");
    }
  }

  function reset() {
    setImage(null);
    setPreviewUrl(null);
    setBeverageType("distilled_spirits");
    setValues(INITIAL_VALUES);
    setApplicability(INITIAL_APPLICABILITY);
    setErrors({});
    setResult(null);
    setRequestError("");
    setStatus("idle");
    startTimeRef.current = null;
    setElapsedMs(null);
    setTimerLabel("");
    setShowBboxes(false);
  }

  if (status === "results" && result) {
    return (
      <ResultsPanel
        result={result}
        previewUrl={previewUrl}
        applicableCount={applicableCount}
        elapsedMs={elapsedMs}
        onReset={reset}
      />
    );
  }

  return (
    <form className="single-label-form" onSubmit={submit} noValidate>
      <div className="form-intro">
        <div>
          <p className="section-label">Single label</p>
          <h2>Check one label</h2>
          <p>Complete the two steps below. Required fields are clearly marked.</p>
        </div>
        <span>{applicableCount} fields required</span>
      </div>

      <section className="form-section" aria-labelledby="artwork-heading">
        <div className="step-heading">
          <span>1</span>
          <div>
            <h3 id="artwork-heading">Add the label artwork</h3>
            <p>JPEG, PNG, or WebP. Maximum 5 MB and 25 megapixels.</p>
          </div>
        </div>
        <LabelPreview
          previewUrl={previewUrl}
          invalid={Boolean(errors.image)}
          onSelect={handleSelect}
        />
        {errors.image && <p className="field-error">{errors.image}</p>}
      </section>

      <section className="form-section" aria-labelledby="application-heading">
        <div className="step-heading">
          <span>2</span>
          <div>
            <h3 id="application-heading">Enter the application details</h3>
            <p>Use the values from the submitted application.</p>
          </div>
        </div>

        <div className="field-grid">
          <div className="field-group full-width">
            <label htmlFor="beverage-type">Beverage type</label>
            <select
              id="beverage-type"
              value={beverageType}
              onChange={(event) =>
                setBeverageType(
                  event.target.value as ApplicationData["beverage_type"],
                )
              }
            >
              <option value="distilled_spirits">Distilled spirits</option>
              <option value="wine">Wine</option>
              <option value="beer">Beer</option>
            </select>
          </div>

          {FIELD_CONFIG.map((field) => {
            const required = applicability[field.key];
            return (
              <div className="field-group" key={field.key}>
                <div className="field-label-row">
                  <label htmlFor={field.key}>{field.label}</label>
                  <label className="applicability-control">
                    <input
                      type="checkbox"
                      aria-label={`${field.label} required on this application`}
                      checked={required}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setApplicability((current) => ({
                          ...current,
                          [field.key]: checked,
                        }));
                        if (!checked) {
                          setValues((current) => ({
                            ...current,
                            [field.key]: "",
                          }));
                          setErrors((current) => ({
                            ...current,
                            [field.key]: "",
                          }));
                        }
                      }}
                    />
                    Required on this application
                  </label>
                </div>
                <input
                  id={field.key}
                  value={values[field.key]}
                  placeholder={field.placeholder}
                  disabled={!required}
                  aria-invalid={Boolean(errors[field.key])}
                  aria-describedby={
                    errors[field.key] ? `${field.key}-error` : undefined
                  }
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                    setErrors((current) => ({
                      ...current,
                      [field.key]: "",
                    }));
                  }}
                />
                {errors[field.key] && (
                  <p className="field-error" id={`${field.key}-error`}>
                    {errors[field.key]}
                  </p>
                )}
              </div>
            );
          })}

          <div className="field-group full-width">
            <div className="field-label-row">
              <label htmlFor="government_warning">Government warning</label>
              <span className="always-required">Always required</span>
            </div>
            <textarea
              id="government_warning"
              rows={5}
              value={values.government_warning}
              aria-invalid={Boolean(errors.government_warning)}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  government_warning: event.target.value,
                }))
              }
            />
            {errors.government_warning && (
              <p className="field-error">{errors.government_warning}</p>
            )}
          </div>
        </div>
      </section>

      {status === "error" && (
        <div className="request-error" role="alert">
          <strong>We could not complete the check.</strong>
          <p>{requestError}</p>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status === "submitting" ? "Analyzing label, please wait." : ""}
      </p>

      <div className="form-actions">
        <p>Your image is used only to complete this verification.</p>
        <div className="verify-controls">
          <div className="verify-buttons">
            <button
              type="button"
              role="switch"
              aria-checked={showBboxes}
              className={`bbox-toggle${showBboxes ? " is-on" : ""}`}
              onClick={() => setShowBboxes((value) => !value)}
              disabled={status === "submitting"}
            >
              <span className="bbox-toggle-track" aria-hidden="true">
                <span className="bbox-toggle-thumb" />
              </span>
              Show bounding boxes
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={status === "submitting" || formIncomplete}
              {...(status === "submitting" ? { "data-submitting": "" } : {})}
            >
              {status === "submitting"
                ? `Analyzing label… ${timerLabel}`
                : "Verify label"}
            </button>
          </div>
          {showBboxes && (
            <p className="bbox-latency-note" role="note">
              Note: generating bounding boxes will take longer than 5s.
            </p>
          )}
          <p className="bbox-experimental-note">
            The bounding boxes feature is currently experimental.
          </p>
        </div>
      </div>
    </form>
  );
}
