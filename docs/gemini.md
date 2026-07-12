# Gemini AI Analysis

The Gemini integration is optional and runs only in the backend after deterministic item parsing, build scoring, crafting evaluation and market valuation have completed.

## Configuration

Copy `.env.example` to `.env`, set `GEMINI_API_KEY` from Google AI Studio, then keep the file private. The key is never sent to React, logged, saved in checks, or returned by the API.

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`; set `GEMINI_ENABLED=false` to disable requests. The service times out after 12 seconds by default, retries one temporary server/network failure, and returns a safe unavailable state for missing keys, rate limits, invalid responses, and outages.

## Output and limits

Gemini receives only structured deterministic findings. It cannot set prices, replace market results, invent mods, or override crafting legality. The market engine remains the sole source for market values. Free-tier limits depend on the Google account and can change; a rate limit does not interrupt item analysis.

## Troubleshooting

If `aiAnalysis.available` is false, the rest of `/api/analyze` is still valid. Check `GEMINI_ENABLED`, the server-only key, model availability in Google AI Studio, and rate limits. Do not add the key to a `VITE_` variable or commit `.env`.
