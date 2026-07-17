# Gemini AI Analysis

The Gemini integration is optional and runs only in the backend after deterministic item parsing, build scoring, crafting evaluation and market valuation have completed.

## Configuration

Copy `.env.example` to `.env`, set `GEMINI_API_KEY` from Google AI Studio, then keep the file private. The key is never sent to React, logged, saved in checks, or returned by the API.

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`; set `GEMINI_ENABLED=false` to disable requests. The service times out after 12 seconds by default, retries one temporary server/network failure, and returns a safe unavailable state for missing keys, rate limits, invalid responses, and outages.

## Output and limits

Gemini receives only structured deterministic findings. It cannot set prices, replace market results, invent mods, or override crafting legality. The market engine remains the sole source for market values. Free-tier limits depend on the Google account and can change; a rate limit does not interrupt item analysis.

## Contextual coaches

Build Doctor and item-sale results expose an optional conversational coach. Build conversations receive the computed profile diagnosis, totals, weakest slots, upgrade order and swap-safety alerts. Sale conversations receive the parsed item, deterministic recommendation, market evidence, comparables, liquidity signals and crafting potential.

Chat history is limited to the last eight visible messages and is sent with each request. The application does not currently persist conversations. Responses use a validated JSON schema containing an answer, confidence, facts used, warnings and suggested UI actions. Suggested actions do not execute purchases, listings, equipment changes or crafting operations.

`GEMINI_CHAT_MODEL` can override the model used for conversations while leaving `GEMINI_MODEL` unchanged for the original item explanation.

## Troubleshooting

If `aiAnalysis.available` is false, the rest of `/api/analyze` is still valid. Check `GEMINI_ENABLED`, the server-only key, model availability in Google AI Studio, and rate limits. Do not add the key to a `VITE_` variable or commit `.env`.
