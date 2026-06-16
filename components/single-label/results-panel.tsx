"use client";

import { useEffect, useRef, useState } from "react";

import { fieldLabel } from "@/components/single-label/fields";
import type { Bbox, FieldName, VerificationResult } from "@/lib/types";

interface ResultsPanelProps {
  result: VerificationResult;
  previewUrl: string | null;
  applicableCount: number;
  elapsedMs: number | null;
  onReset: () => void;
}

export default function ResultsPanel({
  result,
  previewUrl,
  applicableCount,
  elapsedMs,
  onReset,
}: ResultsPanelProps) {
  const [activeField, setActiveField] = useState<FieldName | null>(null);
  const cardRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const boxRefs = useRef<Partial<Record<FieldName, HTMLButtonElement | null>>>(
    {},
  );
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    resultsHeadingRef.current?.focus();
  }, []);

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
      <button className="primary-button" type="button" onClick={onReset}>
        Verify another label
      </button>
    </section>
  );
}
