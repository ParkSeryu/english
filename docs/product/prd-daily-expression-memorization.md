# PRD: Daily English Expression Memorization MVP

## Status

- Supersedes: `docs/product/prd-english-review-app-llm-ingestion.md` for the next build direction.
- Rollback checkpoints:
  - `18440a0` previous card MVP checkpoint.
  - `f96eebd` lesson-ingestion implementation checkpoint.
- Implementation status: implemented by team execution on 2026-04-28.

## Product Goal

Build a mobile-first app for memorizing daily English expression bundles from class. The user gives an LLM a simple block like `오늘의 영어표현 (20260427)` plus English sentences and Korean meanings. The LLM parses it, shows a preview, and saves only after explicit approval. The app then helps the learner memorize by showing Korean first and hiding English until reveal.

## Primary User

A learner who attends English lessons, receives several useful sentences per class, and wants to repeatedly memorize those sentences on a phone before or after class.

## Core Thesis

The app is not a grammar notebook and not a heavy lesson-management system. It is a **daily sentence memorization loop**:

1. Save today's expressions.
2. See Korean.
3. Recall English.
4. Reveal answer.
5. Mark `맞췄음` or `모름`.
6. Expressions marked `모름` show up more often.
7. Quickly write questions to ask in class.

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

### Daily expression days

- Store date-based groups such as `오늘의 영어표현 (20260427)`.
- Normalize compact dates like `260427` or `20260427` to `2026-04-27` when clear.
- Show expression count and review progress per set.

### Expression cards

Each expression card supports:

- English answer.
- Korean prompt.
- Optional grammar/important point.
- Optional naturalness/correction note.
- Optional source order within the set.
- Review counters:
  - `unknown_count`
  - `known_count`
  - `review_count`
  - `last_reviewed_at`
  - `last_result` = `known | unknown | null`

### Memorization flow

- Primary mode: Korean prompt → recall English.
- English answer is hidden until user taps `정답 보기`.
- After reveal, user chooses:
  - `맞췄음`
  - `모름`
- `모름` increments `unknown_count` and makes the card appear more frequently.
- `맞췄음` increments `known_count` and lowers priority.

### MVP review scheduling

MVP should use a simple, understandable heuristic instead of a full SRS engine:

1. Higher `unknown_count` first.
2. Never-reviewed cards stay near the front.
3. Cards with repeated `맞췄음` move later.
4. Tie-break by least recently reviewed, then original order.

A short cooldown can be added later if immediate repeats become annoying, but it is intentionally excluded from this MVP implementation.

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
- `created_at`, `updated_at`.

MVP behavior:

- Add a question quickly from the Questions tab.
- Mark as asked / reopen.
- List open questions first.
- Keep it lightweight: no tags, search, calendar, AI rewriting, or long note system.

### LLM ingestion path

- LLM parses the simple daily expression text format.
- LLM shows a preview table with date, English, Korean, and suggested point.
- User can revise through multiple turns.
- Save happens only after explicit approval such as `이대로 앱에 넣어줘`, `저장해`, `추가해`.
- Non-approval feedback such as `좋네`, `예문 좀 바꿔줘`, `이 문장 자연스러워?` must not insert.

## Out of Scope

- Full grammar textbook/notebook.
- Full in-app AI tutor chat.
- Voice/pronunciation.
- Speech recognition.
- Complex spaced repetition or SM-2 style algorithm.
- Gamified scores, rankings, streaks.
- Calendar/class management.
- Bulk destructive edits from LLM.

## Proposed Data Model

### `expression_days`

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)`
- `title text not null`
- `day_date date`
- `raw_input text not null`
- `created_by text not null default 'llm' check in ('llm', 'user')`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `expressions`

- `id uuid primary key`
- `expression_day_id uuid not null references expression_days(id) on delete cascade`
- `owner_id uuid not null references auth.users(id)`
- `english text not null`
- `korean_prompt text not null`
- `grammar_note text`
- `nuance_note text`
- `structure_note text`
- `source_order int not null default 0`
- `unknown_count int not null default 0`
- `known_count int not null default 0`
- `review_count int not null default 0`
- `last_result text check in ('known', 'unknown')`
- `last_reviewed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `question_notes`

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)`
- `question_text text not null`
- `status text not null default 'open' check in ('open', 'asked')`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `ingestion_runs`

Reuse or adapt the existing ingestion run concept, but `normalized_payload` should contain expression-day payloads, not lesson/item payloads.

## App Screens

### `/`

- Today/recent expression day summary.
- CTA: `암기 시작`.
- Counts: total expressions, unknown total, known total, open questions.

### `/expressions`

- Daily expression days by date.
- Each card shows date, title, expression count, unknown count.

### `/expressions/[id]`

- Single expression detail.
- Shows English, Korean prompt, grammar/structure/nuance notes, examples, and user memo form.

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
5. `모름` increments `unknown_count` and increases future queue priority.
6. `맞췄음` increments `known_count` and decreases priority relative to unknown-heavy cards.
7. Grammar points display as hints/support after reveal or detail.
8. Questions tab lets the user add and mark class questions.
9. Supabase RLS keeps expression days, expressions, question notes, and ingestion runs owner-scoped.
10. Mobile e2e covers the main loop: seeded approved set → memorize → mark unknown → card reprioritized → add question.
