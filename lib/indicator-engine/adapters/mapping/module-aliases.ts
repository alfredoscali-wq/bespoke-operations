/**
 * Canonical module aliases applied only inside Activity Adapter.
 * Kept local so the rest of Indicator Engine 2.0 never imports Activity Engine
 * or Indicator Engine 1.x alias tables.
 */
export const ADAPTER_MODULE_ALIASES: Readonly<Record<string, string>> = {
  customer_service: "atencion",
  sales: "commercial",
}

export function canonicalizeAdapterModule(moduleName: string): string {
  const trimmed = moduleName.trim()
  if (!trimmed) return trimmed
  return ADAPTER_MODULE_ALIASES[trimmed] ?? trimmed
}
