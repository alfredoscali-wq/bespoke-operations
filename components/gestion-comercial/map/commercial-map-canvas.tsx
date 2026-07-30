"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import type {
  CommercialMapDraftPin,
  CommercialMapMarker,
  CommercialMapMode,
} from "@/components/gestion-comercial/map/commercial-map-markers"
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, SELECTED_LOCATION_MAP_ZOOM } from "@/lib/gps"
import { resolvePlanningMapBaseLayerConfig } from "@/lib/planificacion/planning-map-tiles"
import type { CommercialMapBounds } from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

import "leaflet/dist/leaflet.css"

type CommercialMapCanvasProps = {
  mode: CommercialMapMode
  markers: CommercialMapMarker[]
  selectedId: string | null
  pickMode?: boolean
  draftPin?: CommercialMapDraftPin | null
  /** Recenters the map whenever these coordinates change (e.g. GPS resolved). */
  focusPoint?: { latitude: number; longitude: number } | null
  /** Set false to freeze pan/zoom/keyboard while a drawer or dialog is open. */
  interactive?: boolean
  onBoundsChange: (bounds: CommercialMapBounds) => void
  onSelect: (id: string) => void
  onOpenDetail?: (id: string) => void
  onPickLocation?: (coords: { latitude: number; longitude: number }) => void
  className?: string
}

