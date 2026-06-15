"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { CANONICAL_GOVERNMENT_WARNING } from "@/lib/government-warning";
import type {
  ApplicationData,
  Bbox,
  ConditionalFieldName,
  FieldName,
  VerificationResult,
} from "@/lib/types";

const FIELD_CONFIG: Array<{
  key: ConditionalFieldName;
  label: string;
  placeholder: string;
}> = [
  { key: "brand_name", label: "Brand name", placeholder: "e.g. OLD TOM DISTILLERY" },
  {
    key: "class_type",
    label: "Class or type",
    placeholder: "e.g. Kentucky Straight Bourbon Whiskey",
  },
  { key: "abv", label: "Alcohol content", placeholder: "e.g. 45% Alc./Vol." },
  { key: "net_contents", label: "Net contents", placeholder: "e.g. 750 mL" },
  {
    key: "bottler",
    label: "Bottler or producer name and address",
    placeholder: "e.g. Old Tom Distillery, Louisville, KY",
  },
  {
    key: "country",
    label: "Country of origin",
    placeholder: "e.g. United States",
  },
];

const INITIAL_VALUES: ApplicationData["values"] = {
  brand_name: "",
  class_type: "",
  abv: "",
  net_contents: "",
  bottler: "",
  country: "",
  government_warning: CANONICAL_GOVERNMENT_WARNING,
};

const INITIAL_APPLICABILITY: ApplicationData["applicability"] = {
  brand_name: true,
  class_type: true,
  abv: true,
  net_contents: true,
  bottler: true,
  country: true,
  government_warning: true,
};

function fieldLabel(field: FieldName) {
  return (
    FIELD_CONFIG.find((item) => item.key === field)?.label ??
    "Government warning"
  );
}

export default function SingleLabelWorkspace() {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const [activeField, setActiveField] = useState<FieldName | null>(null);
  const cardRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const boxRefs = useRef<Partial<Record<FieldName, HTMLButtonElement | null>>>(
    {},
  );

  function revealCard(field: FieldName) {
    setActiveField(field);
    cardRefs.current[field]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function revealBox(field: FieldName) {
    setActiveField(field);
    boxRefs.current[field]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

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

  useEffect(() => {
    if (status === "results") resultsHeadingRef.current?.focus();
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
    setActiveField(null);
  }

  if (status === "results" && result) {
    const bboxEntries = result.bboxes
      ? (
          Object.entries(result.bboxes) as [FieldName, Bbox | null | undefined][]
        ).filter(
          (entry): entry is [FieldName, Bbox] =>
            entry[1] != null &&
            result.fields[entry[0]]?.verdict !== "not-applicable",
        )
      : [];
    const bboxFields = new Set(bboxEntries.map(([field]) => field));
    return (
      <section className="results-panel" aria-labelledby="results-heading">
        <div className="results-heading-row">
          <div>
            <p className="section-label">Verification complete</p>
            <h2 id="results-heading" ref={resultsHeadingRef} tabIndex={-1}>Review the label results</h2>
            <p>
              {applicableCount} applicable fields checked. Confirm anything
              marked for review before continuing.
              {elapsedMs !== null && (
                <> Analysis completed in <strong>{(elapsedMs / 1000).toFixed(1)}s</strong>.</>
              )}
            </p>
          </div>
          <span className={`overall-badge verdict-${result.overall_status}`}>
            Overall: {result.overall_status.replace("-", " ")}
          </span>
        </div>
        {previewUrl && bboxEntries.length > 0 && (
          <div className="label-preview-section">
            <p className="label-preview-hint">
              Select a highlighted area to jump to its field below.
            </p>
            <div className="label-preview-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Label with annotated field locations" className="label-preview-image" />
              {bboxEntries.map(([field, bbox]) => {
                const verdict = result.fields[field]?.verdict ?? "not-applicable";
                return (
                  <button
                    type="button"
                    key={field}
                    ref={(el) => {
                      boxRefs.current[field] = el;
                    }}
                    className={`bbox-box verdict-${verdict}${activeField === field ? " is-active" : ""}`}
                    style={{
                      left: `${bbox.x * 100}%`,
                      top: `${bbox.y * 100}%`,
                      width: `${bbox.w * 100}%`,
                      height: `${bbox.h * 100}%`,
                    }}
                    onClick={() => revealCard(field)}
                    aria-label={`${fieldLabel(field)} on label — jump to its field details`}
                  >
                    <span className="bbox-box-label">{fieldLabel(field)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {(
          [
            { verdict: "mismatch", label: "Mismatches" },
            { verdict: "needs-review", label: "Needs review" },
            { verdict: "match", label: "Matches" },
            { verdict: "not-applicable", label: "Not applicable" },
          ] as const
        ).map(({ verdict, label }) => {
          const fields = Object.values(result.fields).filter(
            (f) => f.verdict === verdict,
          );
          if (fields.length === 0) return null;
          return (
            <div key={verdict} className="results-group">
              <h3 className={`results-group-heading verdict-label-${verdict}`}>
                {label}
              </h3>
              <div className="results-grid">
                {fields.map((field) => (
                  <article
                    className={`result-card verdict-${field.verdict}${activeField === field.field ? " is-active" : ""}`}
                    data-testid={`result-${field.field}`}
                    key={field.field}
                    ref={(el) => {
                      cardRefs.current[field.field] = el;
                    }}
                  >
                    <div className="result-card-heading">
                      <h3>{fieldLabel(field.field)}</h3>
                      <span>{field.verdict.replace("-", " ")}</span>
                    </div>
                    <p>{field.reason}</p>
                    {bboxFields.has(field.field) && (
                      <button
                        type="button"
                        className="bbox-jump-link"
                        onClick={() => revealBox(field.field)}
                      >
                        Show on label
                      </button>
                    )}
                    {field.verdict !== "not-applicable" && (
                      <dl>
                        <div>
                          <dt>On label</dt>
                          <dd>{field.extracted || "Not found"}</dd>
                        </div>
                        <div>
                          <dt>In application</dt>
                          <dd>{field.submitted || "Not provided"}</dd>
                        </div>
                      </dl>
                    )}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        <button className="primary-button" type="button" onClick={reset}>
          Verify another label
        </button>
      </section>
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
        <label
          className={`upload-zone ${errors.image ? "field-invalid" : ""}`}
          htmlFor="label-image"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0] ?? null;
            if (!file) return;
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setErrors((current) => ({ ...current, image: "" }));
          }}
        >
          <input
            id="label-image"
            name="label-image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setImage(selected);
              setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
              setErrors((current) => ({ ...current, image: "" }));
            }}
          />
          {previewUrl ? (
            // A blob URL is generated from a user-selected local file.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected label preview" />
          ) : (
            <div>
              <strong>Choose label artwork</strong>
              <span>Click here or drop a file into this area</span>
            </div>
          )}
        </label>
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
    </form>
  );
}
