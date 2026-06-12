"use client";

import { useState } from "react";

import SingleLabelWorkspace from "@/components/single-label-workspace";

type Mode = "single" | "batch";

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");

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

      <section className="hero compact-hero">
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

        <div id="workflow-panel" role="tabpanel">
          {mode === "single" ? (
            <div data-testid="single-panel">
              <SingleLabelWorkspace />
            </div>
          ) : (
            <article className="workflow-card" data-testid="batch-panel">
              <div className="workflow-copy">
                <p className="section-label">Batch review</p>
                <h2>Process a full importer submission</h2>
                <p>
                  Upload a CSV and its matching label images. Processing
                  continues safely after you leave the page.
                </p>
                <ol>
                  <li>
                    <span>1</span>Add a CSV manifest
                  </li>
                  <li>
                    <span>2</span>Upload matching images
                  </li>
                  <li>
                    <span>3</span>Return to the saved job link
                  </li>
                </ol>
              </div>
              <div className="placeholder" aria-label="Batch review coming soon">
                <div className="placeholder-icon" aria-hidden="true">
                  300
                </div>
                <h3>Batch upload form</h3>
                <p>This durable workflow will be added in the next tasks.</p>
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
