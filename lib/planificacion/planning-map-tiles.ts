import type { TileLayerOptions } from "leaflet"

export type PlanningMapBaseLayerId = "satellite" | "street" | "hybrid"
export type PlanningMapSelectableBaseLayerId = "street" | "satellite"

/**
 * Default operational view: OSM street cartography so supervisors see
 * street names, avenues, neighborhoods, localities and roads.
 */
export const PLANNING_MAP_DEFAULT_BASE_LAYER: PlanningMapSelectableBaseLayerId =
  "street"

export const PLANNING_MAP_SELECTABLE_BASE_LAYERS: readonly PlanningMapSelectableBaseLayerId[] =
  ["street", "satellite"]

export const PLANNING_MAP_BASE_LAYER_OPTIONS: ReadonlyArray<{
  id: PlanningMapSelectableBaseLayerId
  label: string
}> = [
  { id: "street", label: "🗺️ Calles" },
  { id: "satellite", label: "🛰️ Satélite" },
]

export const PLANNING_MAP_BASE_LAYER_SESSION_KEY =
  "bespoke.planning.map-base-layer"

export type PlanningMapBaseLayerConfig = {
  id: PlanningMapBaseLayerId
  url: string
  options: TileLayerOptions
}

const ESRI_WORLD_IMAGERY: PlanningMapBaseLayerConfig = {
  id: "satellite",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  options: {
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, IGP, and the GIS User Community",
    maxZoom: 19,
  },
}

/**
 * OpenStreetMap standard tiles (HTTPS). Viewport caching only; tiles load
 * as the map is panned or zoomed. Labels come from the cartography.
 */
const OPEN_STREET_MAP: PlanningMapBaseLayerConfig = {
  id: "street",
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  options: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
    subdomains: "abc",
  },
}

export function isPlanningMapSelectableBaseLayerId(
  value: unknown
): value is PlanningMapSelectableBaseLayerId {
  return value === "street" || value === "satellite"
}

export function resolvePlanningMapBaseLayerConfig(
  layerId: PlanningMapBaseLayerId = PLANNING_MAP_DEFAULT_BASE_LAYER
): PlanningMapBaseLayerConfig {
  switch (layerId) {
    case "street":
      return OPEN_STREET_MAP
    case "satellite":
      return ESRI_WORLD_IMAGERY
    case "hybrid":
      return ESRI_WORLD_IMAGERY
    default:
      return OPEN_STREET_MAP
  }
}

export function readPlanningMapBaseLayerFromSession(): PlanningMapSelectableBaseLayerId {
  if (typeof window === "undefined") {
    return PLANNING_MAP_DEFAULT_BASE_LAYER
  }

  try {
    const raw = window.sessionStorage.getItem(PLANNING_MAP_BASE_LAYER_SESSION_KEY)
    if (isPlanningMapSelectableBaseLayerId(raw)) {
      return raw
    }
    return PLANNING_MAP_DEFAULT_BASE_LAYER
  } catch {
    return PLANNING_MAP_DEFAULT_BASE_LAYER
  }
}

export function writePlanningMapBaseLayerToSession(
  layerId: PlanningMapSelectableBaseLayerId
): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(PLANNING_MAP_BASE_LAYER_SESSION_KEY, layerId)
  } catch {
    // Ignore quota or privacy mode errors.
  }
}
