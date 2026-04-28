# PRD: Daily English Expression Memorization MVP

## Status

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
- Normalize compact dates like `260427` or `20260427` to `2026-04-27` when clear.
- Show expression count from shared content and review progress from the current learner's private state.
- Any signed-in learner can read approved expression days; normal app users do not create/edit shared content through the UI.

### Expression cards

Each expression card supports:

- English answer.
- Korean prompt.
- Optional grammar/important point.
- Optional naturalness/correction note.
- Optional source order within the set.
- Shared expression content fields only; no learner-specific review counters live on the shared expression row.
- Per-learner progress fields live in `expression_progress`:
  - `unknown_count`
  - `known_count`
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
- `모름` marks the current learner's state as unknown (`unknown_count: 1`, `known_count: 0`) and makes the card appear more frequently for that learner; repeated taps on the same expression do not stack beyond 1.
- `맞췄음` marks the current learner's state as known (`known_count: 1`, `unknown_count: 0`) and lowers priority for that learner.

### MVP review scheduling

MVP should use a simple, understandable heuristic instead of a full SRS engine:

1. Higher `unknown_count` first.
2. Never-reviewed cards stay near the front.
3. Cards marked known move later.
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

- LLM/admin ingestion is the only supported path for creating shared expression content in this MVP.
- LLM parses the simple daily expression text format.
- LLM shows a preview table with date, English, Korean, and suggested point.
- User can revise through multiple turns.
- Save happens only after explicit approval such as `이대로 앱에 넣어줘`, `저장해`, `추가해`.
- Non-approval feedback such as `좋네`, `예문 좀 바꿔줘`, `이 문장 자연스러워?` must not insert.
- The API remains bearer-token gated; `INGESTION_OWNER_ID` is an audit/import owner, not a visibility boundary.

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

The MVP separates **shared study content** from **private learner state**.

### `expression_days` shared content

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)` as creator/import audit owner, not visibility owner
- `title text not null`
- `day_date date`
- `raw_input text not null`
- `created_by text not null default 'llm' check in ('llm', 'user')`
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
5. `모름` marks `unknown_count` as 1 without repeated-tap stacking and increases future queue priority.
6. `맞췄음` marks `known_count` as 1, clears unknown priority, and decreases priority relative to unknown cards.
7. Grammar points display as hints/support after reveal or detail.
8. Questions tab lets the user add and mark class questions.
9. Supabase RLS lets authenticated users read shared expression content while keeping `expression_progress`, `question_notes`, and `ingestion_runs` scoped to their owner/user.
10. A second signed-in user can see the same expression bank but starts with zero private counters and no private memo.
11. Mobile e2e covers the main loop: seeded approved set → memorize → mark unknown → card reprioritized → add question.
