# PRD: Daily English Expression Memorization MVP

## Status

- Canonical PRD: this document drives the next build direction. Superseded docs are retained for history only and must not drive new implementation.
- Supersedes: `docs/product/prd-english-review-app-llm-ingestion.md` for the next build direction.
- Rollback checkpoints:
  - `18440a0` previous card MVP checkpoint.
  - `f96eebd` lesson-ingestion implementation checkpoint.
- Implementation status: implemented by team execution on 2026-04-28; revised on 2026-04-28 to use a shared expression bank with per-user memorization state.

## Product Goal

Build a mobile-first app for memorizing daily English expression bundles from class. An admin/LLM ingestion flow adds shared expression bundles from a simple block like `오늘의 영어표현 (20260427)` plus English sentences and Korean meanings. All signed-in learners can study the same approved expression bank, while each learner has private memorization counters, review history, memo, and question notes.

## Primary User

Learners who attend the same English lessons and should study the same curated sentence bank, while keeping their own memorization progress private.

## Core Thesis

The app is not a grammar notebook and not a heavy lesson-management system. It is a **daily sentence memorization loop**:

1. Admin/LLM saves today's expressions into the shared bank.
2. Each learner logs in and sees the same approved expressions.
3. See Korean.
4. Recall English.
5. Reveal answer.
6. Mark `맞췄음` or `모름`.
7. Expressions marked `모름` show up more often for that learner only.
8. Quickly write private questions to ask in class.

## Example Input

```text
오늘의 영어표현 (20260427)

The birth rate in Korea is decreasing. (한국의 출산율이 감소하고 있어요.)

I try not to eat. (저는 먹지 않으려고 노력해요.)

They don't seem to care about me. (그들은 저를 신경 쓰지 않는 것 같아요.)

I am used to working for the company. (저는 회사에서 일하는 것에 익숙해졌어요.)

I used to work for the company. (저는 예전에 그 회사에서 일했었어요.)
```

LLM parses this into a dated expression day and sentence cards. It may add short grammar points, but it must not silently rewrite the original English. If a sentence sounds unnatural, the assistant can add a `natural_note` or optional alternative, not replace the memorization answer without user confirmation.

## In Scope

### Shared daily expression days

- Store date-based groups such as `오늘의 영어표현 (20260427)` once as shared content.
- Normalize compact dates like `260427` or `20260427` to `2026-04-27` when clear. Six-digit dates are parsed as `YYMMDD` and mapped to `20YY-MM-DD` for MVP; reject invalid or ambiguous dates instead of guessing silently.
- Show expression count from shared content and review progress from the current learner's private state.
- Any signed-in learner can read approved expression days; normal app users do not create/edit shared content through the UI.
- Approved content is the only learner-visible shared content. Drafts remain in `ingestion_runs` or another non-learner-visible draft store until explicit approval.

### Expression cards

Each expression card supports:

- English answer.
- Korean prompt.
- Optional grammar/important point.
- Optional naturalness/correction note.
- Optional source order within the set.
- Shared expression content fields only; no learner-specific review counters live on the shared expression row.
- Per-learner progress fields live in `expression_progress`:
  - `unknown_count` as cumulative wrong-attempt count across review sessions
  - `known_count` as cumulative correct-attempt count across review sessions
  - `review_count`
  - `last_reviewed_at`
  - `last_result` = `known | unknown | null`
  - `user_memo`

### Memorization flow

- Primary mode: Korean prompt → recall English.
- English answer is hidden until user taps `정답 보기`.
- After reveal, user chooses:
  - `맞췄음`
  - `모름`
- `모름` marks the current learner's latest state as unknown, increments `unknown_count` once for that review session, and makes the card appear more frequently for that learner. Repeated taps on the same revealed card must not stack multiple increments.
- `맞췄음` marks the current learner's latest state as known, increments `known_count` once for that review session, clears immediate unknown priority through `last_result = known`, and removes the card from that learner's memorize queue for 24 hours.

### MVP review scheduling

MVP should use a simple, understandable heuristic instead of a full SRS engine:

1. Higher `unknown_count` first.
2. Never-reviewed cards stay near the front.
3. Cards marked known are hidden for 24 hours after `last_reviewed_at`.
4. After the 24-hour known cooldown, tie-break by known state, least recently reviewed, then original order.

The cooldown is intentionally simple: it only applies to cards whose latest result is `known`; cards marked `unknown` remain eligible immediately.

### Grammar/point support

- LLM may attach concise points like:
  - `be used to + 명사/동명사 = ~에 익숙하다`
  - `used to + 동사원형 = 예전에 ~하곤 했다`
  - `try not to + 동사원형 = ~하지 않으려고 노력하다`
  - `don't seem to + 동사원형 = ~하는 것 같지 않다`
- These points are supporting hints after reveal or on detail, not the main study unit.

### Question ideation / class questions

Add a bottom GNB tab for quick question notes. Purpose: quickly record things to ask during or before class.

Question note MVP fields:

- `question_text` text.
- `status` = `open | asked`.
- Optional `answer_note`.
- Optional `expression_day_id` link for context.
- Optional `expression_id` link for expression-specific questions.
- `created_at`, `updated_at`.

MVP behavior:

- Add a question quickly from the Questions tab.
- Mark as asked / reopen.
- List open questions first.
- Keep it lightweight: no tags, search, calendar, AI rewriting, or long note system.

### LLM ingestion path

