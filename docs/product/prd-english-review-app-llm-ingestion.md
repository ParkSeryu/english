# PRD: English Review App — LLM-Assisted Lesson Ingestion MVP

## Status

- Workflow: replanning after rollback checkpoint commit `18440a0`.
- Previous MVP direction: user manually enters cards in the app.
- Revised direction: user tells an LLM what they learned; the LLM structures and inserts lesson data into the app; the app focuses on review, memorization, and user notes.
- Implementation status: not started for this revised direction.

## Product Goal

Build a mobile-first English review app where lesson content is added through an LLM assistant/skill, not through a heavy in-app input form. The app should help the learner review and memorize expressions learned in class, while preserving personal notes about what the teacher said or what felt confusing.

The core experience is:

1. User tells the LLM what they learned.
2. LLM converts that lesson into structured study items.
3. LLM inserts the structured items into the app database.
4. User opens the app to review, memorize, mark confidence, and add personal notes.

## Primary User

A learner attending an English academy who wants to quickly capture class material after class and repeatedly review it on a phone.

## User Jobs

1. Tell an LLM, in natural language, what expressions or patterns were learned.
2. Have those expressions cleaned up into a study-friendly format without filling app forms.
3. Review the resulting lesson notes later on mobile.
4. Memorize expression meaning, structure, and usage through lightweight recall modes.
5. Add or edit personal notes after review, especially teacher comments or personal confusion points.

## Revised Product Thesis

The app is not primarily a data-entry app. It is a review surface for LLM-curated lesson material.

The LLM is responsible for ingestion and structuring. The app is responsible for presentation, memorization, lightweight edits, and review state.

## Example Flow

User says to the LLM:

```text
어제 have to랑 I am used to 배웠어.
have to는 할 필요가 있다, 의무 느낌이고
I am used to는 ~에 익숙해졌다 느낌이야.
정리해서 앱에 넣어줘.
```

LLM inserts structured items like:

### have to ~

- Korean meaning: ~해야 한다 / ~할 필요가 있다
- Core feeling: 의무, 필요성
- Form: have to + 동사원형
- Examples:
  - I have to study English.
  - I have to go now.
- Confusion points:
  - `have to` 뒤에는 동사원형이 온다.
- Source note:
  - 2026-04-27 학원 수업
- User memo:
  - 선생님이 must보다 일상적으로 많이 쓴다고 설명함.

### I am used to ~

- Korean meaning: ~에 익숙하다 / ~에 익숙해졌다
- Core feeling: 어떤 상황이나 행동이 더 이상 낯설지 않음
- Form: be used to + 명사 / 동명사
- Examples:
  - I am used to waking up early.
  - I am used to this weather.
- Confusion points:
  - `to` 뒤에 동사원형이 아니라 명사 또는 -ing가 온다.

## MVP Scope

### In scope

#### LLM ingestion path

- Define a structured lesson-ingestion contract for LLM/tool use.
- Provide an LLM-facing command/skill/API path that can add lesson material to Supabase.
- Accept natural-language lesson input outside the app UI.
- Let the LLM create structured study items from the lesson input.
- Store the original raw lesson note for traceability.
- Store whether fields were user-provided vs LLM-normalized where practical.

#### App review surface

- Mobile-first dashboard.
- Lesson list grouped by date/source.
- Expression/detail page.
- Review mode focused on memorization.
- Confidence marking: new, learning, memorized, confusing.
- User memo editing from the app.
- Confusion note editing from the app.
- Confusing-first review scheduling.

#### Study item fields

Each study item should support:

- Expression/pattern: e.g. `have to ~`
- Korean meaning
- Core nuance/feeling
- Structure/formula
- Grammar note
- Example sentences
- Common mistakes/confusion points
- User memo
- Source note or lesson date
- Review status
- Review metadata: last reviewed, review count

#### Memorization modes

MVP review should support at least:

1. Korean meaning/nuance → recall English expression.
2. English expression → recall Korean meaning/usage.
3. Structure prompt → recall pattern/formula.

Blank quiz generation can be planned but does not need to be fully advanced in the first pass.

### Out of scope for revised MVP

