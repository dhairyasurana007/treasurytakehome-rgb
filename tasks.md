# Project Tasks

This file is the execution sequence for `README.md` and `PLAN.md`. `README.md` remains the source of truth. Each numbered task maps to one primary implementation commit. Playwright remediation may add narrowly scoped follow-up commits before the task is considered complete.

`README.md` is immutable source material. Never edit, replace, reformat, or append to it. Put implementation and run documentation in `MVP-README.md` during MVP work and `PROJECT-README.md` for the final release.

Branch policy:

- Every MVP task and MVP remediation commit must be pushed to the `MVP` branch.
- Do not push MVP implementation commits to `main`.
- After the complete MVP Playwright gate passes, merge `MVP` into `main`.
- Final tasks begin from the updated `main` branch and push directly to `main`.

## Mandatory Task Protocol

Apply this protocol to every task in both sections:

1. Read the task, immutable `README.md`, and the relevant `PLAN.md` sections before editing.
2. Implement only the task's stated scope.
3. Add or update automated tests for the behavior introduced.
4. Add or update GitHub Actions workflows when the commit introduces new checks, test dependencies, services, artifacts, environment requirements, deployment behavior, or scheduled jobs. Keep workflows unchanged when no CI change is necessary.
5. Run the relevant unit, integration, type-check, lint, and build commands locally.
6. Commit the completed task as one commit and push it to the section's required branch: `MVP` for MVP tasks, `main` for Final tasks.
7. Wait 90 seconds to allow the redeploy and pushed-commit workflows to make progress.
8. Confirm the deployment succeeded and the deployed revision matches the commit just pushed.
9. Inspect the workflow pass rate for the pushed commit. Poll queued or running required workflows until they reach a terminal state or a documented timeout. Every applicable required workflow must complete successfully; unexpectedly skipped, cancelled, timed-out, or failed workflows do not count as passing.
10. If any workflow fails, is cancelled, is unexpectedly skipped, or exceeds the timeout, stop. Inspect its logs, reproduce the failure where possible, determine the root cause in the code, tests, configuration, dependencies, or workflow, implement the smallest complete fix, add regression coverage, commit, and push to the same section branch.
11. Wait 90 seconds, confirm the new deployment revision, and poll every workflow again until completion or timeout. Repeat the diagnose, fix, push, wait, deploy verification, and workflow verification cycle until the pass rate is 100% for all applicable required workflows.
12. Run the task's Playwright gate against the deployed application as user testing. Capture browser console errors, failed network requests, screenshots, and traces for failures.
13. If Playwright reveals any bug, regression, confusing behavior, accessibility issue, or mismatch with `README.md`/`PLAN.md`, stop. Do not begin the next task.
14. Reproduce the issue, determine its root cause, implement the smallest complete fix, update regression coverage and GitHub workflows if necessary, commit, and push the fix to the same section branch.
15. Wait 90 seconds, confirm the fix deployment, verify a 100% pass rate across all applicable required workflows, and rerun the full Playwright gate. Repeat the diagnose, fix, push, wait, deploy, workflow, and Playwright cycle until everything passes.
16. Continue to the next task only when local checks pass, all applicable required workflows have a 100% pass rate, the deployment is healthy, and deployed Playwright user testing is green.

Playwright tests should use deterministic API fixtures for routine UI behavior. Tasks involving the real Anthropic integration must also include a small live smoke test when credentials are available. Never expose API keys in browser code, traces, screenshots, or responses.

GitHub Actions workflow files and display names must describe their stable function or purpose, such as `ci.yml` / `CI`, `playwright.yml` / `Playwright`, `production-smoke.yml` / `Production Smoke`, or `retention-cleanup.yml` / `Retention Cleanup`. Never name a workflow after a task number, commit number, implementation sequence, or temporary milestone.

## MVP

