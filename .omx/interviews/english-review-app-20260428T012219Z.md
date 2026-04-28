# Deep Interview Transcript: English Review App

- Interview ID: `english-review-app-20260428T012219Z`
- Profile: Standard
- Context type: Greenfield
- Context snapshot: `.omx/context/english-review-app-20260428T012219Z.md`
- Final ambiguity: 18%
- Threshold: 20%
- Result: Requirements clarified enough for planning handoff

## Initial idea

The user wants to build an English conversation review app for material learned at an academy. The app is for repeated review and memorization, focused on sentences, expressions, and theoretical explanations rather than isolated vocabulary. The user expects to study on a phone, so the web app should be mobile-first.

## Codebase preflight

`omx explore` found this workspace to be greenfield/empty: only `.omx` runtime/state files exist, with no `package.json`, source directory, or framework scaffold.

## Rounds

### Round 1 — Outcome
**Question:** 이 앱을 매일 열었을 때, 1차 MVP가 가장 먼저 성공시켜야 할 핵심 학습 결과는 무엇인가요?

**Answer:** 잘모르겠는데

**Interpretation:** The primary learning outcome was not yet obvious. The interview shifted from feature selection to a concrete pain-point example.

### Round 2 — Intent / Outcome
**Question:** 최근 학원에서 배운 문장이나 표현을 복습하려고 했을 때, 가장 자주 막히는 순간은 어디에 가깝나요?

**Answer:** 언제 쓰는지 헷갈림 (`usage-context-confusion`)

**Interpretation:** The core pain is confusion about usage, nuance, grammar/theory, and when a learned expression applies.

### Round 3 — Scope / Outcome
**Question:** ‘언제 쓰는지 헷갈림’을 줄이려면, 학원에서 배운 표현 하나를 앱에 저장할 때 어떤 정보가 반드시 같이 있어야 하나요?

**Answer:** 한국어 뜻, 문법/이론 메모 (`korean-meaning`, `grammar-theory`)

**Interpretation:** Required card fields include Korean meaning and grammar/theory notes. This created a tension with the prior “usage context” pain because examples/context were not selected.

### Round 4 — Contrarian pressure pass
**Question:** 방금은 ‘한국어 뜻’과 ‘문법/이론 메모’만 필수로 골랐습니다. 그런데 앞에서는 문제가 ‘언제 쓰는지 헷갈림’이라고 했어요. 이 둘이 연결되는 가장 정확한 설명은 무엇인가요?

**Answer:** 예문은 몇개 내가 주면 될듯

**Interpretation:** Examples should be user-provided from academy material rather than auto-generated. MVP card content should support Korean meaning, grammar/theory memo, and a few user-entered example sentences.

### Round 5 — Non-goals
**Question:** 1차 MVP에서 명확히 빼야 할 것은 무엇인가요?

**Answer:** AI 자동 생성 제외, 복잡한 시험 모드 제외, 완전한 강의노트 앱 제외, PC 최적화 제외

**Interpretation:** MVP is not an AI generation tool, not a complex test/exam system, not a full note-taking app, and not desktop-first.

### Round 6 — Daily routine / Minimal scope
**Question:** 매일 핸드폰으로 앱을 열었을 때 가장 기본 루틴은 무엇이어야 하나요?

**Answer:** 가림막 퀴즈 (`reveal-quiz`)

**Interpretation:** The core daily interaction should be a reveal-style recall quiz: hide part of the card, recall first, tap to reveal, then mark confidence.

### Round 7 — Success criteria
**Question:** 1차 MVP가 ‘공부에 실제로 도움 된다’고 판단하려면, 매일 복습 후 어떤 기록/상태가 남아야 하나요?

**Answer:** 카드별 앎/헷갈림 (`per-card-confidence`)

**Interpretation:** Success is not primarily score/accuracy. The app should record each card’s known/confusing state and use it for future review.

### Round 8 — Decision boundaries
**Question:** 이후 계획/구현 단계에서 OMX가 사용자 확인 없이 자동으로 결정해도 되는 것은 어디까지인가요?

**Answer:** 아무것도 자동 결정 금지 (`no-auto-decisions`)

**Interpretation:** Important technology, design, storage, and review-rule decisions should be confirmed rather than silently finalized by OMX.

### Round 9 — Tech stack constraint
**Question:** ‘기술스택은 국룰’이라고 하신 뜻을 1차 계획서에는 어떻게 적어둘까요?

**Answer:** next.js + supabase 조합으로 무료로 호스팅 가능하게끔

**Interpretation:** The spec should constrain implementation toward Next.js + Supabase and a free-hosting-friendly setup.

## Clarity breakdown

| Dimension | Clarity | Notes |
|---|---:|---|
| Intent | 85% | Daily academy-material review to reduce confusion about when/how to use expressions and related theory. |
| Outcome | 85% | Mobile reveal quiz using Korean meaning, grammar/theory notes, and user-entered examples. |
| Scope | 80% | Card creation, daily reveal review, per-card known/confusing state; excludes AI generation, complex exams, full notes, desktop-first. |
| Constraints | 80% | Mobile-first, Next.js + Supabase, free-hosting-friendly, confirm major decisions. |
| Success | 75% | User can leave per-card known/confusing state and revisit confusing items. |

Weighted ambiguity: `1 - (0.85×0.30 + 0.85×0.25 + 0.80×0.20 + 0.80×0.15 + 0.75×0.10) = 0.1775 ≈ 18%`.

## Readiness gates

- Non-goals: Resolved.
- Decision boundaries: Resolved.
- Pressure pass: Complete; Round 4 challenged the mismatch between “usage confusion” and initially selected required fields.
