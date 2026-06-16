# Learning & Approach

This document captures how I approached building the **TTB Label Verification**
prototype — a tool that compares alcohol label artwork against the data in a
permit application and flags whether each required field matches, needs review,
or is a mismatch. The goal here isn't to list features; it's to explain the
*method* and the engineering decisions behind them.

## Guiding principle: human-in-the-loop, not human-replaced

The product is deliberately designed so that routine matches clear instantly
while **judgment calls stay with the reviewing agent**. That framing drove most
of the technical choices: results are explained in plain language, nothing
destructive happens automatically, and anything ambiguous is surfaced for a
person rather than silently decided. For a compliance setting, predictability
and explainability matter more than cleverness.

The same principle governed how I *built* it. I used AI to draft the planning
documents, the task breakdown, and much of the implementation — but I stayed in
the loop as the check on that work, confirming it did what I actually intended
and that the output was accurate before accepting it. That's a **checks and
balances** relationship: AI proposes and executes, a human verifies and decides.
It runs through both the product and the process behind it.

## Spec-driven development

I worked spec first, and built the spec itself in stages before writing any
application code:

1. **Start from the brief.** I read through the project README and gave the AI
   that same source material to work from.
2. **`ce-plan` → `PLAN.md`.** I used the `ce-plan` skill to turn the brief into
   a structured plan document.
3. **`grill-with-docs` → a sharper plan.** I then used the `grill-with-docs`
   skill to interrogate and pressure test `PLAN.md` — surfacing gaps and
   tightening it until the plan actually held up to scrutiny.
4. **`TASKS.md`.** From the refined plan I authored a `TASKS.md`, manually
   reviewed it, and made a few improvements of my own rather than taking the
   generated plan at face value.
5. **MVP vs. Final.** I split the tasks into two explicit phases — an **MVP**
   section and a **Final** section — so there was a clear minimum bar to hit
   before any of the nice to haves.

Treating the spec as the source of truth — and grilling it *before* trusting it
— kept the work honest about scope and sequencing.

## Staged handoff to a single agent

With the spec in place, I handed implementation to a single coding agent and ran
it as a human in the loop, phased process:

1. **MVP only.** I first scoped the agent to implement *only* the MVP section.
2. **Review, test, iterate.** Once it finished, I reviewed the work, suggested
   improvements, and tested the running MVP with real inputs. Testing surfaced
   things that still needed work, so I fed those back and iterated until the MVP
   was genuinely solid — not just "passing."
3. **Reconcile the spec.** Because the MVP phase had drifted from the original
   plan in places, I had the agent recheck the **Final** section of `TASKS.md`
   against everything that had changed and update it before building further —
   keeping the plan and the code in sync instead of letting the spec rot.
4. **Build the Final section.** Once the Final tasks were verified as still
   correct, I had the agent implement the rest.
5. **Iterate to satisfaction.** I repeated the same loop — testing repeatedly
   with **different data**, suggesting improvements, and iterating — until the
   result held up.

The throughline: the agent did the implementation, but the planning, review,
testing, and the call on "is this actually done?" stayed with me. That division
of labor — AI for execution, human for judgment — mirrors how the product itself
is designed to work.

## AI-engineering decisions

The interesting depth is in how the AI layer was built and hardened:

- **Vision language model extraction.** A multimodal model reads the label and
  returns the required fields. It's constrained to **structured output** via
  tool/function calling with a strict JSON schema, and every response is
  validated with **Zod** at the trust boundary before anything downstream uses
  it. The model interprets; the code enforces.
- **Prompt engineering with intent.** Prompts are scoped to exactly the task —
  e.g., the request is trimmed when a feature is turned off so the model isn't
  asked to produce output that would be discarded.
- **Hybrid VLM + deterministic geometry.** Bounding boxes for located fields use
  OCR (Tesseract) to supply *precise pixel coordinates*, while the model still
  does the *semantic* job of knowing which text is which field. The model
  interprets meaning; a deterministic source provides geometry.
- **Graceful degradation.** Every enhancement has a fallback. If OCR fails or is
  slow, the result still returns; the expensive pass is timeboxed and null safe
  so a cold start can never block or break the core response.
- **Latency budgeting.** User facing checks are held to a clear performance
  target. I measured deployed p50/p95 latency, ran the OCR pass concurrently
  with the model call so it adds near zero wall clock, and made the costly
  bounding box feature **opt in** with an honest "this takes longer" note —
  progressive disclosure rather than a hidden tax on every request.

## Quality assurance: three layers

Quality came from three complementary, independent layers of testing, with no
single layer trusted on its own to catch everything:

1. **Automated checks in the repository (CI).** GitHub Actions workflows run on
   every push — typechecking, deterministic unit tests for the comparison and
   geometry logic, and end to end suites — and the production deploy is *gated*
   on them, so a red build never reaches users.
2. **Hands on manual testing.** I exercised the live site myself whenever I
   could, with varied inputs — the kind of exploratory testing that catches what
   prewritten assertions don't think to check.
3. **Agent driven end to end automation.** I instructed the agent following
   `TASKS.md` to use Playwright to automate the user flows after each commit and
   deployment, and to fix any failures it surfaced — making regression testing
   part of the build loop rather than an afterthought.

The point of three layers is coverage at different granularities: fast
deterministic checks on logic, a human eye on the actual experience, and
automated browser testing against the real, deployed thing.

Two more things were treated as requirements rather than polish:

- **Accessibility** — semantic controls, keyboard operability, labeled regions,
  and readable sizing for the intended audience.
- **Privacy by design** — images are used only to complete a verification, and
  batch job data carries an explicit retention/expiry policy.

## Honest tradeoffs

The clearest example of scoping under constraint is the **bounding box overlay**.
I added it as a transparency feature — showing reviewers *where* in the image
each extracted field came from, the kind of provenance that matters in an
audit/compliance setting. In the time available, though, the boxes didn't align
tightly enough to the right regions to call them trustworthy (the OCR based
geometry also degrades on low contrast or stylized labels), and generating them
adds at least a second per label — against a hard requirement that each
verification stay **at or under five seconds**.

So rather than ship a half accurate feature on by default, or cut it entirely, I
made a deliberate call: keep it, but make it **opt in and off by default**,
**label it experimental**, and **warn about the added latency** so the choice is
informed. The core verification stays fast and reliable for everyone; the extra
transparency is there for anyone who wants it and accepts the tradeoff. The part
I'd highlight isn't the feature itself — it's protecting a hard constraint and
being honest about maturity instead of overselling.

A couple of other honest notes: the prototype prioritizes a clear, correct
review experience over breadth, so there's a deliberate line between what's
shipped and what's future work; and the latency budget shaped real decisions
(running OCR concurrently with the model call, trimming the request when boxes
are off) rather than being treated as an afterthought.

## What I take away from it

The throughline is judgment: spec driven scoping to stay honest about the work,
a human in the loop product stance suited to a compliance domain, AI used where
it's strong (interpretation) with deterministic code where *it's* strong
(validation and geometry), and a verify on the real thing habit so "done"
actually means done.