The MVP is complete when a reviewer can use a basic, coherent frontend at the public URL to verify one label end to end and submit a durable batch that continues after the browser closes. The frontend must include obvious navigation, readable forms, loading/error states, result displays, and responsive layouts; backend-only completion does not satisfy the MVP.

All tasks in this section must be implemented and pushed on the `MVP` branch. Task 11 includes the final MVP gate and merge into `main`.

### 1. Scaffold, Test Harness, and Initial Deployment

**Commit:** `scaffold application and deployment`

- Create the Next.js App Router application with TypeScript and Tailwind.
- Add lint, type-check, unit-test, build, and Playwright scripts.
- Add Playwright configuration, a smoke-test project, and stable test selectors.
- Add the initial GitHub Actions CI workflow for install, lint, type-check, unit tests, build, and Playwright smoke tests; upload Playwright reports/traces on failure.
- Add `.env.example` documenting `ANTHROPIC_API_KEY`, `MODEL_ID`, `DATA_DIR`, `BATCH_CONCURRENCY`, `BATCH_RETENTION_HOURS`, and `DRAFT_RETENTION_HOURS`.
- Add `render.yaml` and a minimal health endpoint.
- Configure the Render web service and persistent disk so `main` auto-deploys.
- Implement the basic frontend shell: page layout, header, obvious single-label/batch navigation, typography, spacing, responsive container, and placeholder panels for both workflows.

**Local checks:** install dependencies, lint, type-check, unit tests, production build, and local Playwright smoke test.

**After-push Playwright gate:** verify the deployed URL and health endpoint load, navigation is obvious, no console errors occur, and the page is usable at desktop and mobile widths.

### 2. Define Domain Types and Deterministic Comparison Rules

**Commit:** `implement label comparison engine`

- Define beverage type, application data, applicability, extracted fields, field verdicts, overall status, and verification result types.
- Add the canonical government warning constant.
- Implement exact canonical warning checks, mandatory applicability, boldness, legibility, and prominence outcomes.
- Implement field-specific comparison for brand, class/type, ABV/proof, net contents, bottler/address, and country.
- Return `needs-review` for `STONE'S THROW` versus `Stone's Throw`.
- Implement the worst-applicable-field overall status rule.
- Add comprehensive unit tests for all decision-matrix cases in `PLAN.md`.

**Local checks:** lint, type-check, comparison tests, warning tests, and production build.

**GitHub Actions:** extend CI only if the comparison tests require new commands, fixtures, or artifacts.

**After-push Playwright gate:** use a non-production test harness route enabled only in the test environment to verify visible match, needs-review, mismatch, and not-applicable states, including mandatory warning behavior and the brand-name example.

### 3. Add Secure Image and Application Validation

**Commit:** `validate verification inputs`

- Accept JPEG, PNG, and WebP only.
- Enforce 5 MB compressed and 25-megapixel decoded limits.
- Validate signatures and dimensions server-side without trusting extensions or MIME types.
- Validate beverage type, field applicability, required values, and the mandatory government warning.
- Return plain-language validation errors without leaking secrets.
- Share validation between single and future batch flows.

**Local checks:** unit/integration tests for valid files, renamed non-images, unsupported formats, oversized files, excessive dimensions, malformed data, and invalid applicability.

**GitHub Actions:** install any native image-validation dependencies and run the new validation tests in CI.

**After-push Playwright gate:** use the test-environment input harness to submit valid and invalid files; verify clear errors, no model request for rejected files, and no console or network failures. The harness must not be enabled in the public production mode.

### 4. Implement Claude Vision Extraction and Verification API

**Commit:** `integrate vision extraction api`

- Add the Anthropic SDK and server-only client configuration.
- Send the label image with a constrained extraction prompt and structured tool schema.
- Extract all seven fields plus warning boldness, legibility, and prominence evidence.
- Combine extraction with deterministic comparison in `/api/verify`.
- Handle missing configuration, malformed model output, provider errors, and timeouts safely.
- Add mocked integration tests and a guarded live smoke test.

