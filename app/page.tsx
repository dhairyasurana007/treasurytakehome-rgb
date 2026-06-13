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

      {/* Primary navigation */}
      <nav className="primary-nav" aria-label="Primary navigation">
        <div className="shell primary-nav-inner">
          <ul className="primary-nav-list">
            <li><a href="#">WHO WE ARE <span aria-hidden="true">▾</span></a></li>
            <li><a href="#">WHAT WE DO <span aria-hidden="true">▾</span></a></li>
            <li><a href="#">TTB AUDIENCES <span aria-hidden="true">▾</span></a></li>
            <li><a href="#">RESOURCES <span aria-hidden="true">▾</span></a></li>
          </ul>
          <button className="nav-search-btn" type="button" aria-label="Search">
            <span aria-hidden="true">🔍</span> SEARCH
          </button>
        </div>
      </nav>

      {/* Secondary highlights bar */}
      <div className="secondary-bar">
        <div className="shell">
          <ul className="secondary-bar-list">
            <li><a href="#">Label Verification Tool</a></li>
            <li><a href="#">COLA Online</a></li>
            <li><a href="#">Tax &amp; Fee Rates</a></li>
          </ul>
        </div>
      </div>

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

      <section className="about-section">
        <div className="shell">
          <h2>About This Tool</h2>
          <p>
            The TTB Label Verifier is a prototype compliance aid for the Alcohol
            and Tobacco Tax and Trade Bureau (TTB). The TTB reviews approximately
            150,000 alcohol beverage label applications per year through its
            Certificate of Label Approval (COLA) process.
          </p>
          <p>
            This tool automates the routine field-matching step of label review.
            Upload a label image and enter the corresponding application data; the
            tool extracts text from the label using AI and compares each required
            field against the submitted values. Fields checked include:
          </p>
          <ul>
            <li>Brand name</li>
            <li>Class and type designation</li>
            <li>Alcohol content (ABV)</li>
            <li>Net contents</li>
            <li>Bottler name and address</li>
            <li>Country of origin</li>
            <li>Mandatory Government Health Warning Statement</li>
          </ul>
          <p>
            Each field receives a verdict of <strong>Match</strong>,{" "}
            <strong>Needs Review</strong>, or <strong>Mismatch</strong>. Routine
            matches clear automatically. Judgment calls — including minor
            formatting differences and ambiguous text — are flagged for agent
            review rather than auto-rejected.
          </p>
          <p>
            <strong>This is a prototype.</strong> It is not integrated with the
            COLA system and does not store submission data beyond the current
            session.
          </p>
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
