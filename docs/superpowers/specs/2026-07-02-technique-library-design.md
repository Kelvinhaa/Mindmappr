# Curated Study-Technique Library — Design

## Context

Today `generate_recommendation()` in `backends/services/study.py` makes a single Claude call that freely invents 2-4 technique names and descriptions per study session. There is no curated, science-backed set of techniques behind it — names, quality, and relevance vary call to call.

Goal: recommend from a fixed, popular, science-backed set of study techniques (spaced repetition, Feynman technique, active recall, interleaving, mind mapping, etc.), selected per-session based on the student's subject, learning goal, level, and available time, while keeping each technique's *description* personalized to the actual subject matter (not generic boilerplate).

## Approach: constrain the LLM to a fixed technique list

No new DB table, no migration, no schema changes. `StudyRecommendation.techniques[].title/description/duration_minutes` stays exactly as-is; `recommendation` remains a schemaless JSON column. The change is entirely in the system prompt:

1. A static Python list of curated techniques lives directly in `backends/services/study.py`, alongside `SYSTEM_PROMPT`. Each entry has:
   - `name` — the exact string Claude must use verbatim as `title`
   - a one-line generic description of the method itself (what it is)
   - a short "best for" hint (e.g. "procedural/quantitative subjects", "concept-heavy or qualitative subjects", "all-purpose") — guidance text for Claude's own subject-matching, not a separate scoring algorithm
2. This list is embedded in `SYSTEM_PROMPT` as a reference block, with an explicit rule: every `title` in the response **must** be one of these exact names, chosen (2-4, as today) for relevance to the given subject/level/duration/goal. The `description` field must still be subject-specific and concrete, applying the named technique to the actual subject — not restating the generic blurb.
3. Both call sites (`POST /study`, `POST /study/preview` in `backends/routers/study.py`) are unchanged — they already just call `generate_recommendation()` and store/return whatever comes back.
4. No hard validation/rejection if Claude drifts off-list — over-validating a guest-facing preview endpoint risks breaking it over a naming mismatch. Add a non-blocking log line (`print`, matching the existing style in `study.py`) if a returned title doesn't match the library, for observability only.
5. `_fallback_recommendation()` (used when the Claude call/parsing fails) is untouched — its generic "Focused Study Session" technique is a degraded-mode safety net, intentionally not drawn from the library.

## The library (~12 techniques)

Active Recall · Spaced Repetition / Retrieval Drill (an in-session flashcard/self-quiz block — distinct from the app's own FSRS cross-session scheduler) · Feynman Technique · Interleaving · Elaborative Interrogation · Dual Coding · Mind Mapping · Worked Examples · Practice Testing · Pomodoro/Timeboxing · Chunking · Self-Explanation.

Drawn from cognitive-science literature (e.g. Dunlosky et al., "Improving Students' Learning With Effective Learning Techniques") plus the well-known, popular techniques explicitly requested (Feynman, mind mapping).

## Frontend change

In the plan display — `.result-summary` box on the home page (`frontend-next/app/page.tsx`) and the equivalent review-modal body on the dashboard (`frontend-next/app/dashboard/page.tsx`) — add one small line beneath the existing italic summary paragraph, inside the same tinted box:

```
Techniques used: Active Recall, Interleaving
```

Derived from `techniques.map(t => t.title).join(", ")` — no new field required, since `title` now *is* the curated technique name. Styled as small, muted text (fits the existing serif/mono system) so it doesn't compete visually with the summary sentence above it.

## Verification

No existing backend tests cover `generate_recommendation()`; verification is manual:
- Hit `/study/preview` with varied subjects (a math topic, a language topic, a history topic) at different durations/levels and confirm `techniques[].title` values are drawn from the 12-name library, and `description` is genuinely subject-specific rather than boilerplate.
- Regenerate a plan in the browser and confirm the "Techniques used: …" line renders correctly in both the home page results panel and the dashboard review modal.
- Confirm the fallback path (Claude call/parsing failure) is unaffected and still returns its generic single-technique plan.