**Local checks:** lint, type-check, mocked API tests, guarded live smoke test, and production build.

**GitHub Actions:** run mocked provider tests on every push; keep the live Anthropic smoke test manually triggered or secret-gated so forks and untrusted events cannot access credentials.

**After-push Playwright gate:** use a deterministic mocked provider mode to verify success and failure responses through the browser; when credentials are configured, verify one real sample label end to end and confirm the key never appears in client requests or bundles.

### 5. Build the Single-Label Verification Experience

**Commit:** `build single label verification flow`

- Build image selection, drag-and-drop, thumbnail preview, beverage type, application fields, and applicability controls.
- Keep the government warning visibly always required.
- Add submit, loading, error, result, and reset states.
- Show all seven verdict cards with extracted and submitted values.
- Explain warning text, boldness, legibility, and prominence findings in plain language.
- Use generous labels, click targets, contrast, and keyboard behavior for non-technical users.
- Replace the single-label placeholder in the basic frontend shell with the complete working form and results experience.

**Local checks:** component tests, accessibility checks, lint, type-check, build, and local Playwright flow tests.

**GitHub Actions:** add the single-label Playwright project and upload screenshots/traces on failure.

**After-push Playwright gate:** verify the complete single-label flow, validation, loading, API failure, all verdict colors/text, reset behavior, keyboard-only operation, mobile layout, and no hidden actions.

### 6. Establish Durable Batch Storage and Worker Execution

**Commit:** `add durable batch job engine`

- Add SQLite-backed draft, job, item, attempt, result, and expiry storage under `DATA_DIR`.
- Add a process-local worker with configurable concurrency.
- Implement pending, processing, completed, and error transitions.
- Recover interrupted processing items on startup without duplicating completed work.
- Keep finalized jobs independent of browser state.
- Add repository and worker integration tests with a fake extraction provider.

**Local checks:** database tests, worker lifecycle tests, restart-recovery tests, lint, type-check, and build.

**GitHub Actions:** provision a temporary writable data directory and run SQLite/worker integration tests without relying on persistent CI state.

**After-push Playwright gate:** use a non-production batch-storage harness route to create and inspect a fixture-backed job, leave the page, reopen its URL, and verify persisted progress/results; exercise a controlled service restart if the environment supports it. The harness must not be enabled in public production mode.

### 7. Add Retry, Backoff, and Adaptive Concurrency

**Commit:** `harden provider retry behavior`

- Retry transient timeouts, provider 5xx responses, and equivalent temporary failures at most twice with exponential backoff.
- Do not retry validation or authentication failures.
- Reduce effective batch concurrency on rate-limit responses and recover gradually after successful work.
- Persist attempt information needed for diagnosis without exposing credentials.

**Local checks:** deterministic retry, backoff, rate-limit, concurrency-recovery, and non-retryable-error tests.

**GitHub Actions:** add deterministic retry/rate-limit scenarios without real sleeps or provider calls.

**After-push Playwright gate:** use the batch-storage harness to drive transient recovery, permanent errors, rate limiting, manual retry, and continued processing of unaffected items.

### 8. Implement CSV Parsing and Atomic Draft Uploads

**Commit:** `implement atomic batch uploads`

- Parse UTF-8 CSV files up to 1 MB with 1-300 rows.
- Require canonical value headers: `filename`, `beverage_type`, `brand_name`, `class_type`, `abv`, `net_contents`, `bottler`, `country`, and `government_warning`.
- Support optional applicability headers for every non-warning field; default them to true and accept `true/false`, `yes/no`, and `1/0` case-insensitively.
- Normalize headers case-insensitively and independently of column order.
- Ignore unknown columns; reject missing or duplicate normalized required headers.
- Match basename only, discard directory paths, preserve original basename casing for display/export, and reject case-insensitive basename collisions.
- Enforce 2,000-character text-field limits and 255-character basename limits.
- Validate boolean forms, case-insensitive filename uniqueness, exact image coverage, image signatures, image dimensions, and compressed sizes.
- Create temporary drafts, upload the manifest and images separately, record checksums, display aggregate progress, and finalize atomically only after checksum and coverage verification.
- Reject a government-warning applicability column.
- Assign abandoned drafts their configured expiry without creating visible jobs; Task 9 performs deletion.

