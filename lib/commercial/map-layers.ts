/**
 * Commercial map layer keys — prepare Territory map for future overlays
 * (Actividad Comercial Territorial, Obras, OTs, Cobertura, etc.) without
 * redesigning the canvas. Today only `clients` is rendered.
 */
export const COMMERCIAL_MAP_LAYER_KEYS = [
  "clients",
  "commercial_activity",
  "advertising",
  "visits",
  "companies",
  "surveys",
  "projects",
  "work_orders",
  "coverage",
  "infrastructure",
] as const

export type CommercialMapLayerKey = (typeof COMMERCIAL_MAP_LAYER_KEYS)[number]

export const COMMERCIAL_MAP_LAYER_LABELS: Record<CommercialMapLayerKey, string> =
  {
    clients: "Clientes",
    commercial_activity: "Actividad Comercial",
    advertising: "Publicidad",
    visits: "Visitas",
    companies: "Empresas",
    surveys: "Relevamientos",
    projects: "Obras",
    work_orders: "OTs",
    coverage: "Cobertura",
    infrastructure: "Infraestructura",
  }

/** Default visible layers for the commercial territory map (MVP). */
export const COMMERCIAL_MAP_DEFAULT_VISIBLE_LAYERS: readonly CommercialMapLayerKey[] =
  ["clients"]

export const COMMERCIAL_ETIQUETA_FALLBACK_COLOR = "#64748b"

export function resolveCommercialEtiquetaMapColor(
  color: string | null | undefined
): string {
  const trimmed = color?.trim()
  return trimmed || COMMERCIAL_ETIQUETA_FALLBACK_COLOR
}
