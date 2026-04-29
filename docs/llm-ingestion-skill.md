# LLM Ingestion Skill Guide

This app expects the LLM assistant to keep the conversation and draft preview outside the normal app UI.

## Flow

1. User tells the LLM what they learned.
2. LLM converts it to the expression-day JSON contract from `lib/validation.ts`.
3. LLM shows the structured draft to the user.
4. User can request revisions multiple times.
5. LLM calls the protected draft/revision API only for draft state.
6. LLM calls the approval API only after explicit approval such as `저장해`, `앱에 넣어줘`, or `이대로 추가해`.
7. LLM reports the saved expression-day URL and expression URLs.

## Card content style

Keep each memorization card light. The approved card should read like:

```text
Coffee doesn't affect me when I sleep.
커피를 마셔도 수면에 영향을 받지 않아요.

비슷한 표현
Caffeine doesn’t keep me awake.
카페인을 마셔도 잠이 안 깨요.

문법/패턴(필요한 경우만)
패턴: affect + 대상 = ~에 영향을 주다
```

Payload mapping:

- `english`: the user-provided main English expression unless the user explicitly asks for correction.
- `korean_prompt`: the user-provided Korean prompt/meaning.
- `examples`: optional natural/similar expressions only, usually 0–1 item.
- `grammar_note`: optional compact grammar/pattern only; prefix each note with `문법:` or `패턴:` and replace verbose tense/context notes with a short prefixed note or omit.
- Leave `nuance_note` and `structure_note` empty unless the user explicitly asks for detailed notes.

Avoid long explanations such as “원문 그대로 암기”, broad nuance paragraphs, or routine tense/context explanations. Put natural rewrites in `examples`, not over the user-provided main expression, unless asked.

## Default grouping for current study batch

Until the user explicitly says otherwise, save new cards under:

- `title`: `1주차 (260427)`
- `day_date`: `2026-04-27`
- `source_note`: `수업 표현`

## API shape

```bash
curl -X POST "$APP_URL/api/ingestion/runs" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @expression-day-payload.json

curl -X PATCH "$APP_URL/api/ingestion/runs/$RUN_ID" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @revised-expression-day-payload.json

curl -X POST "$APP_URL/api/ingestion/runs/$RUN_ID/approve" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"approvalText":"이대로 앱에 넣어줘"}'
```

## Safety rules

- Do not call the approval endpoint for `좋네`, `괜찮아 보임`, or revision requests.
- Do not include `owner_id` in request JSON; the server assigns the owner.
- Do not delete or overwrite existing expression days in MVP.
