# TTB Label Verifier — Project README

Public application: https://ttb-label-verifier-rgb.onrender.com

This Next.js prototype compares alcohol label artwork against submitted application
data for all required TTB fields. A vision model extracts text from the uploaded
label image; deterministic TypeScript rules produce the seven field verdicts.
Routine matches clear instantly. Judgment calls remain with the reviewing agent.

`README.md` is immutable source material and is not modified by this implementation.

---

## Setup

Prerequisites: Node.js 20 or newer, and an OpenRouter account with an API key.

```bash
npm ci
cp .env.example .env.local
# Edit .env.local — at minimum set OPENROUTER_API_KEY and DATA_DIR
npm run dev
```

Open http://localhost:3000.

For deterministic local UI development without real API calls:

```bash
npm run dev:test
```

This enables `EXTRACTION_MODE=mock` and the non-production test harness routes.
Do not set `ENABLE_TEST_HARNESS=true` in a public environment.

## Running Checks

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest unit and integration tests
npm run build         # Production build
npm run test:e2e      # Playwright (requires dev:test server or PLAYWRIGHT_BASE_URL)
```

For latency measurement against the deployed app:

```bash
npm run latency:deployed
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | **Required.** Server-only OpenRouter credential. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter endpoint. |
| `OPENROUTER_SITE_URL` | — | Optional attribution URL sent as `HTTP-Referer`. |
| `OPENROUTER_APP_NAME` | — | Optional attribution name sent as `X-OpenRouter-Title`. |
| `MODEL_ID` | `anthropic/claude-haiku-4.5` | Vision model for label extraction. |
| `DATA_DIR` | — | **Required.** Path for SQLite database and uploaded images. |
| `BATCH_CONCURRENCY` | `4` | Maximum concurrent batch items processed by the worker. |
| `BATCH_RETENTION_HOURS` | `24` | Hours until a completed job and its data expire. |
| `DRAFT_RETENTION_HOURS` | `2` | Hours until an abandoned draft upload is cleaned up. |
| `TOMBSTONE_SECRET` | — | HMAC secret for non-sensitive expired-ID tombstones. |
| `TOMBSTONE_RETENTION_HOURS` | `48` | Hours tombstones are retained to serve `410 Gone`. |

The API key is read server-side only and never included in client bundles, API
responses, screenshots, or traces.

---

## Model and Routing Policy

The default model is `anthropic/claude-haiku-4.5` via OpenRouter.

- One structured vision request is sent per label, using a constrained tool schema.
- There is no silent model fallback or tier routing; set `MODEL_ID` explicitly to
  use a different OpenRouter vision model.
- Transient provider failures (timeouts, 5xx) are retried at most twice with
  exponential backoff for batch items. Authentication and validation failures are
  not retried.
- Rate-limit responses reduce effective worker concurrency; concurrency recovers
  gradually after successful work.
- The application requires outbound access to `openrouter.ai:443`.
- Images are preprocessed server-side: any image where the longest dimension
  exceeds 1,024 px is downscaled to fit within 1,024 px (preserving aspect ratio)
  before being sent to the model. This keeps image tokens safely under the model's
  context limit.

---

## Architecture

```
Browser → Next.js App Router (API routes + React UI)
                │
                ├── /api/verify          Single-label verification
                ├── /api/batch/drafts    CSV + image upload pipeline
                ├── /api/batch/[jobId]   Job status polling
                └── /api/batch/.../export  CSV result download

OpenRouter (anthropic/claude-haiku-4.5) ← server-side only
SQLite on persistent disk ← drafts, jobs, items, attempts, results
Process-local batch worker ← concurrency-bounded, recovers on restart
Startup + periodic cleanup ← enforces exact retention, hashed tombstones
```

**Single-label flow**: upload → validate → extract (vision) → compare
(deterministic) → display seven verdict cards.

**Batch flow**: create draft → upload manifest CSV → upload images separately →
finalize atomically (checksum + coverage check) → worker processes items with
retry → results available at unguessable job URL until expiry.

---

## Tools and Dependencies

