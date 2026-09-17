"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import type { GpsLiveCrewMarker, GpsLiveFreshness } from "@/lib/gps-live/types"
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/gps"
import {
  PLANNING_MAP_DEFAULT_BASE_LAYER,
  resolvePlanningMapBaseLayerConfig,
  type PlanningMapSelectableBaseLayerId,
} from "@/lib/planificacion/planning-map-tiles"

import "leaflet/dist/leaflet.css"

const FRESHNESS_COLOR: Record<GpsLiveFreshness, string> = {
  recent: "#16a34a",
  stale: "#d97706",
  missing: "#94a3b8",
}

function createCrewIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "gps-live-crew-pin !border-0 !bg-transparent",
    html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function createDestinationIcon(): L.DivIcon {
  return L.divIcon({
    className: "gps-live-ot-pin !border-0 !bg-transparent",
    html: `<span style="display:block;width:12px;height:12px;border-radius:2px;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

function formatWhen(value: string | null): string {
  if (!value) return "Sin registro"
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return "Sin registro"
  return new Date(parsed).toLocaleString("es-AR")
}

function freshnessLabel(value: GpsLiveFreshness): string {
  if (value === "recent") return "Reciente"
  if (value === "stale") return "Desactualizada"
  return "Sin posición"
}

function buildPopup(crew: GpsLiveCrewMarker): string {
  const accuracy =
    crew.accuracyMeters == null
      ? "—"
      : `${Math.round(crew.accuracyMeters)} m`
  const task = crew.currentTask
    ? `${crew.currentTask.code ? `${crew.currentTask.code} · ` : ""}${crew.currentTask.title} (${crew.currentTask.status})`
    : "Ninguna"

  return `<div style="min-width:12rem">
    <p style="margin:0 0 .25rem;font-weight:600">${crew.workTeamName}</p>
    <p style="margin:0;font-size:12px">Posición: ${freshnessLabel(crew.freshness)}</p>
    <p style="margin:0;font-size:12px">Actualizada: ${formatWhen(crew.receivedAt ?? crew.capturedAt)}</p>
    <p style="margin:0;font-size:12px">Precisión: ${accuracy}</p>
    <p style="margin:0;font-size:12px">OT en curso: ${task}</p>
  </div>`
}

type LiveMapCanvasProps = {
  crews: GpsLiveCrewMarker[]
  selectedWorkTeamId: string | null
  onSelectCrew: (workTeamId: string) => void
  baseLayerId?: PlanningMapSelectableBaseLayerId
}

export function LiveMapCanvas({
  crews,
  selectedWorkTeamId,
  onSelectCrew,
  baseLayerId = PLANNING_MAP_DEFAULT_BASE_LAYER,
}: LiveMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelectCrew)
  onSelectRef.current = onSelectCrew

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }
    const config = resolvePlanningMapBaseLayerConfig(baseLayerId)
    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude], DEFAULT_MAP_ZOOM)
    L.tileLayer(config.url, config.options).addTo(map)
    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [baseLayerId])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const points: L.LatLngExpression[] = []
    const fittedMap = map as L.Map & { __gpsLiveFitted?: boolean }

    for (const crew of crews) {
      if (crew.latitude != null && crew.longitude != null) {
        const marker = L.marker([crew.latitude, crew.longitude], {
          icon: createCrewIcon(FRESHNESS_COLOR[crew.freshness]),
          zIndexOffset: crew.workTeamId === selectedWorkTeamId ? 400 : 0,
        })
        marker.bindPopup(buildPopup(crew))
        marker.on("click", () => onSelectRef.current(crew.workTeamId))
        marker.addTo(layer)
        points.push([crew.latitude, crew.longitude])
      }

      const destination = crew.currentTask?.destination
      if (destination) {
        const dest = L.marker(
          [destination.latitude, destination.longitude],
          { icon: createDestinationIcon(), zIndexOffset: 50 }
        )
        dest.bindPopup(
          `Destino OT${crew.currentTask?.code ? ` ${crew.currentTask.code}` : ""}`
        )
        dest.addTo(layer)
        points.push([destination.latitude, destination.longitude])
      }
    }

    if (!fittedMap.__gpsLiveFitted && points.length > 0) {
      fittedMap.__gpsLiveFitted = true
      if (points.length === 1) {
        map.setView(points[0], 15)
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32] })
      }
    }
  }, [crews, selectedWorkTeamId])

  return (
    <div
      ref={containerRef}
      className="h-[min(70vh,40rem)] w-full overflow-hidden rounded-xl border"
      aria-label="Mapa operativo de cuadrillas"
    />
  )
}