- Heavy in-app lesson input form as the primary data path.
- Full AI tutor chat inside the app.
- Voice/pronunciation.
- Automatic speech recognition.
- Exam mode, timers, rankings, leaderboards.
- Complex spaced repetition algorithm beyond confusing-first + least-recently-reviewed.
- Public no-auth deployment.
- Letting LLM overwrite or delete user data without an explicit confirmation path.

## Key Product Decisions

### Decision 1 — Data entry ownership

**Decision:** LLM owns primary data entry. The app only supports lightweight user edits, especially notes and corrections.

Rationale: The user does not want to manually fill app forms. The value is that the LLM turns rough lesson memory into clean study material.

### Decision 2 — User memo

**Decision:** User memo is first-class and editable in the app.

Rationale: The teacher's exact framing and the learner's personal confusion often matter more than generic grammar explanations.

### Decision 3 — LLM output trust

**Decision:** LLM-created data should be reviewable and correctable. The app should show that the material was generated/structured by the assistant and allow edits.

Rationale: English explanations can be subtly wrong or not match what the teacher taught.

### Decision 4 — Ingestion safety

**Decision:** LLM can create/add items, but destructive actions such as delete/overwrite should require explicit confirmation or be out of scope.

Rationale: Prevent accidental loss from assistant mistakes.

## Proposed Data Model

This supersedes the previous manual-card-centric model.

### `lessons`

- `id uuid primary key`
- `owner_id uuid references auth.users(id)`
- `title text not null`
- `raw_input text not null`
- `source_note text`
- `lesson_date date`
- `created_by text not null default 'llm'` check in `('llm', 'user')`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `study_items`

