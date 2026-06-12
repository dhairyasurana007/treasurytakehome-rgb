"use client";

import { useState } from "react";

type Mode = "single" | "batch";

const panels: Record<
  Mode,
  { eyebrow: string; title: string; description: string; steps: string[] }
> = {
  single: {
    eyebrow: "Single label",
    title: "Check one label in seconds",
    description:
      "Upload label artwork and compare it with the application details. You will see a clear result for every required field.",
    steps: ["Add label artwork", "Enter application details", "Review each result"],
  },
  batch: {
    eyebrow: "Batch review",
    title: "Process a full importer submission",
    description:
      "Upload a CSV and its matching label images. Processing continues safely after you leave the page.",
    steps: ["Add a CSV manifest", "Upload matching images", "Return to the saved job link"],
  },
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const panel = panels[mode];

  return (
    <main>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#main-content" aria-label="TTB Label Verifier home">
            <span className="brand-mark" aria-hidden="true">
              TTB
            </span>
            <span>
              <strong>Label Verifier</strong>
              <small>Compliance review workspace</small>
            </span>
          </a>
          <span className="prototype-badge">Prototype</span>
        </div>
      </header>

      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="section-label">Faster application review</p>
            <h1>Compare label artwork with confidence.</h1>
            <p className="hero-copy">
              Find routine differences quickly while keeping compliance judgment
              in the hands of the reviewing agent.
            </p>
          </div>
          <aside className="promise-card" aria-label="Service goals">
            <p>Designed for the review desk</p>
            <strong>Clear results. Plain language. No hidden actions.</strong>
          </aside>
        </div>
      </section>

      <section className="shell workspace" id="main-content">
        <div className="mode-tabs" role="tablist" aria-label="Verification mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            aria-controls="workflow-panel"
            data-testid="single-tab"
            onClick={() => setMode("single")}
          >
            Single label
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "batch"}
            aria-controls="workflow-panel"
            data-testid="batch-tab"
            onClick={() => setMode("batch")}
          >
            Batch upload
          </button>
        </div>

        <article
          className="workflow-card"
          id="workflow-panel"
          role="tabpanel"
          data-testid={`${mode}-panel`}
        >
          <div className="workflow-copy">
            <p className="section-label">{panel.eyebrow}</p>
            <h2>{panel.title}</h2>
            <p>{panel.description}</p>
            <ol>
              {panel.steps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="placeholder" aria-label={`${panel.eyebrow} coming soon`}>
            <div className="placeholder-icon" aria-hidden="true">
              {mode === "single" ? "1" : "300"}
            </div>
            <h3>{mode === "single" ? "Single-label form" : "Batch upload form"}</h3>
            <p>This guided workflow will be added in the next implementation tasks.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
