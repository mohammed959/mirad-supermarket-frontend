/**
 * Client-side feature flags.
 *
 * `NEXT_PUBLIC_*` env vars are inlined by Next.js at build time, so
 * flipping a flag is a rebuild-and-deploy operation (no runtime toggle).
 *
 * `parseBooleanFlag` is intentionally strict: only the literal string
 * `true` (case-insensitive, trimmed) enables a flag. Values such as
 * `false`, `0`, `no`, `""`, and `undefined` all disable it. This
 * prevents an accidental "any non-empty string is truthy" rollout.
 */
export function parseBooleanFlag(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'true';
}

/**
 * Enable the single-request marketplace homepage aggregation.
 *
 * When true, the homepage issues one `GET /api/storefront/home` call
 * and distributes its payload to strips via props. When false, each
 * strip fetches independently (legacy V1 behavior).
 */
export const USE_HOME_AGGREGATE = parseBooleanFlag(
  process.env.NEXT_PUBLIC_USE_HOME_AGGREGATE,
);
