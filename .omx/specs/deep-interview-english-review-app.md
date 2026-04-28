# Deep Interview Spec: English Review App

## Metadata

- Source workflow: `$deep-interview`
- Interview ID: `english-review-app-20260428T012219Z`
- Profile: Standard
- Context type: Greenfield
- Context snapshot: `.omx/context/english-review-app-20260428T012219Z.md`
- Transcript: `.omx/interviews/english-review-app-20260428T012219Z.md`
- Final ambiguity: 18%
- Threshold: 20%
- Handoff readiness: Ready for planning; `$ralplan` is recommended because the user wants important decisions confirmed before implementation.

## Context Summary

Build a mobile-first web app for reviewing English conversation material learned at an academy. The content is primarily sentences, expressions, and grammar/theory explanations, not simple vocabulary. The user wants to check the app periodically and ideally every day. The workspace is currently greenfield, with no existing app scaffold.

## Intent

Help the user repeatedly review and memorize academy-learned English expressions so they can reduce confusion about when/how to use them and retain the related grammar/theory points.

## Desired Outcome

A mobile-first reveal-quiz app where the user can:

1. Enter learned English expressions/sentences.
2. Store the Korean meaning.
3. Store grammar/theory notes from class.
4. Add a few user-provided example sentences.
5. Review cards by hiding part of the information, recalling it, then revealing it.
6. Mark each card as known or confusing.
7. Revisit confusing cards in later review sessions.

## In Scope for MVP

- Next.js-based mobile-first web app.
- Supabase-backed setup, designed to fit free hosting/free tier constraints where possible.
- Card/item model for sentence/expression-level study material.
- Fields for:
  - English expression/sentence
  - Korean meaning
  - Grammar/theory memo
  - User-provided examples
  - Known/confusing status
  - Basic timestamps or review metadata as needed
- Mobile-first card/reveal review flow.
- Daily review entry point.
- Per-card known/confusing marking.
- A way to prioritize or revisit confusing cards using simple rules.
- Basic creation/editing of study cards sufficient to enter academy material.

## Out of Scope / Non-goals for MVP

- AI generation of examples, explanations, or quizzes.
- Complex exam mode: timers, rankings, long tests, advanced scoring dashboards.
- Full lecture-note app or freeform long-note system.
- Desktop-first optimization.
- Automatically finalizing major decisions without user confirmation.

## Explicitly Not Yet Finalized

These were not fully resolved in the interview and should be confirmed during planning before implementation:

- Whether login/auth is required in MVP or whether Supabase should be used with a minimal personal/single-user setup first.
- Exact Supabase schema and Row Level Security policy shape.
- Exact free hosting target and deployment flow.
- Whether voice/pronunciation features are deferred or simply absent from the initial plan.
- Exact daily card count and review scheduling algorithm.

## Decision Boundaries

OMX may not silently decide major product/technical choices. Planning should present clear recommendations and get confirmation for:

- Auth vs no-auth/single-user flow.
- Supabase data model and security assumptions.
- Hosting/deployment target.
- Review scheduling rule beyond the simple known/confusing concept.
- Any meaningful UI/UX direction that changes the core flow.

OMX may still draft concrete proposals for these decisions; they just must be labeled as proposals rather than final decisions.

## Constraints

- Primary use device: phone.
- Web app is acceptable if mobile-first.
- Tech stack preference/constraint: Next.js + Supabase.
- Cost constraint: free-hosting-friendly, using free tiers where practical.
- User-provided examples; no AI-generated learning content in MVP.
- Keep MVP focused and simple.

## Testable Acceptance Criteria

A planning/execution artifact should ensure the MVP satisfies at least:

1. On a phone-sized viewport, the user can open the app and reach the daily reveal-review flow without desktop-only layout assumptions.
2. The user can create a study card with an English expression/sentence, Korean meaning, grammar/theory memo, and at least one example sentence.
3. The user can start a reveal quiz where at least one part of the card is hidden before reveal.
4. The user can reveal the hidden content with a tap/click.
5. After reveal, the user can mark the card as known or confusing.
6. The app persists the known/confusing state.
7. Confusing cards can be found again or prioritized in a later review session.
8. The app does not include AI content generation in MVP.
9. The app does not include complex exam/timer/ranking features in MVP.
10. The implementation plan uses Next.js + Supabase and identifies a free-hosting-friendly deployment approach.

## Assumptions Exposed + Resolutions

- Initial uncertainty: The user was not sure what the primary learning outcome should be.
  - Resolution: The pain was narrowed to confusion about when/how expressions apply and how theory supports them.
- Potential mismatch: The user selected Korean meaning and grammar/theory memo but not usage context or examples.
  - Resolution: The user will provide a few examples; the app should store and review them, not generate them.
- Product type ambiguity: Could become an AI tutor, exam app, note app, or flashcard app.
  - Resolution: MVP is a focused reveal-quiz review app with per-card known/confusing state.

## Pressure-pass Findings

Round 4 revisited the Round 2/3 mismatch. The interview found that examples still matter, but they should be manually provided by the user from academy content. This prevents the MVP from drifting into AI generation or broad content authoring while still supporting usage-context learning.

## Technical Context Findings

- Repository status: Greenfield/empty app workspace.
- Current contents: `.omx` runtime/state files only.
- No existing framework, package manifest, source tree, or tests were found.
- Planning should include scaffold proposal from scratch.

## Recommended Next Step

Use `$ralplan` with this spec:

```text
$plan --consensus --direct .omx/specs/deep-interview-english-review-app.md
```

Reason: Requirements are clear enough, but the user explicitly does not want major decisions automatically finalized. A consensus planning step should propose architecture, data model, test plan, and decision points before implementation.

## Handoff Options

- `$ralplan` / `$plan --consensus --direct .omx/specs/deep-interview-english-review-app.md` — recommended.
- `$autopilot .omx/specs/deep-interview-english-review-app.md` — only if the user decides the remaining decisions can be made during execution.
- `$ralph .omx/specs/deep-interview-english-review-app.md` — if a persistent single-owner execution loop is desired after planning.
- `$team .omx/specs/deep-interview-english-review-app.md` — if the project expands into parallel UI/data/testing lanes.
- Refine further — if auth, hosting, or review scheduling should be clarified before planning.