**Local checks:** parser tests, upload endpoint tests, atomic-finalization tests, interrupted-upload tests, lint, type-check, and build.

**GitHub Actions:** add batch-upload fixtures and retain failed Playwright upload artifacts.

**After-push Playwright gate:** test a valid batch, malformed CSV, 301 rows, duplicate names, missing images, case-insensitive matches, unsupported images, interrupted transfer, retryable file upload, and atomic finalization.

### 9. Implement Exact Expiry and Cleanup Behavior

**Commit:** `implement batch retention cleanup`

- Delete job images, results, and metadata at the configured 24-hour expiry.
- Delete abandoned drafts at their configured expiry.
- Run cleanup at startup and periodically.
- Retain only a non-sensitive hashed tombstone needed to return `410 Gone`.
- Return `404 Not Found` for unknown job IDs.

**Local checks:** time-controlled cleanup tests, startup cleanup, periodic cleanup, tombstone privacy, 404, and 410 tests.

**GitHub Actions:** add time-controlled cleanup tests; add a scheduled workflow only if production cleanup requires an external trigger.

**After-push Playwright gate:** use shortened test retention through the non-production harness to verify expiry, `410` expired behavior, `404` unknown behavior, and absence of retained application data.

### 10. Build Batch Progress, Recovery, and Results UI

**Commit:** `build durable batch workflow`

- Add single/batch mode navigation and the batch upload form.
- Replace the batch placeholder in the basic frontend shell with the complete working upload, progress, recovery, and results experience.
- Redirect finalized batches to an unguessable job URL.
- Poll persisted progress and show processed count, current state, estimated time, and per-item summaries.
- Preserve input row order while processing concurrently.
- Show the exact 24-hour expiry and a copyable job link.
- Store non-sensitive recent-job links in local storage.
- Remove expired entries from browser-local recent jobs when expiry is detected.
- Support manual retry for failed items.

**Local checks:** UI tests, polling tests, local-storage tests, retry tests, accessibility checks, lint, type-check, and build.

**GitHub Actions:** add the batch workflow Playwright project with deterministic fake-worker/provider configuration.

**After-push Playwright gate:** submit a fixture batch, verify visible progress, close and reopen the page, recover via job URL and recent jobs, open the same unguessable job URL in a separate browser context without authentication, confirm input order, retry a failed item, verify expiry disclosure, remove an expired recent-job entry, and verify `404` unknown/`410` expired states.

### 11. Deploy and Validate the Complete MVP

**Commit:** `complete mvp deployment`

- Confirm production environment variables, persistent disk, worker startup, and cleanup startup hooks.
- Add representative sample labels and deterministic Playwright fixtures.
- Create or update `MVP-README.md` with setup/run instructions, architecture, tools, assumptions, firewall dependency, deployment details, and MVP limitations.
- Publish the working application URL.
- Record deployed single-label p50 and p95 latency; require p95 at or below five seconds under normal load.
- After the complete deployed MVP Playwright suite passes, merge the `MVP` branch into `main` and verify the merged `main` deployment.

**Local checks:** full unit/integration suite, lint, type-check, production build, and complete local Playwright suite.

**GitHub Actions:** require the full MVP CI matrix on the `MVP` branch and before merging `MVP` into `main`; add a production smoke workflow if deployment credentials and URL are available.

**After-push Playwright gate:** run the full MVP suite against the deployed `MVP` revision: single-label success/error flows, a finalized batch surviving browser closure, responsive/accessibility smoke tests, secret-leak checks, and latency measurement. When green, merge `MVP` into `main`, wait 90 seconds, confirm the `main` deployment, and rerun the full MVP suite against `main`. Do not start Final tasks until both gates pass.

