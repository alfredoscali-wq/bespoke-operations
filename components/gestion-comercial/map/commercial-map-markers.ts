/**
 * Contratos y helpers del mapa comercial libres de Leaflet.
 *
 * `commercial-map-canvas` importa `leaflet`, que accede a `window` al evaluarse:
 * cualquier import estático de ese archivo rompe el prerender del build aunque
 * el canvas se cargue con `dynamic(..., { ssr: false })`. Los consumidores que
 * solo necesitan tipos o el escape de HTML deben importar desde aquí.
 */

/** Shared commercial map modes — clients vs territorial field activity. */
export type CommercialMapMode = "clients" | "activity"

export type CommercialMapMarker = {
  id: string
  latitude: number
  longitude: number
  color: string
  popupHtml: string
  /** data-* attribute selector value for the detail button in popup HTML */
  detailActionId?: string
}

export type CommercialMapDraftPin = {
  latitude: number
  longitude: number
  color?: string
}

export function escapeCommercialMapHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
