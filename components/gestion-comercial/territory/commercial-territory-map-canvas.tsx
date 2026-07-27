"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import {
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { resolveCommercialResponsibleColor } from "@/lib/commercial/responsible-colors"
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, SELECTED_LOCATION_MAP_ZOOM } from "@/lib/gps"
import { resolvePlanningMapBaseLayerConfig } from "@/lib/planificacion/planning-map-tiles"
import type {
  CommercialMapBounds,
  CommercialMapOpportunity,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

import "leaflet/dist/leaflet.css"

type CommercialTerritoryMapCanvasProps = {
  opportunities: CommercialMapOpportunity[]
  selectedId: string | null
  pickMode?: boolean
  employeeNameById: Record<string, string>
  onBoundsChange: (bounds: CommercialMapBounds) => void
  onSelect: (id: string) => void
  onOpenDossier: (id: string) => void
  onPickLocation?: (coords: { latitude: number; longitude: number }) => void
  className?: string
}

function createResponsiblePinIcon(color: string, highlighted: boolean): L.DivIcon {
  const scale = highlighted ? 1.12 : 1
  const width = Math.round(26 * scale)
  const height = Math.round(36 * scale)
  const anchorX = Math.round(width / 2)

  return L.divIcon({
    className: "commercial-map-pin-icon !border-0 !bg-transparent",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 26 36" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 4px rgba(15,23,42,.28))">
      <path d="M13 0C6.925 0 2 4.925 2 11c0 8.25 11 25 11 25s11-16.75 11-25C24 4.925 19.075 0 13 0z" fill="${color}" stroke="#ffffff" stroke-width="1.75"/>
    </svg>`,
    iconSize: [width, height],
    iconAnchor: [anchorX, height],
    popupAnchor: [0, -height + 6],
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function buildPopupHtml(
  opportunity: CommercialMapOpportunity,
  responsibleName: string,
  responsibleColor: string,
  responsibleSoft: string
): string {
  const safeCode = escapeHtml(opportunity.code)
  const safeTitle = escapeHtml(opportunity.title)
  const safePerson = escapeHtml(opportunity.personName)
  const safeResponsible = escapeHtml(responsibleName)

  return `
    <div style="min-width:180px;font-family:system-ui,sans-serif">
      <p style="margin:0;font-size:11px;color:#64748b;font-family:ui-monospace,monospace">${safeCode}</p>
      <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a">${safeTitle}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#475569">${safePerson}</p>
      <p style="margin:6px 0 0;font-size:11px;color:#64748b">
        ${COMMERCIAL_STATUS_LABELS[opportunity.status]} · ${COMMERCIAL_PRIORITY_LABELS[opportunity.priority]}
      </p>
      <p style="margin:6px 0 0;display:flex;align-items:center;gap:6px;font-size:11px;color:#334155">
        <span style="display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:${responsibleSoft};padding:2px 8px;color:#0f172a">
          <span style="width:8px;height:8px;border-radius:999px;background:${responsibleColor};flex-shrink:0"></span>
          ${safeResponsible}
        </span>
      </p>
      <button
        type="button"
        data-commercial-open="${opportunity.id}"
        style="margin-top:8px;width:100%;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:6px 8px;font-size:12px;cursor:pointer"
      >
        Abrir Expediente
      </button>
    </div>
  `
}

const BOUNDS_EPSILON = 1e-7

function readBounds(map: L.Map): CommercialMapBounds {
  const bounds = map.getBounds()
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  }
}

function areMapBoundsEqual(
  left: CommercialMapBounds | null | undefined,
  right: CommercialMapBounds | null | undefined,
  epsilon = BOUNDS_EPSILON
): boolean {
  if (!left || !right) return left === right
  return (
    Math.abs(left.north - right.north) < epsilon &&
    Math.abs(left.south - right.south) < epsilon &&
    Math.abs(left.east - right.east) < epsilon &&
    Math.abs(left.west - right.west) < epsilon
  )
}

export function CommercialTerritoryMapCanvas({
  opportunities,
  selectedId,
  pickMode = false,
  employeeNameById,
  onBoundsChange,
  onSelect,
  onOpenDossier,
  onPickLocation,
  className,
}: CommercialTerritoryMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const onBoundsChangeRef = useRef(onBoundsChange)
  const onSelectRef = useRef(onSelect)
  const onOpenDossierRef = useRef(onOpenDossier)
  const onPickLocationRef = useRef(onPickLocation)
  const pickModeRef = useRef(pickMode)
  const employeeNameByIdRef = useRef(employeeNameById)
  const lastEmittedBoundsRef = useRef<CommercialMapBounds | null>(null)
  const suppressBoundsEmitRef = useRef(false)
  const previousSelectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
    onSelectRef.current = onSelect
    onOpenDossierRef.current = onOpenDossier
    onPickLocationRef.current = onPickLocation
    pickModeRef.current = pickMode
    employeeNameByIdRef.current = employeeNameById
  }, [
    employeeNameById,
    onBoundsChange,
    onOpenDossier,
    onPickLocation,
    onSelect,
    pickMode,
  ])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const layer = resolvePlanningMapBaseLayerConfig("street")
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(
      [DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude],
      DEFAULT_MAP_ZOOM
    )

    L.tileLayer(layer.url, layer.options).addTo(map)
    const markerLayer = L.layerGroup().addTo(map)
    layerRef.current = markerLayer
    mapRef.current = map

    const emitBounds = () => {
      if (suppressBoundsEmitRef.current) return
      const next = readBounds(map)
      if (areMapBoundsEqual(lastEmittedBoundsRef.current, next)) return
      lastEmittedBoundsRef.current = next
      onBoundsChangeRef.current(next)
    }

    map.whenReady(emitBounds)
    map.on("moveend", emitBounds)
    map.on("zoomend", emitBounds)

    map.on("click", (event: L.LeafletMouseEvent) => {
      if (!pickModeRef.current) return
      onPickLocationRef.current?.({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      })
    })

    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        suppressBoundsEmitRef.current = true
        map.invalidateSize({ pan: false })
        // Allow the next user-driven move/zoom to emit; ignore resize noise.
        window.setTimeout(() => {
          suppressBoundsEmitRef.current = false
        }, 0)
      })
    })
    observer.observe(containerRef.current)

    const markers = markersRef.current

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(resizeFrame)
      map.off()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markers.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = layerRef.current
    if (!map || !markerLayer) return

    const nextIds = new Set(opportunities.map((entry) => entry.id))
    for (const [id, marker] of markersRef.current.entries()) {
      if (nextIds.has(id)) continue
      markerLayer.removeLayer(marker)
      marker.off()
      marker.remove()
      markersRef.current.delete(id)
    }

    for (const opportunity of opportunities) {
      const color = resolveCommercialResponsibleColor(
        opportunity.assignedEmployeeId
      )
      const highlighted = opportunity.id === selectedId
      const responsible =
        opportunity.assignedEmployeeId
          ? employeeNameByIdRef.current[opportunity.assignedEmployeeId] ||
            "Responsable"
          : "Sin responsable"
      const existing = markersRef.current.get(opportunity.id)
      const latLng: L.LatLngExpression = [
        opportunity.latitude,
        opportunity.longitude,
      ]
      const popupHtml = buildPopupHtml(
        opportunity,
        responsible,
        color.hex,
        color.soft
      )

      if (existing) {
        existing.setLatLng(latLng)
        existing.setIcon(createResponsiblePinIcon(color.hex, highlighted))
        existing.setPopupContent(popupHtml)
        existing.setZIndexOffset(highlighted ? 1000 : 0)
        continue
      }

      const marker = L.marker(latLng, {
        icon: createResponsiblePinIcon(color.hex, highlighted),
        zIndexOffset: highlighted ? 1000 : 0,
      })
      marker.bindPopup(popupHtml)
      marker.on("click", () => {
        onSelectRef.current(opportunity.id)
      })
      marker.on("popupopen", () => {
        const button = document.querySelector<HTMLButtonElement>(
          `button[data-commercial-open="${opportunity.id}"]`
        )
        if (!button) return
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpenDossierRef.current(opportunity.id)
        }
      })
      marker.addTo(markerLayer)
      markersRef.current.set(opportunity.id, marker)
    }

    const selectionChanged = previousSelectedIdRef.current !== selectedId
    previousSelectedIdRef.current = selectedId

    // Only fly/focus when the user changes selection — never on opportunity refreshes.
    if (selectionChanged && selectedId) {
      const selected = markersRef.current.get(selectedId)
      if (selected) {
        const latLng = selected.getLatLng()
        suppressBoundsEmitRef.current = true
        map.flyTo(latLng, Math.max(map.getZoom(), SELECTED_LOCATION_MAP_ZOOM), {
          duration: 0.35,
        })
        selected.openPopup()

        const releaseSuppress = () => {
          if (!suppressBoundsEmitRef.current) return
          suppressBoundsEmitRef.current = false
          const next = readBounds(map)
          if (areMapBoundsEqual(lastEmittedBoundsRef.current, next)) return
          lastEmittedBoundsRef.current = next
          onBoundsChangeRef.current(next)
        }
        map.once("moveend", releaseSuppress)
        // flyTo may no-op if already centered; don't leave suppress stuck.
        window.setTimeout(releaseSuppress, 450)
      }
    }
  }, [opportunities, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getContainer().style.cursor = pickMode ? "crosshair" : ""
  }, [pickMode])

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-[320px] w-full rounded-lg border", className)}
    />
  )
}