## Final

The Final section hardens the MVP, completes batch operations, and performs release-level validation.

All tasks in this section begin from the MVP-merged `main` branch and push directly to `main`.

### 12. Add Safe Batch CSV Export

**Commit:** `add batch results export`

- Export completed/error items during processing and all items after completion.
- Preserve original CSV row order.
- Include filename, overall status, processing error, and each field's applicability, verdict, submitted value, and extracted value.
- Clearly mark partial exports.
- Prevent spreadsheet formula injection for values beginning with `=`, `+`, `-`, or `@`.

**Local checks:** export schema, ordering, partial export, quoting, Unicode, and formula-injection tests.

**GitHub Actions:** retain downloaded CSV artifacts when export Playwright tests fail.

**After-push Playwright gate:** download partial and complete exports, inspect the downloaded files, verify order and values, and confirm spreadsheet-dangerous values are escaped.

### 13. Harden UX, Accessibility, and Error Recovery

**Commit:** `polish accessibility and error handling`

- Review every single and batch state for plain language and obvious next actions.
- Add accessible names, focus management, status announcements, contrast, and large controls.
- Ensure layouts work at desktop, tablet, and mobile sizes.
- Make upload, provider, retry, expiry, and partial-result messages actionable.
- Remove hidden actions and unnecessary technical language.

**Local checks:** component accessibility tests, lint, type-check, build, and automated accessibility scanning.

**GitHub Actions:** add automated accessibility checks and retain reports/screenshots on failure.

**After-push Playwright gate:** run keyboard-only workflows, screen-size checks, automated accessibility scans, focus/error recovery checks, and screenshots of every major state. Treat confusing behavior as a failing test.

### 14. Validate Accuracy, Performance, and Edge Cases

**Commit:** `add release acceptance coverage`

- Build a representative fixture set covering spirits, wine, beer, imports, exemptions, warning failures, brand variants, poor lighting, glare, and rotated images.
- Keep preprocessing deferred unless tests prove it is required to meet acceptance behavior.
- Measure single-label deployed p50/p95 and batch active-processing/queue-wait metrics separately.
- Verify 200- and 300-item batches with a controlled fake provider; run a smaller live-provider batch within rate and cost limits.
- Document observed accuracy and performance limitations.

**Local checks:** full regression suite, load-oriented worker tests, lint, type-check, and production build.

**GitHub Actions:** add controlled fake-provider batch acceptance tests; keep cost-bearing live-provider and large production tests manually triggered.

**After-push Playwright gate:** run the release acceptance matrix against production, inspect traces/screenshots for every failure, and repeat the mandatory diagnosis loop until all required scenarios pass or a README-compatible limitation is explicitly documented.

### 15. Final Documentation and Release Verification

**Commit:** `finalize documentation and release`

- Create or update `PROJECT-README.md` with setup, local run, environment variables, deployment, architecture, tools, assumptions, trade-offs, limitations, firewall dependency, retention, and the public URL.
- Preserve `README.md` byte-for-byte and verify it was not modified.
- Verify `PLAN.md`, `CONTEXT.md`, and this file match the implemented behavior.
- Remove stale instructions and document deferred items without presenting them as complete.
- Confirm the repository contains all source code and reproducible commands.

**Local checks:** clean install, full test suite, lint, type-check, production build, documentation link/command review, and local Playwright suite.

**GitHub Actions:** finalize required CI checks, add the full production smoke workflow where credentials permit, and verify workflow documentation matches actual triggers.

**After-push Playwright gate:** execute the entire Playwright suite against the final deployed commit, including single-label, batch, recovery, export, expiry, responsive, accessibility, error, and live smoke scenarios. Any failure restarts the diagnose, fix, push, deploy, and Playwright loop. The project is complete only when this final gate passes.
