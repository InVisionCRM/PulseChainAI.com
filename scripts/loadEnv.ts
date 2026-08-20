/**
 * Loads .env / .env.local for plain `tsx` scripts — and must be the FIRST
 * import in any script that needs them.
 *
 * Next.js reads those files for `next dev` / `next build` / API routes, but
 * that is a Next convenience rather than a Node one, so a `tsx scripts/foo.ts`
 * invocation sees none of it. The subtle part is WHERE the loader runs:
 *
 *     import { loadEnvConfig } from '@next/env';
 *     loadEnvConfig(process.cwd());        // ← looks like it runs first
 *     import { sql } from '@/lib/db/connection';
 *
 * That does not work. ES module imports are evaluated before ANY statement in
 * the module body, so `connection.ts` — which reads process.env.DATABASE_URL at
 * module scope — has already run and cached `sql = null` by the time the loader
 * is called. Verified: with DATABASE_URL sitting in .env, the script above
 * still prints "DATABASE_URL not found" and the whole DB layer is dead for the
 * process. Lazily-read variables (a key read inside a function) survived it,
 * which is what made the bug look like a database problem rather than an
 * ordering one.
 *
 * A side-effect import has no such problem: imports are evaluated in source
 * order, so this module runs to completion before the ones under it are
 * touched.
 *
 *     import './loadEnv';                  // ← must be first
 *     import { sql } from '@/lib/db/connection';
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
