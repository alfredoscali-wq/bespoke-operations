/**
 * Bespoke module color identity.
 * CSS tokens live in app/globals.css as --module-* / --module-*-active.
 * Reuse these ids in KPI, cards, charts, and reports.
 */

export const MODULE_COLOR_IDS = [
  "ops",
  "work",
  "customers",
  "attention",
  "commercial",
  "people",
  "intelligence",
  "system",
] as const

export type ModuleColorId = (typeof MODULE_COLOR_IDS)[number]

export const MODULE_COLOR_LABELS: Record<ModuleColorId, string> = {
  ops: "Operación diaria",
  work: "Producción / OT",
  customers: "Clientes",
  attention: "Atención",
  commercial: "Comercial",
  people: "Personas",
  intelligence: "Inteligencia ejecutiva",
  system: "Sistema / neutro",
}

/** CSS custom property for icon / accent usage. */
export function moduleColorVar(
  id: ModuleColorId,
  state: "idle" | "active" = "idle"
): string {
  return state === "active"
    ? `var(--module-${id}-active)`
    : `var(--module-${id})`
}
