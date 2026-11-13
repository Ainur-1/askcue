# AI action diagnostics

The buttons invoke different prompts against the selected model:

| Button | Context | Expected output |
| --- | --- | --- |
| Подсказать | Last 180 seconds, recent interim speech, attached screenshots, recent assistant replies | A ready-to-say answer |
| Уточнить | Last 180 seconds; an opening question if no transcript exists | One clarifying question |
| Итоги | Last 120 seconds | 3–5 factual summary points |
| Идеи | Last 180 seconds, detected problem, attached screenshots or screenshot queue | 2–3 approaches and trade-offs |
| Вопросы | Last 120 seconds | Three questions to ask the interviewer |
| Голос | Microphone capture until Stop, then the recognized question | A direct answer |

## Findings from existing records

On 2026-11-13 around 13:57 Moscow time, requests reached OpenCode and failed because the API key had expired. Speech recognition also returned HTTP 429. The latest saved meeting started at 13:54 and contains 51 transcript segments and five canned fallback responses. Those responses were previously presented and stored as if generation had succeeded. Existing history is preserved.

Streaming mode wrappers now propagate provider errors. Expired keys and quota errors appear explicitly in the UI; failed requests do not create successful AI interactions. Empty answers are errors. The suggestion button clears its pending state even when a request is skipped by the three-second cooldown or has no context.

## Reading the new logs

Action metadata is always recorded at `<userData>/logs/ai-actions.jsonl`, independent of verbose audio logging. On Windows this is normally `%APPDATA%/askcue/logs/ai-actions.jsonl`. Use **Settings → General → Open AI action logs** to open the directory.

Each request has a UUID shared across its records and displayed with UI errors:

1. `action.started`: button/mode, model, session start, context window/size, interviewer turns and recent audio/transcript health.
2. `context.prepared` / `context.images`: actual prepared context sizes and image source/count.
3. `llm.request`: prompt/system/context character counts and whether Groq Fast Mode overrides routing.
4. `response.first_token`: latency to first visible text.
5. `response.error`: redacted error and classification such as `api_key_expired`, `rate_limited`, `network`, `timeout`.
6. `action.finished`: completed/error/skipped/no-response outcome, elapsed time, streamed chunks and answer size.

No per-token log lines are written. The action journal does not store prompts, transcripts, answers, audio, screenshots or credentials. It rotates at 5 MB and retains three previous files. General debug output now redacts credentials in both its file and console output; historical debug files are unchanged.

Replacing an expired provider key must be done in model settings. Reauthentication does not renew an expired OpenCode API key. An HTTP 429 alone does not distinguish a temporary rate limit from an exhausted allowance; check the speech provider's quota before retrying.
