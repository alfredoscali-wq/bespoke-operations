import type { TileLayerOptions } from "leaflet"

export type PlanningMapBaseLayerId = "satellite" | "street" | "hybrid"

/** Default operational view for supervisors (viviendas, accesos, terrenos). */
export const PLANNING_MAP_DEFAULT_BASE_LAYER: PlanningMapBaseLayerId = "satellite"

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

/** Retained for a future Mapa / Satélite / Híbrido selector. */
const OPEN_STREET_MAP: PlanningMapBaseLayerConfig = {
  id: "street",
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  options: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
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
      return ESRI_WORLD_IMAGERY
  }
}
