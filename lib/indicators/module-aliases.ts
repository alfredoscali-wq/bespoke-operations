/**
 * Hotfix / alias layer: legacy Activity Engine modules → canonical modules.
 *
 * Used by Indicator Engine, Ops Intelligence, Workforce Monitor, and Query filters
 * so customer_service events count as Atención everywhere.
 */

/** Legacy module string → canonical module used by indicators & ops areas. */
export const ACTIVITY_MODULE_ALIASES: Readonly<Record<string, string>> = {
  customer_service: "atencion",
  /** Legacy OIE catalog name; commercial instrumentation uses `commercial`. */
  sales: "commercial",
}

export function canonicalizeActivityModule(moduleName: string): string {
  const trimmed = moduleName.trim()
  if (!trimmed) return trimmed
  return ACTIVITY_MODULE_ALIASES[trimmed] ?? trimmed
}

/**
 * Modules to include when filtering by a user-facing / canonical module.
 * Example: filter `atencion` → `["atencion", "customer_service"]`.
 */
export function expandActivityModuleFilter(moduleName: string): string[] {
  const trimmed = moduleName.trim()
  if (!trimmed) return []

  const canonical = canonicalizeActivityModule(trimmed)
  const aliases = Object.entries(ACTIVITY_MODULE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias)

  return [...new Set([canonical, trimmed, ...aliases])]
}
