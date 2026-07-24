// Single source of truth for the Gemini model id used across the app.
//
// Google retired `gemini-2.5-flash` for new API keys on 2026-07-09 — it now
// returns 404 "no longer available to new users" — which broke every Gemini
// feature at once (AI analyst, Richard Heart chat, HEX AI, …). `gemini-flash-latest`
// is Google's documented self-updating alias that always resolves to the current
// stable flash model, so we won't break again the next time a version is retired.
//
// Override with the GEMINI_MODEL env var if a specific pinned version is ever
// needed (e.g. to control cost or lock behavior).
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