export function createCommercialMapPinIcon(
  color: string,
  highlighted: boolean
): L.DivIcon {
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

/**
 * Shared Leaflet shell for Gestión Comercial maps.
 * mode="clients" → Territorio (Clientes); mode="activity" → Actividad Comercial.
 * Same map init, tiles, bounds, pickMode, draft pin — different marker sources.
 */
export function CommercialMapCanvas({
  mode,
  markers,
  selectedId,
  pickMode = false,
  draftPin = null,
  focusPoint = null,
  interactive = true,
  onBoundsChange,
  onSelect,
  onOpenDetail,
  onPickLocation,
  className,
}: CommercialMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const draftMarkerRef = useRef<L.Marker | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const detailActionIdsRef = useRef<Map<string, string>>(new Map())
  const onBoundsChangeRef = useRef(onBoundsChange)
  const onSelectRef = useRef(onSelect)
  const onOpenDetailRef = useRef(onOpenDetail)
  const onPickLocationRef = useRef(onPickLocation)
  const pickModeRef = useRef(pickMode)
  const lastEmittedBoundsRef = useRef<CommercialMapBounds | null>(null)
  const suppressBoundsEmitRef = useRef(false)
  const previousSelectedIdRef = useRef<string | null>(null)
  const modeRef = useRef(mode)

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
    onSelectRef.current = onSelect
    onOpenDetailRef.current = onOpenDetail
    onPickLocationRef.current = onPickLocation
    pickModeRef.current = pickMode
    modeRef.current = mode
  }, [mode, onBoundsChange, onOpenDetail, onPickLocation, onSelect, pickMode])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const container = containerRef.current
    const layer = resolvePlanningMapBaseLayerConfig("street")
    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
    }).setView(
      [DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude],
      DEFAULT_MAP_ZOOM
    )

    L.tileLayer(layer.url, layer.options).addTo(map)
    // One layer group for the active mode. Future multi-layer maps can add
    // more groups keyed by COMMERCIAL_MAP_LAYER_KEYS without redesigning this shell.
    const markersLayer = L.layerGroup().addTo(map)
    layerRef.current = markersLayer
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

    // Delegado en el contenedor a propósito: Leaflet reemplaza el nodo del popup
    // en cada `setPopupContent`, así que un handler atado al botón muere en la
    // siguiente actualización de marcadores (seleccionar un pin ya dispara una).
    // Leaflet solo detiene mousedown/dblclick/contextmenu, el click nativo burbujea.
    const handleDetailClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const trigger = target.closest("[data-commercial-map-detail]")
      const detailId = trigger?.getAttribute("data-commercial-map-detail")
      if (!detailId) return
      event.preventDefault()
      event.stopPropagation()
      const markerId = detailActionIdsRef.current.get(detailId) ?? detailId
      onOpenDetailRef.current?.(markerId)
    }
    container.addEventListener("click", handleDetailClick)

    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        suppressBoundsEmitRef.current = true
        map.invalidateSize({ pan: false })
        window.setTimeout(() => {
          suppressBoundsEmitRef.current = false
        }, 0)
      })
    })
    observer.observe(container)

    const markersMap = markersRef.current
    const detailActionIds = detailActionIdsRef.current

    return () => {
      observer.disconnect()
      container.removeEventListener("click", handleDetailClick)
      window.cancelAnimationFrame(resizeFrame)
      map.off()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      draftMarkerRef.current = null
      markersMap.clear()
      detailActionIds.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = layerRef.current
    if (!map || !markerLayer) return

    const detailActionIds = detailActionIdsRef.current
    detailActionIds.clear()
    for (const entry of markers) {
      detailActionIds.set(entry.detailActionId ?? entry.id, entry.id)
    }

    const nextIds = new Set(markers.map((entry) => entry.id))
    for (const [id, marker] of markersRef.current.entries()) {
      if (nextIds.has(id)) continue
      markerLayer.removeLayer(marker)
      marker.off()
      marker.remove()
      markersRef.current.delete(id)
    }

    for (const entry of markers) {
      const highlighted = entry.id === selectedId
      const existing = markersRef.current.get(entry.id)
      const latLng: L.LatLngExpression = [entry.latitude, entry.longitude]
      const icon = createCommercialMapPinIcon(entry.color, highlighted)

      if (existing) {
        existing.setLatLng(latLng)
        existing.setIcon(icon)
        // Reescribir el mismo HTML remontaría el popup abierto y cancelaría el
        // click en curso (el nodo desaparece entre mousedown y mouseup).
        if (existing.getPopup()?.getContent() !== entry.popupHtml) {
          existing.setPopupContent(entry.popupHtml)
        }
        existing.setZIndexOffset(highlighted ? 1000 : 0)
        continue
      }

      const marker = L.marker(latLng, {
        icon,
        zIndexOffset: highlighted ? 1000 : 0,
      })
      marker.bindPopup(entry.popupHtml)
      marker.on("click", () => {
        onSelectRef.current(entry.id)
      })
      marker.addTo(markerLayer)
      markersRef.current.set(entry.id, marker)
    }

    const selectionChanged = previousSelectedIdRef.current !== selectedId
    previousSelectedIdRef.current = selectedId

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
        window.setTimeout(releaseSuppress, 450)
      }
    }
  }, [markers, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!draftPin) {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove()
        draftMarkerRef.current = null
      }
      return
    }

    const latLng: L.LatLngExpression = [draftPin.latitude, draftPin.longitude]
    const icon = createCommercialMapPinIcon(draftPin.color ?? "#2563eb", true)

    if (draftMarkerRef.current) {
      draftMarkerRef.current.setLatLng(latLng)
      draftMarkerRef.current.setIcon(icon)
      return
    }

    const marker = L.marker(latLng, {
      icon,
      zIndexOffset: 2000,
      draggable: true,
    })
    marker.on("dragend", () => {
      const next = marker.getLatLng()
      onPickLocationRef.current?.({
        latitude: Number(next.lat.toFixed(7)),
        longitude: Number(next.lng.toFixed(7)),
      })
    })
    marker.addTo(map)
    draftMarkerRef.current = marker
  }, [draftPin])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getContainer().style.cursor = pickMode ? "crosshair" : ""
  }, [pickMode])

  const focusKey = focusPoint
    ? `${focusPoint.latitude},${focusPoint.longitude}`
    : null

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusKey) return
    const [latitude, longitude] = focusKey.split(",").map(Number)
    map.setView(
      [latitude, longitude],
      Math.max(map.getZoom(), SELECTED_LOCATION_MAP_ZOOM),
      { animate: false }
    )
  }, [focusKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.scrollWheelZoom,
      map.boxZoom,
      map.keyboard,
    ]

    for (const handler of handlers) {
      if (!handler) continue
      if (interactive) handler.enable()
      else handler.disable()
    }

    if (!interactive) {
      // Release focus so arrow keys can't pan the frozen map from behind an overlay.
      const container = map.getContainer()
      if (document.activeElement === container) container.blur()
    }
  }, [interactive])

  return (
    <div
      ref={containerRef}
      data-commercial-map-mode={mode}
      data-commercial-map-frozen={interactive ? undefined : "true"}
      className={cn(
        "h-full min-h-[320px] w-full rounded-lg border",
        !interactive && "[&_.leaflet-control]:pointer-events-none",
        className
      )}
    />
  )
}