| Tool | Role |
|---|---|
| Next.js 16 (App Router) | Server and client rendering, API routes |
| React 19 | Component UI |
| TypeScript 5 | Type safety across the full stack |
| Tailwind CSS 4 | Utility styling |
| better-sqlite3 | Durable batch storage on the persistent disk |
| csv-parse | CSV manifest parsing |
| image-size | Server-side image dimension validation |
| sharp | Server-side image downscaling before model extraction |
| openai SDK | OpenRouter API client (OpenAI-compatible) |
| zod | Structured extraction schema validation |
| Playwright | End-to-end tests (deterministic + live fixture suite) |
| Vitest | Unit and integration tests |
| Render | Deployment platform (Node.js, persistent disk) |
| GitHub Actions | CI: lint, typecheck, tests, Playwright, production smoke |

---

## Deployment

**Platform**: Render web service, single instance.

| Setting | Value |
|---|---|
| URL | https://ttb-label-verifier-rgb.onrender.com |
| Runtime | Node.js 20 |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health endpoint | `/api/health` |
| Persistent disk | `/var/data`, 1 GB, mounted as `DATA_DIR` |

The batch worker and cleanup loop initialize from the web process when the health
or batch API routes are first called. No separate worker process is required.

Auto-deploys on push to `main`.

---

## Retention

| Object | Lifetime |
|---|---|
| Completed or failed job | 24 hours (`BATCH_RETENTION_HOURS`) |
| Abandoned draft | 2 hours (`DRAFT_RETENTION_HOURS`) |
| Expired-ID tombstone | 48 hours (`TOMBSTONE_RETENTION_HOURS`) |

Cleanup runs at startup and periodically during operation. Expired jobs are deleted
entirely (SQLite rows, uploaded images, result JSON). A non-sensitive HMAC
tombstone is kept briefly to return `410 Gone` instead of `404 Not Found` for
recently expired job URLs. After the tombstone window, expired IDs return `404`.

---

## Assumptions and Trade-offs

- **Single instance.** SQLite and a process-local worker queue are not suitable for
  multi-instance deployments. Horizontal scaling would require an external queue
  and distributed lock.
- **URL-based access control.** Possession of an unguessable job UUID grants
  read access to that job. Authentication and authorization are out of scope.
- **Deterministic comparisons.** All seven field verdicts are computed in
  TypeScript, not by the model. The model extracts text only; comparison logic is
  testable and auditable without API calls.
- **Image preprocessing.** Images wider or taller than 1,024 px are downscaled to
  fit. This reduces fidelity for very small text on large-format labels. The
  threshold keeps image tokens under the model's context limit while preserving
  legibility for standard label dimensions.
- **CSV-only batch input.** The batch flow requires a manifest CSV and matching
  image files. There is no API for programmatic batch submission without the UI.

---

## Limitations

- **Specific image content rejection.** Some real-world label images consistently
  return 502 from the upstream vision model regardless of size or format (root
  cause: upstream model rejection, not a local preprocessing failure).
  `fat-tire-ale.jpg` is one confirmed example and is excluded from the live test
  suite; `harbor-lager.png` is used in its place.
- **No import or degraded-quality fixtures.** The live fixture set covers domestic
  spirits, wine, and beer. Non-US import labels, labels with glare or poor
  lighting, and rotated images are not included and are deferred.
- **No exemption or warning-failure accuracy tests.** Accuracy for not-applicable
  field scenarios and labels with incorrect government warning text is not
  systematically measured.
- **Single-process worker.** Items in `processing` state when a hard crash occurs
  are recovered to `pending` on next startup; in-progress work is not lost but
  re-runs from the beginning.
- **Latency baseline** (20 iterations, June 2026, live OpenRouter with
  `anthropic/claude-haiku-4.5`):
  - p50: 3,497 ms — p95: 4,073 ms — max: 4,202 ms
  - p95 is well under the 5-second SLA.

---

## Firewall Dependency

The production server requires outbound HTTPS access to:

```
openrouter.ai:443
```

All other external traffic is initiated by the browser. No server-to-server calls
are made to CDNs, analytics services, or any third party other than OpenRouter.
