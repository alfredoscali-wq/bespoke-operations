"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import type { PlanningMapMarker } from "@/components/planificacion/planning-map"
import {
  buildPlanningMarkersViewKey,
  resolvePlanningPinVisualState,
  type PlanningPinVisualState,
} from "@/lib/planificacion/planning-map-markers"
import type { Crew } from "@/lib/types/crews"
import {
  formatDispatchOrderBadge,
  resolveTaskRouteOrder,
} from "@/lib/tasks/dispatch-order"
import {
  PLANNING_MAP_DEFAULT_CENTER,
  PLANNING_MAP_DEFAULT_ZOOM,
  PLANNING_MAP_FIT_BOUNDS_PADDING,
  PLANNING_MAP_SINGLE_MARKER_ZOOM,
  resolvePlanningMapViewConfig,
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskServiceLabel,
  type PlanningMapViewConfig,
} from "@/lib/planificacion/planning-utils"

import "leaflet/dist/leaflet.css"

const PLANNING_MAP_FLY_DURATION_SECONDS = 0.35

function buildPlanningMarkerInstanceKey(
  taskId: string,
  coordinates: PlanningMapMarker["coordinates"]
): string {
  return `${taskId}:${coordinates.latitude}:${coordinates.longitude}`
}

function removePlanningMarker(
  markerLayer: L.LayerGroup,
  marker: L.Marker
): void {
  markerLayer.removeLayer(marker)
  marker.off()
  marker.remove()
}

function createPlanningMarker(
  markerEntry: PlanningMapMarker,
  visualState: PlanningPinVisualState,
  onSelectTask: (taskId: string) => void,
  isEditMode: boolean
): L.Marker {
  const { task, coordinates } = markerEntry
  const latLng: L.LatLngExpression = [
    coordinates.latitude,
    coordinates.longitude,
  ]

  const marker = L.marker(latLng, {
    icon: createPlanningPinIcon(
      visualState.color,
      visualState.highlighted,
      resolveTaskRouteOrder(task),
      visualState.opacity
    ),
    zIndexOffset: visualState.zIndexOffset,
  })

  if (!isEditMode) {
    marker.bindPopup(buildMarkerPopup(task))
  }

  marker.on("click", () => {
    onSelectTask(task.id)
    if (isEditMode) {
      marker.closePopup()
    }
  })

  return marker
}

