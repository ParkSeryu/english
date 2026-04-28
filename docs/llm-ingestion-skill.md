# LLM Ingestion Skill Guide

This app expects the LLM assistant to keep the conversation and draft preview outside the normal app UI.

## Flow

1. User tells the LLM what they learned.
2. LLM converts it to the lesson JSON contract from `docs/product/prd-english-review-app-llm-ingestion.md`.
3. LLM shows the structured draft to the user.
4. User can request revisions multiple times.
5. LLM calls the protected draft/revision API only for draft state.
6. LLM calls the approval API only after explicit approval such as `저장해`, `앱에 넣어줘`, or `이대로 추가해`.
7. LLM reports the saved lesson URL and item URLs.

## API shape

```bash
curl -X POST "$APP_URL/api/ingestion/runs" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @lesson-payload.json

curl -X PATCH "$APP_URL/api/ingestion/runs/$RUN_ID" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @revised-lesson-payload.json

curl -X POST "$APP_URL/api/ingestion/runs/$RUN_ID/approve" \
  -H "Authorization: Bearer $INGESTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"approvalText":"이대로 앱에 넣어줘"}'
```

## Safety rules

- Do not call the approval endpoint for `좋네`, `괜찮아 보임`, or revision requests.
- Do not include `owner_id` in request JSON; the server assigns the owner.
- Do not delete or overwrite existing lessons in MVP.