- `id uuid primary key`
- `lesson_id uuid references lessons(id) on delete cascade`
- `owner_id uuid references auth.users(id)`
- `expression text not null`
- `meaning_ko text not null`
- `core_nuance text`
- `structure_note text`
- `grammar_note text`
- `user_memo text`
- `confusion_note text`
- `status text not null default 'new'` check in `('new', 'learning', 'memorized', 'confusing')`
- `last_reviewed_at timestamptz`
- `review_count int not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `study_examples`

- `id uuid primary key`
- `study_item_id uuid references study_items(id) on delete cascade`
- `example_text text not null`
- `meaning_ko text`
- `source text not null default 'llm'` check in `('llm', 'user', 'class')`
- `sort_order int not null default 0`
- `created_at timestamptz not null default now()`

### `ingestion_runs`

- `id uuid primary key`
- `owner_id uuid references auth.users(id)`
- `raw_input text not null`
- `normalized_payload jsonb not null`
- `status text not null` check in `('drafted', 'inserted', 'failed')`
- `error_message text`
- `created_at timestamptz not null default now()`

## RLS / Auth Requirements

- Keep Supabase Auth.
- All tables must be owner-scoped.
- Users can only select/insert/update/delete their own lessons, study items, examples, and ingestion runs.
- LLM ingestion must operate as the authenticated user or through a safe server-side route that assigns `owner_id` from the authenticated session.
- No public no-auth insert endpoint.
- Service role keys must never be exposed to the browser.

## LLM Ingestion Contract

The assistant/skill should output a payload like:

```json
{
  "lesson": {
    "title": "have to / be used to",
    "raw_input": "어제 have to랑 I am used to 배웠어...",
    "source_note": "학원 수업",
    "lesson_date": "2026-04-27"
  },
  "items": [
    {
      "expression": "have to ~",
      "meaning_ko": "~해야 한다 / ~할 필요가 있다",
      "core_nuance": "의무나 필요성을 나타냄",
      "structure_note": "have to + 동사원형",
      "grammar_note": "주어에 따라 has to로 바뀔 수 있음",
      "examples": [
        {
          "example_text": "I have to study English.",
          "meaning_ko": "나는 영어를 공부해야 한다.",
          "source": "llm"
        }
      ],
      "confusion_note": "must와 의미가 비슷하지만 일상에서는 have to가 자주 쓰임",
      "user_memo": ""
    }
  ]
}
```

## App Screens

### `/`

- Today/recent lesson summary.
- CTA: 오늘 복습 시작.
- Counts: 새 표현, 학습 중, 암기함, 헷갈림.

### `/lessons`

- Lessons grouped by date/source.
- Show lesson title and number of study items.

### `/lessons/[id]`

- Lesson raw input summary.
- All study items in that lesson.
- Link to each expression detail.

### `/items/[id]`

- Expression detail page.
- Meaning, nuance, structure, grammar, examples.
- Editable user memo and confusion note.

### `/review`

- Review queue.
- Modes:
  - 뜻 보고 표현 떠올리기.
  - 표현 보고 뜻 떠올리기.
  - 구조 보고 패턴 떠올리기.
- Mark as memorized/confusing/learning.

### Optional admin/dev route

- `/ingestion-preview` only if useful for local debugging.
- Must not become the primary user input path unless later confirmed.

## User Stories

### US-001 — Add lesson through LLM

As a learner, I can tell the LLM what I learned so that it creates structured study items without me filling forms in the app.

Acceptance:

- Natural-language lesson input can be converted into the ingestion payload.
- Payload validates before insertion.
- Inserted lesson and items appear in the app.
- Raw input is stored for traceability.

### US-002 — Review structured lesson notes

As a learner, I can open the app and see lessons/items organized clearly so that I can review what I learned.

Acceptance:

- Lessons are grouped by date/source.
- Study items show expression, meaning, nuance, structure, and examples.
- Mobile view is readable.

### US-003 — Edit personal notes

As a learner, I can add my own memo or confusion note so that class-specific details are preserved.

Acceptance:

- User memo can be edited in the app.
- Confusion note can be edited in the app.
- Edits persist after refresh.

### US-004 — Memorize through recall

As a learner, I can use recall prompts so that I actively memorize expressions instead of only reading.

Acceptance:

- Meaning-to-expression reveal mode exists.
- Expression-to-meaning reveal mode exists.
- Structure/formula recall prompt exists or is represented in review.
- The answer is hidden before reveal.

### US-005 — Track confidence

As a learner, I can mark items as memorized, learning, or confusing so that the review queue adapts.

Acceptance:

- Marking updates status, last reviewed timestamp, and review count.
- Confusing items are prioritized later.
- Status persists after refresh.

## RALPLAN-DR Summary

### Principles

1. LLM handles capture/structuring; app handles review/memorization.
2. User notes are first-class, not an afterthought.
3. Review should be active recall, not just reading.
4. Data safety: LLM may add, but destructive actions require stronger controls.
5. Mobile-first, low-friction daily use.

### Decision Drivers

1. Reduce friction after class.
2. Preserve class-specific context.
3. Improve memorization through repeated recall.

### Options Considered

#### Option A — Recommended: LLM ingestion + review-only app

Pros:
- Matches the user's desired workflow.
- Keeps app UI simple.
- Lets LLM add structure and examples.

Cons:
- Requires reliable ingestion contract and validation.
- Needs auth/session-safe insertion path.

#### Option B — App form remains primary

Pros:
- Simpler technically.
- Less LLM/tool integration complexity.

Cons:
- Does not match the user's desired workflow.
- High manual-entry friction.

#### Option C — Full AI tutor inside app

Pros:
- Richer product long-term.

Cons:
- Too broad for MVP.
- Distracts from review/memorization.

## ADR

### Decision

Shift MVP direction to LLM-assisted lesson ingestion with a mobile review/memorization app.

### Drivers

- User wants to tell the LLM what was learned and have it inserted into the app.
- User wants review and memorization, not manual card entry.
- User wants personal memo support.

### Alternatives Considered

- Keep manual card-entry app.
- Build full AI tutor/chat UI in app.

### Why Chosen

This option best matches the user's actual workflow: conversational capture through the LLM, then focused mobile review.

### Consequences

- Existing manual-card MVP will need schema and UI refactor.
- Need an ingestion API/CLI/skill.
- Need stricter validation and safety around LLM-generated data.
- Supabase Auth/RLS remains required.

### Follow-ups

1. Define the exact LLM skill interface: local Codex skill, CLI script, or protected API route.
2. Decide whether LLM insertion uses user's Supabase session or a server-side authenticated route.
3. Refactor schema from `study_cards/card_examples` to `lessons/study_items/study_examples`.
4. Redesign app screens around lessons/items/review rather than card entry.
