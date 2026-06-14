"use client";

import Image from "next/image";
import { useState } from "react";

import BatchWorkspace from "@/components/batch-workspace";
import SingleLabelWorkspace from "@/components/single-label-workspace";

type Mode = "single" | "batch";

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  return (
    <main>
      {/* Agency header */}
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#main-content" aria-label="TTB home">
            <Image
              src="/logo.png"
              alt="Alcohol and Tobacco Tax and Trade Bureau seal"
              width={60}
              height={60}
              className="brand-seal"
              priority
            />
            <span className="brand-text">
              <span className="brand-abbr">TTB</span>
              <span className="brand-names">
                <strong>Alcohol and Tobacco Tax and Trade Bureau</strong>
                <small>U.S. Department of the Treasury</small>
              </span>
            </span>
          </a>
          <div className="header-right">
            <span className="prototype-badge">Prototype Tool</span>
          </div>
        </div>
      </header>


      <section className="hero compact-hero">
        <div className="shell hero-grid">
          <div>
            <p className="section-label">TTB Label Compliance</p>
            <h1>Alcohol Label Verification</h1>
            <p className="hero-copy">
              Automatically compare label artwork against application data for
              all required TTB fields. Routine matches clear instantly — judgment
              calls stay with the reviewing agent.
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
            <BatchWorkspace />
          )}
        </div>
      </section>
    </main>
  );
}
