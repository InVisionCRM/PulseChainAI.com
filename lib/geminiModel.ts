// Single source of truth for the Gemini model id used across the app.
//
// Google retired `gemini-2.5-flash` for new API keys on 2026-07-09 — it now
// returns 404 "no longer available to new users" — which broke every Gemini
// feature at once (AI analyst, Richard Heart chat, HEX AI, …). `gemini-flash-latest`
// is Google's documented self-updating alias that always resolves to the current
// stable flash model, so we won't break again the next time a version is retired.
//
// Override with the GEMINI_MODEL env var if a specific pinned version is ever
// needed (e.g. to control cost or lock behavior). The alias moves with every
// release: in November 2026 it pointed at a model that answered this site's key
// with 503 "This model is currently experiencing high demand".
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

/**
 * The Gemini SDK throws Google's error body as a JSON string in `message`
 * ({"error":{"code":503,"message":"…","status":"UNAVAILABLE"}}). Returns the
 * human sentence inside it and its HTTP code, so a route can pass both on
 * instead of the raw blob.
 */
export function geminiError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const body = JSON.parse(raw);
    if (body?.error?.message) {
      const code = Number(body.error.code);
      return { message: String(body.error.message), status: code >= 400 && code < 600 ? code : 500 };
    }
  } catch {
    /* not Google's JSON body: use the text as it is */
  }
  return { message: raw || 'An unknown error occurred', status: 500 };
}