function createPlanningPinIcon(
  color: string,
  highlighted: boolean,
  routeOrder: number | null | undefined,
  opacity = 1
): L.DivIcon {
  const scale = highlighted ? 1.12 : 1
  const width = Math.round(26 * scale)
  const height = Math.round(36 * scale)
  const anchorX = Math.round(width / 2)
  const orderLabel =
    routeOrder != null && routeOrder > 0
      ? formatDispatchOrderBadge(routeOrder) ?? String(Math.floor(routeOrder))
      : null
  const orderBadge = orderLabel
    ? `<circle cx="13" cy="10.5" r="7.25" fill="#ffffff" fill-opacity="0.94"/><text x="13" y="13.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${orderLabel.length > 1 ? 7 : 8}" font-weight="700" fill="#0f172a">${orderLabel}</text>`
    : ""

  return L.divIcon({
    className: "planning-map-pin-icon !border-0 !bg-transparent",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 26 36" aria-hidden="true" style="display:block;opacity:${opacity};filter:drop-shadow(0 2px 4px rgba(15,23,42,.28))">
      <path d="M13 0C6.925 0 2 4.925 2 11c0 8.25 11 25 11 25s11-16.75 11-25C24 4.925 19.075 0 13 0z" fill="${color}" stroke="#ffffff" stroke-width="1.75"/>
      ${orderBadge}
    </svg>`,
    iconSize: [width, height],
    iconAnchor: [anchorX, height],
    popupAnchor: [0, -height + 6],
  })
}

function resolveMarkerVisualState(
  markerEntry: PlanningMapMarker,
  highlightedTaskId: string | null,
  crewColorIndex: Map<string, number>,
  activeCrewFilterId: string | null,
  crews: Pick<Crew, "id" | "name">[]
): PlanningPinVisualState {
  return resolvePlanningPinVisualState(markerEntry.task, {
    highlightedTaskId,
    crewColorIndex,
    activeCrewFilterId,
    crews,
  })
}

function applyMarkerVisualState(
  marker: L.Marker,
  markerEntry: PlanningMapMarker,
  visualState: PlanningPinVisualState
): void {
  marker.setIcon(
    createPlanningPinIcon(
      visualState.color,
      visualState.highlighted,
      resolveTaskRouteOrder(markerEntry.task),
      visualState.opacity
    )
  )
  marker.setZIndexOffset(visualState.zIndexOffset)
}

function buildMarkerPopup(task: PlanningMapMarker["task"]): string {
  return `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.4">
      <strong>${resolvePlanningTaskClientLabel(task)}</strong><br/>
      ${resolvePlanningTaskServiceLabel(task)}<br/>
      <span style="color:#64748b">${task.estimatedDuration || "—"} · ${resolvePlanningTaskCrewLabel(task)}</span>
    </div>
  `
}

function applyPlanningMapView(
  map: L.Map,
  viewConfig: PlanningMapViewConfig,
  animate: boolean
): void {
  if (viewConfig.type === "bounds") {
    map.fitBounds(viewConfig.bounds, {
      padding: PLANNING_MAP_FIT_BOUNDS_PADDING,
    })
    return
  }

  if (viewConfig.type === "point") {
    const latLng: L.LatLngExpression = [
      viewConfig.latitude,
      viewConfig.longitude,
    ]

    if (animate) {
      map.flyTo(latLng, viewConfig.zoom, {
        duration: PLANNING_MAP_FLY_DURATION_SECONDS,
      })
      return
    }

    map.setView(latLng, viewConfig.zoom)
    return
  }

  map.setView(
    [PLANNING_MAP_DEFAULT_CENTER.latitude, PLANNING_MAP_DEFAULT_CENTER.longitude],
    PLANNING_MAP_DEFAULT_ZOOM
  )
}

function refreshPlanningMapView(
  map: L.Map,
  markers: PlanningMapMarker[],
  animate: boolean
): void {
  map.invalidateSize()

  if (markers.length === 0) {
    applyPlanningMapView(map, { type: "default" }, false)
    return
  }

  applyPlanningMapView(
    map,
    resolvePlanningMapViewConfig(
      markers.map((marker) => marker.coordinates)
    ),
    animate
  )
}

type PlanningMapCanvasProps = {
  markers: PlanningMapMarker[]
  selectedTaskId: string | null
  highlightedTaskId: string | null
  crewColorIndex: Map<string, number>
  onSelectTask: (taskId: string) => void
  isEditMode?: boolean
  viewRefreshToken?: number
  activeCrewFilterId?: string | null
  crews?: Pick<Crew, "id" | "name">[]
}

export function PlanningMapCanvas({
  markers,
  selectedTaskId,
  highlightedTaskId,
  crewColorIndex,
  onSelectTask,
  isEditMode = false,
  viewRefreshToken = 0,
  activeCrewFilterId = null,
  crews = [],
}: PlanningMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const markerRefsRef = useRef<
    Map<string, { instanceKey: string; marker: L.Marker }>
  >(new Map())
  const markersRef = useRef(markers)
  const onSelectTaskRef = useRef(onSelectTask)
  const isEditModeRef = useRef(isEditMode)
  const lastViewKeyRef = useRef<string>("")
  const lastSelectedTaskIdRef = useRef<string | null>(null)

  markersRef.current = markers
  onSelectTaskRef.current = onSelectTask
  isEditModeRef.current = isEditMode

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialMarkers = markersRef.current

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    lastViewKeyRef.current = buildPlanningMarkersViewKey(initialMarkers)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mapRef.current) {
          return
        }

        refreshPlanningMapView(mapRef.current, markersRef.current, false)
        lastViewKeyRef.current = buildPlanningMarkersViewKey(markersRef.current)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      markerRefsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    if (!map || !markerLayer) {
      return
    }

    const markerRefs = markerRefsRef.current
    const viewKey = buildPlanningMarkersViewKey(markers)
    const nextMarkerIds = new Set(markers.map((marker) => marker.task.id))

    for (const [taskId, markerEntry] of markerRefs.entries()) {
      if (!nextMarkerIds.has(taskId)) {
        removePlanningMarker(markerLayer, markerEntry.marker)
        markerRefs.delete(taskId)
      }
    }

    for (const markerEntry of markers) {
      const { task, coordinates } = markerEntry
      const instanceKey = buildPlanningMarkerInstanceKey(task.id, coordinates)
      const existing = markerRefs.get(task.id)

      if (existing && existing.instanceKey !== instanceKey) {
        removePlanningMarker(markerLayer, existing.marker)
        markerRefs.delete(task.id)
      }

      const current = markerRefs.get(task.id)
      const visualState = resolveMarkerVisualState(
        markerEntry,
        highlightedTaskId,
        crewColorIndex,
        activeCrewFilterId,
        crews
      )

      if (current) {
        applyMarkerVisualState(current.marker, markerEntry, visualState)
        if (!isEditModeRef.current) {
          current.marker.setPopupContent(buildMarkerPopup(task))
        }
        continue
      }

      const marker = createPlanningMarker(
        markerEntry,
        visualState,
        (taskId) => onSelectTaskRef.current(taskId),
        isEditModeRef.current
      )

      marker.addTo(markerLayer)
      markerRefs.set(task.id, { instanceKey, marker })
    }

    if (viewKey !== lastViewKeyRef.current) {
      lastViewKeyRef.current = viewKey
      const shouldAnimate =
        markers.length === 1 &&
        resolvePlanningMapViewConfig(
          markers.map((marker) => marker.coordinates)
        ).type === "point"

      requestAnimationFrame(() => {
        if (!mapRef.current) {
          return
        }

        refreshPlanningMapView(mapRef.current, markers, shouldAnimate)
      })
    }
  }, [markers, highlightedTaskId, crewColorIndex, activeCrewFilterId, crews])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (
      selectedTaskId &&
      selectedTaskId !== lastSelectedTaskIdRef.current
    ) {
      const selectedMarker = markers.find(
        (marker) => marker.task.id === selectedTaskId
      )

      if (selectedMarker) {
        map.flyTo(
          [
            selectedMarker.coordinates.latitude,
            selectedMarker.coordinates.longitude,
          ],
          Math.max(map.getZoom(), PLANNING_MAP_SINGLE_MARKER_ZOOM - 1),
          { duration: PLANNING_MAP_FLY_DURATION_SECONDS }
        )
      }
    }

    lastSelectedTaskIdRef.current = selectedTaskId
  }, [selectedTaskId, markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (isEditMode) {
      map.closePopup()
      for (const markerEntry of markerRefsRef.current.values()) {
        markerEntry.marker.closePopup()
        markerEntry.marker.unbindPopup()
      }
      return
    }

    for (const markerEntry of markers) {
      const markerRef = markerRefsRef.current.get(markerEntry.task.id)
      if (!markerRef) {
        continue
      }

      markerRef.marker.bindPopup(buildMarkerPopup(markerEntry.task))
    }
  }, [isEditMode, markers])

  useEffect(() => {
    if (viewRefreshToken === 0) {
      return
    }

    const map = mapRef.current
    if (!map) {
      return
    }

    lastViewKeyRef.current = ""

    requestAnimationFrame(() => {
      if (!mapRef.current) {
        return
      }

      refreshPlanningMapView(mapRef.current, markersRef.current, false)
      lastViewKeyRef.current = buildPlanningMarkersViewKey(markersRef.current)
    })
  }, [viewRefreshToken])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) {
      return
    }

    let lastWidth = 0
    let lastHeight = 0

    const observer = new ResizeObserver(() => {
      if (!mapRef.current) {
        return
      }

      const { width, height } = container.getBoundingClientRect()
      const hadNoSize = lastWidth === 0 || lastHeight === 0
      lastWidth = width
      lastHeight = height

      mapRef.current.invalidateSize()

      if (
        hadNoSize &&
        width > 0 &&
        height > 0 &&
        markersRef.current.length > 0
      ) {
        refreshPlanningMapView(mapRef.current, markersRef.current, false)
      }
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0 z-0" />
}
