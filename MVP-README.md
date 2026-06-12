# TTB Label Verifier MVP

Public application: https://ttb-label-verifier-rgb.onrender.com

This Next.js prototype compares alcohol label artwork with submitted application
data. It supports one-label verification and durable CSV/image batches of up to
300 labels. `README.md` is immutable source material and is not modified by this
implementation.

## Local Setup

Prerequisites:

- Node.js 20 or newer
- An OpenRouter account and API key for live extraction

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. Run all checks with:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only OpenRouter credential |
| `OPENROUTER_BASE_URL` | Defaults to `https://openrouter.ai/api/v1` |
| `OPENROUTER_SITE_URL` | Optional OpenRouter attribution URL |
| `OPENROUTER_APP_NAME` | Optional attribution name |
| `MODEL_ID` | Defaults to `anthropic/claude-haiku-4.5` |
| `DATA_DIR` | SQLite database and durable upload directory |
| `BATCH_CONCURRENCY` | Maximum concurrent batch items, default `4` |
| `BATCH_RETENTION_HOURS` | Job lifetime, default `24` |
| `DRAFT_RETENTION_HOURS` | Abandoned upload lifetime, default `2` |
| `TOMBSTONE_SECRET` | HMAC secret for non-sensitive expired-ID tombstones |
| `TOMBSTONE_RETENTION_HOURS` | Tombstone lifetime, default `48` |

For deterministic local UI tests, use `npm run dev:test`. This enables test-only
routes and mock extraction. Do not enable `ENABLE_TEST_HARNESS` in a public
production environment.

The public evaluation deployment currently uses deterministic mock extraction
because no OpenRouter credential is available in this workspace. To enable live
vision extraction, set `OPENROUTER_API_KEY` and remove `EXTRACTION_MODE=mock`.
The key remains server-side. The deployment requires outbound access to
`openrouter.ai:443`.

## Model Policy

The default model is `anthropic/claude-haiku-4.5`. The application sends one
structured vision request and performs all comparisons deterministically in
TypeScript. There is no silent model fallback or model-tier routing. Change
`MODEL_ID` explicitly to use another OpenRouter vision model.

Transient provider failures are retried at most twice for batch items.
Authentication and validation failures are not retried. Rate limits reduce
effective worker concurrency, which recovers after successful work.

## Architecture

- Next.js App Router serves the responsive UI and API routes.
- OpenRouter performs structured image-field extraction.
- TypeScript comparison rules produce the seven field verdicts.
- SQLite on a Render persistent disk stores drafts, jobs, items, attempts, and
  results.
- A process-local worker claims durable queue items with bounded concurrency.
- Startup and periodic cleanup enforce exact expiry and retain only hashed
  tombstones briefly for `410 Gone` responses.

Batch uploads use an unguessable temporary draft. The CSV and each image upload
separately; finalization verifies checksums and exact coverage in one
transaction. Only then is a visible job created. Processing continues without
an open browser and results are available to anyone possessing the unguessable
job URL until expiry.

## Deployment

Render service:

- URL: https://ttb-label-verifier-rgb.onrender.com
- Runtime: Node.js 20, one persistent web-service instance
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health: `/api/health`
- Persistent disk: `/var/data`, 1 GB

The worker and cleanup loop start from the web process when health or batch APIs
initialize the runtime. SQLite and the uploaded files share the persistent disk.

## Samples

`fixtures/sample-batch.csv` and `fixtures/labels/` contain three generated,
non-sensitive sample labels for spirits, wine, and beer. Regenerate them with:

```powershell
node scripts/generate-sample-labels.mjs
```

## Assumptions And Limitations

- Possession of an unguessable job URL grants access; authentication is out of
  scope.
- Jobs expire after 24 hours and abandoned drafts after two hours.
- One Render instance is assumed. SQLite and a process-local worker are not a
  multi-instance queue.
- Batch queue wait is separate from the five-second active-processing target.
- CSV export, broader accuracy fixtures, and release-level UX hardening are
  Final-section work and are not part of this MVP.
- Live model accuracy and latency require an OpenRouter key and were not
  measured here because credentials were unavailable.

## Performance

Use `npm run latency:deployed` to measure 20 deployed single-label requests.
MVP acceptance requires deployed p95 at or below five seconds under normal
load.

Recorded on June 12, 2026 against deployed revision `4471075` in deterministic
mock mode:

- p50: 116 ms
- p95: 215 ms
- maximum: 323 ms

These numbers validate the deployed application and comparison path, not live
OpenRouter model latency. Live latency remains unmeasured because no credential
was available.
