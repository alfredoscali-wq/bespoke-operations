/** ISO 8601 UTC timestamp for Mobile API envelopes (e.g. `2026-06-29T22:15:30Z`). */
export function getMobileApiServerTime(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
}