- LLM/admin ingestion is the only supported path for creating shared expression content in this MVP.
- LLM parses the simple daily expression text format.
- LLM shows a preview table with date, English, Korean, and suggested point.
- User can revise through multiple turns.
- Save happens only after explicit approval such as `이대로 앱에 넣어줘`, `저장해`, `추가해`.
- Non-approval feedback such as `좋네`, `예문 좀 바꿔줘`, `이 문장 자연스러워?` must not insert.
- The API remains bearer-token gated; `INGESTION_OWNER_ID` is an audit/import owner, not a visibility boundary.
- Only configured ingestion/admin actors can create or update shared expression content. Normal authenticated learners can read approved shared content and manage only their own progress/question rows. Admin identity is controlled by server-side configuration, not a client-provided `owner_id`.

## Out of Scope

- Full grammar textbook/notebook.
- Full in-app AI tutor chat.
- Voice/pronunciation.
- Speech recognition.
- Complex spaced repetition or SM-2 style algorithm.
- Gamified scores, rankings, streaks.
- Calendar/class management.
- Bulk destructive edits from LLM.
- Learner-created shared content through normal mobile UI.

## Proposed Data Model

The MVP separates **shared study content** from **private learner state**.

### `expression_days` shared content

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)` as creator/import audit owner, not visibility owner
- `title text not null`
- `day_date date`
- `raw_input text not null`
- `created_by text not null default 'llm' check in ('llm', 'user')`
- `status text not null default 'approved' check in ('draft', 'approved', 'archived')`; learner queries should only return `approved` rows
- `approved_at timestamptz`
- `approved_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- RLS: authenticated users can read; writes are not exposed to normal app users. Service-role ingestion inserts approved shared content.

### `expressions` shared content

- `id uuid primary key`
- `expression_day_id uuid not null references expression_days(id) on delete cascade`
- `owner_id uuid not null references auth.users(id)` as creator/import audit owner, not visibility owner
- `english text not null`
- `korean_prompt text not null`
- `grammar_note text`
- `nuance_note text`
- `structure_note text`
- `source_order int not null default 0`
- `original_english text` optional source-preservation field when the approved answer differs from the raw input sentence
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- RLS: authenticated users can read all approved expressions; per-user counters are not stored here.

### `expression_examples` shared content

- `id uuid primary key`
- `expression_id uuid not null references expressions(id) on delete cascade`
- `example_text text not null`
- `meaning_ko text`
- `source text not null default 'llm'`
- `sort_order int not null default 0`
- RLS: authenticated users can read examples for shared expressions.

### `expression_progress` private learner state

- `user_id uuid not null references auth.users(id) on delete cascade`
- `expression_id uuid not null references expressions(id) on delete cascade`
- `user_memo text`
- `unknown_count int not null default 0`
- `known_count int not null default 0`
- `review_count int not null default 0`
- `last_result text check in ('known', 'unknown')`
- `last_reviewed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- primary key `(user_id, expression_id)`
- RLS: users can select/insert/update/delete only rows where `user_id = auth.uid()`.

### `question_notes` private learner state

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)`
- `question_text text not null`
- `expression_day_id uuid references expression_days(id) on delete set null`
- `expression_id uuid references expressions(id) on delete set null`
- `status text not null default 'open' check in ('open', 'asked')`
- `answer_note text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- RLS: user-scoped; not shared by default.

### `ingestion_runs`

Reuse or adapt the existing ingestion run concept, but `normalized_payload` should contain expression-day payloads, not lesson/item payloads. Ingestion runs remain scoped to the configured import owner and are not part of the learner-visible shared bank until approved.

## App Screens

### `/`

- Today/recent expression day summary.
- CTA: `암기 시작`.
- Counts: total expressions, unknown total, known total, open questions.

### `/expression-days`

- Daily expression days by date.
- Each card shows date, title, expression count, unknown count.

### `/expression-days/[id]`

- One daily expression bundle.
- Lists all expressions in source order with learner progress per expression.
- CTA: `이 묶음 암기하기`.

### `/expressions/[id]`

- Single expression detail.
- Shows English, Korean prompt, grammar/structure/nuance notes, examples, and user memo form.
- Can start a question note already linked to this expression.

### `/memorize`

- Korean prompt only before reveal.
- Button: `정답 보기`.
- After reveal: English answer, grammar point, `맞췄음`, `모름`.
- Queue uses unknown-weighted priority.

### `/questions`

- Quick input form.
- List open questions first.
- `물어봄` / `다시 열기` action.

## Acceptance Criteria

1. Given a daily expression text block, the LLM/API can validate a structured expression-day payload.
2. No expression day is saved before explicit approval.
3. The app shows date-based expression days.
4. Memorization shows Korean first and hides English before reveal.
5. `모름` increments `unknown_count` once per review session without repeated-tap stacking and increases future queue priority.
6. `맞췄음` increments `known_count` once per review session, clears immediate unknown priority through `last_result = known`, and decreases priority relative to unknown cards.
7. Grammar points display as hints/support after reveal or detail.
8. Questions tab lets the user add and mark class questions.
9. Supabase RLS lets authenticated users read shared expression content while keeping `expression_progress`, `question_notes`, and `ingestion_runs` scoped to their owner/user.
10. A second signed-in user can see the same expression bank but starts with zero private counters and no private memo.
11. Mobile e2e covers the main loop: seeded approved set → memorize → mark unknown → card reprioritized → add question.
12. If the LLM detects an unnatural English sentence, it preserves the original memorization answer and stores any correction as a note or optional alternative unless the user explicitly approves replacement.
13. Normal learners cannot create/edit shared expression content through the app UI or by client-provided owner fields; only configured ingestion/admin actors can write approved shared content.
