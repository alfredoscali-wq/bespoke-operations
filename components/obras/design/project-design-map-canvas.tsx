"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"

import { PlanningMapBaseLayerControl } from "@/components/planificacion/planning-map-base-layer-control"
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  SELECTED_LOCATION_MAP_ZOOM,
} from "@/lib/gps/constants"
import { hasCoordinates } from "@/lib/gps/coordinates"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
  resolveSegmentColor,
} from "@/lib/projects/design/colors"
import { defaultIconForKind } from "@/lib/projects/design/icons"
import {
  isDesignDrawTool,
  isDesignGainTool,
  isDesignPlacementTool,
} from "@/lib/projects/design/drawing"
import { findSnapTarget } from "@/lib/projects/design/snap"
import {
  createProjectDesignElementDivIcon,
  createProjectDesignGainDivIcon,
} from "@/components/obras/design/project-design-map-icons"
import {
  DEFAULT_TRACE_GAIN_M,
  resolveGainPlacement,
} from "@/lib/projects/design/gains"
import {
  PLANNING_MAP_DEFAULT_BASE_LAYER,
  readPlanningMapBaseLayerFromSession,
  resolvePlanningMapBaseLayerConfig,
  writePlanningMapBaseLayerToSession,
  type PlanningMapSelectableBaseLayerId,
} from "@/lib/planificacion/planning-map-tiles"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSelection,
  ProjectDesignTool,
} from "@/lib/types/project-design"

import "leaflet/dist/leaflet.css"

const DRAW_COLOR = "#0284c7"

type ProjectDesignMapCanvasProps = {
  elements: ProjectDesignElement[]
  segments: ProjectDesignSegment[]
  gains: ProjectDesignGain[]
  selected: ProjectDesignSelection
  tool: ProjectDesignTool
  drawingPoints: Array<{ latitude: number; longitude: number }>
  projectLatitude?: number | null
  projectLongitude?: number | null
  onMapClick: (latitude: number, longitude: number) => void
  onMapDoubleClick: () => void
  onConnectElement: (elementId: string) => void
  onSelectElement: (id: string) => void
  onSelectSegment: (id: string) => void
  onSelectGain: (id: string) => void
  onElementDragEnd: (id: string, latitude: number, longitude: number) => void
  onVertexDragEnd: (
    segmentId: string,
    vertexIndex: number,
    latitude: number,
    longitude: number
  ) => void
}

function createGhostIcon(kind: "node" | "nap"): L.DivIcon {
  return createProjectDesignElementDivIcon(
    {
      name: kind === "nap" ? "NAP" : "Nodo",
      kind,
      color: kind === "nap" ? DEFAULT_NAP_COLOR : DEFAULT_NODE_COLOR,
      icon: defaultIconForKind(kind),
    },
    { selected: false, snapTarget: true }
  )
}

export function ProjectDesignMapCanvas({
  elements,
  segments,
  gains,
  selected,
  tool,
  drawingPoints,
  projectLatitude,
  projectLongitude,
  onMapClick,
  onMapDoubleClick,
  onConnectElement,
  onSelectElement,
  onSelectSegment,
  onSelectGain,
  onElementDragEnd,
  onVertexDragEnd,
}: ProjectDesignMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const overlayRef = useRef<L.FeatureGroup | null>(null)
  const drawLayerRef = useRef<L.LayerGroup | null>(null)
  const previewLayerRef = useRef<L.LayerGroup | null>(null)
  const ghostMarkerRef = useRef<L.Marker | null>(null)
  const rubberRef = useRef<L.Polyline | null>(null)
  const haloRef = useRef<L.CircleMarker | null>(null)
  const cursorMarkerRef = useRef<L.CircleMarker | null>(null)
  const didFitRef = useRef(false)
  const [baseLayer, setBaseLayer] = useState<PlanningMapSelectableBaseLayerId>(
    PLANNING_MAP_DEFAULT_BASE_LAYER
  )
  const [snapElementId, setSnapElementId] = useState<string | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const onMapDoubleClickRef = useRef(onMapDoubleClick)
  const onConnectElementRef = useRef(onConnectElement)
  const onSelectElementRef = useRef(onSelectElement)
  const onSelectSegmentRef = useRef(onSelectSegment)
  const onSelectGainRef = useRef(onSelectGain)
  const onElementDragEndRef = useRef(onElementDragEnd)
  const onVertexDragEndRef = useRef(onVertexDragEnd)
  const toolRef = useRef(tool)
  const drawingPointsRef = useRef(drawingPoints)
  const elementsRef = useRef(elements)
  const segmentsRef = useRef(segments)

  useEffect(() => {
    onMapClickRef.current = onMapClick
    onMapDoubleClickRef.current = onMapDoubleClick
    onConnectElementRef.current = onConnectElement
    onSelectElementRef.current = onSelectElement
    onSelectSegmentRef.current = onSelectSegment
    onSelectGainRef.current = onSelectGain
    onElementDragEndRef.current = onElementDragEnd
    onVertexDragEndRef.current = onVertexDragEnd
    toolRef.current = tool
    drawingPointsRef.current = drawingPoints
    elementsRef.current = elements
    segmentsRef.current = segments
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) {
      return
    }

    const initialLayer = readPlanningMapBaseLayerFromSession()
    setBaseLayer(initialLayer)
    const layer = resolvePlanningMapBaseLayerConfig(initialLayer)
    const hasProjectGps = hasCoordinates(projectLatitude, projectLongitude)
    const center: L.LatLngExpression = hasProjectGps
      ? [projectLatitude as number, projectLongitude as number]
      : [DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude]
    const zoom = hasProjectGps ? SELECTED_LOCATION_MAP_ZOOM : DEFAULT_MAP_ZOOM

    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      doubleClickZoom: false,
    }).setView(center, zoom)

    const tileLayer = L.tileLayer(layer.url, layer.options).addTo(map)
    const overlay = L.featureGroup().addTo(map)
    const drawLayer = L.layerGroup().addTo(map)
    const previewLayer = L.layerGroup().addTo(map)

    map.on("click", (event: L.LeafletMouseEvent) => {
      onMapClickRef.current(event.latlng.lat, event.latlng.lng)
    })
    map.on("dblclick", () => {
      onMapDoubleClickRef.current()
    })
    map.on("mousemove", (event: L.LeafletMouseEvent) => {
      updatePreview(event.latlng)
    })

    mapRef.current = map
    tileLayerRef.current = tileLayer
    overlayRef.current = overlay
    drawLayerRef.current = drawLayer
    previewLayerRef.current = previewLayer

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      overlayRef.current = null
      drawLayerRef.current = null
      previewLayerRef.current = null
      ghostMarkerRef.current = null
      rubberRef.current = null
      haloRef.current = null
      cursorMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, [])

  function updatePreview(latlng: L.LatLng) {
    const map = mapRef.current
    const preview = previewLayerRef.current
    if (!map || !preview) {
      return
    }

    const currentTool = toolRef.current
    const placing = isDesignPlacementTool(currentTool)
    const drawing = isDesignDrawTool(currentTool)
    const placingGain = isDesignGainTool(currentTool)

    if (placingGain) {
      const snap = resolveGainPlacement({
        click: { latitude: latlng.lat, longitude: latlng.lng },
        segments: segmentsRef.current,
      })
      if (snap) {
        const snapped = L.latLng(snap.latitude, snap.longitude)
        const segment = segmentsRef.current.find((item) => item.id === snap.segmentId)
        const color = resolveSegmentColor(segment?.color)
        if (!ghostMarkerRef.current) {
          ghostMarkerRef.current = L.marker(snapped, {
            icon: createProjectDesignGainDivIcon({
              gainM: DEFAULT_TRACE_GAIN_M,
              color,
              selected: true,
            }),
            interactive: false,
            zIndexOffset: 900,
            opacity: 0.92,
          })
          preview.addLayer(ghostMarkerRef.current)
        } else {
          ghostMarkerRef.current.setLatLng(snapped)
          ghostMarkerRef.current.setIcon(
            createProjectDesignGainDivIcon({
              gainM: DEFAULT_TRACE_GAIN_M,
              color,
              selected: true,
            })
          )
        }
      } else if (ghostMarkerRef.current) {
        preview.removeLayer(ghostMarkerRef.current)
        ghostMarkerRef.current = null
      }
      if (rubberRef.current) {
        preview.removeLayer(rubberRef.current)
        rubberRef.current = null
      }
      if (haloRef.current) {
        preview.removeLayer(haloRef.current)
        haloRef.current = null
      }
      if (cursorMarkerRef.current) {
        preview.removeLayer(cursorMarkerRef.current)
        cursorMarkerRef.current = null
      }
      setSnapElementId((current) => (current ? null : current))
      return
    }

    if (placing) {
      const kind = currentTool === "add-nap" ? "nap" : "node"
      if (!ghostMarkerRef.current) {
        ghostMarkerRef.current = L.marker(latlng, {
          icon: createGhostIcon(kind),
          interactive: false,
          zIndexOffset: 900,
          opacity: 0.92,
        })
        preview.addLayer(ghostMarkerRef.current)
      } else {
        ghostMarkerRef.current.setLatLng(latlng)
        ghostMarkerRef.current.setIcon(createGhostIcon(kind))
      }
    } else if (ghostMarkerRef.current) {
      preview.removeLayer(ghostMarkerRef.current)
      ghostMarkerRef.current = null
    }

    if (!drawing) {
      if (rubberRef.current) {
        preview.removeLayer(rubberRef.current)
        rubberRef.current = null
      }
      if (haloRef.current) {
        preview.removeLayer(haloRef.current)
        haloRef.current = null
      }
      if (cursorMarkerRef.current) {
        preview.removeLayer(cursorMarkerRef.current)
        cursorMarkerRef.current = null
      }
      setSnapElementId((current) => (current ? null : current))
      return
    }

    const snap = findSnapTarget(
      { latitude: latlng.lat, longitude: latlng.lng },
      elementsRef.current
    )
    const cursor = snap
      ? L.latLng(snap.latitude, snap.longitude)
      : latlng
    setSnapElementId((current) => {
      const next = snap?.id ?? null
      return current === next ? current : next
    })

    if (snap) {
      if (!haloRef.current) {
        haloRef.current = L.circleMarker(cursor, {
          radius: 14,
          color: DRAW_COLOR,
          weight: 2,
          fillColor: DRAW_COLOR,
          fillOpacity: 0.12,
          interactive: false,
        })
        preview.addLayer(haloRef.current)
      } else {
        haloRef.current.setLatLng(cursor)
      }
    } else if (haloRef.current) {
      preview.removeLayer(haloRef.current)
      haloRef.current = null
    }

    if (!cursorMarkerRef.current) {
      cursorMarkerRef.current = L.circleMarker(cursor, {
        radius: 4,
        color: "#fff",
        weight: 2,
        fillColor: DRAW_COLOR,
        fillOpacity: 1,
        interactive: false,
      })
      preview.addLayer(cursorMarkerRef.current)
    } else {
      cursorMarkerRef.current.setLatLng(cursor)
    }

    const points = drawingPointsRef.current
    const last = points[points.length - 1]
    if (last) {
      const latLngs: L.LatLngExpression[] = [
        [last.latitude, last.longitude],
        [cursor.lat, cursor.lng],
      ]
      if (!rubberRef.current) {
        rubberRef.current = L.polyline(latLngs, {
          color: DRAW_COLOR,
          weight: 3,
          dashArray: "5 6",
          opacity: 0.85,
          interactive: false,
        })
        preview.addLayer(rubberRef.current)
      } else {
        rubberRef.current.setLatLngs(latLngs)
      }
    } else if (rubberRef.current) {
      preview.removeLayer(rubberRef.current)
      rubberRef.current = null
    }
  }

  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()
    const canDragElements = tool === "select"
    const drawing = isDesignDrawTool(tool)

    for (const segment of segments) {
      const latLngs = segment.geometry.map(
        (point) => [point.latitude, point.longitude] as L.LatLngExpression
      )
      const isSelected =
        selected?.type === "segment" && selected.id === segment.id
      const color = resolveSegmentColor(segment.color)
      const selectTrace = (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        if (isDesignDrawTool(toolRef.current) || isDesignGainTool(toolRef.current)) {
          onMapClickRef.current(event.latlng.lat, event.latlng.lng)
          return
        }
        onSelectSegmentRef.current(segment.id)
      }
      const hitArea = L.polyline(latLngs, {
        color,
        weight: 16,
        opacity: 0,
        interactive: true,
      })
      hitArea.on("click", selectTrace)
      overlay.addLayer(hitArea)
      const polyline = L.polyline(latLngs, {
        color,
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 0.95 : 0.82,
        interactive: true,
      })
      polyline.on("click", selectTrace)
      overlay.addLayer(polyline)

      if (isSelected && canDragElements) {
        segment.geometry.forEach((point, index) => {
          const vertex = L.marker([point.latitude, point.longitude], {
            draggable: true,
            zIndexOffset: 700,
            icon: L.divIcon({
              className: "project-design-vertex !border-0 !bg-transparent",
              html: `<span style="display:block;height:10px;width:10px;border-radius:999px;border:2px solid #fff;background:${color};box-shadow:0 1px 3px rgba(15,23,42,.35)"></span>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            }),
          })
          vertex.on("click", (event: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event)
          })
          vertex.on("dragend", () => {
            const pos = vertex.getLatLng()
            onVertexDragEndRef.current(segment.id, index, pos.lat, pos.lng)
          })
          overlay.addLayer(vertex)
        })
      }
    }

    for (const element of elements) {
      const isSelected =
        selected?.type === "element" && selected.id === element.id
      const isSnap = snapElementId === element.id
      const marker = L.marker([element.latitude, element.longitude], {
        icon: createProjectDesignElementDivIcon(element, {
          selected: isSelected,
          snapTarget: isSnap,
        }),
        draggable: canDragElements,
        zIndexOffset: isSelected || isSnap || drawing ? 650 : 400,
      })
      marker.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event)
        if (isDesignDrawTool(toolRef.current)) {
          onConnectElementRef.current(element.id)
          return
        }
        if (isDesignPlacementTool(toolRef.current)) {
          onMapClickRef.current(element.latitude, element.longitude)
          return
        }
        onSelectElementRef.current(element.id)
      })
      marker.on("dragend", () => {
        const pos = marker.getLatLng()
        onElementDragEndRef.current(element.id, pos.lat, pos.lng)
      })
      overlay.addLayer(marker)
    }

    for (const gain of gains) {
      const isSelected = selected?.type === "gain" && selected.id === gain.id
      const segment = segments.find((item) => item.id === gain.segmentId)
      const color = resolveSegmentColor(segment?.color)
      const marker = L.marker([gain.latitude, gain.longitude], {
        icon: createProjectDesignGainDivIcon({
          gainM: gain.gainM,
          color,
          selected: isSelected,
        }),
        draggable: false,
        zIndexOffset: isSelected ? 800 : 560,
      })
      marker.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event)
        if (isDesignDrawTool(toolRef.current) || isDesignPlacementTool(toolRef.current)) {
          return
        }
        onSelectGainRef.current(gain.id)
      })
      overlay.addLayer(marker)
    }

    if (
      !didFitRef.current &&
      (elements.length > 0 || segments.length > 0 || gains.length > 0)
    ) {
      const bounds = overlay.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18))
        didFitRef.current = true
      }
    }
  }, [elements, segments, gains, selected, tool, snapElementId])

  useEffect(() => {
    const drawLayer = drawLayerRef.current
    if (!drawLayer) {
      return
    }
    drawLayer.clearLayers()
    if (drawingPoints.length === 0) {
      return
    }
    const latLngs = drawingPoints.map(
      (point) => [point.latitude, point.longitude] as L.LatLngExpression
    )
    if (latLngs.length >= 2) {
      drawLayer.addLayer(
        L.polyline(latLngs, {
          color: DRAW_COLOR,
          weight: 3,
          dashArray: "6 6",
          opacity: 0.9,
          interactive: false,
        })
      )
    }
    for (const point of drawingPoints) {
      drawLayer.addLayer(
        L.circleMarker([point.latitude, point.longitude], {
          radius: 4,
          color: "#fff",
          weight: 2,
          fillColor: DRAW_COLOR,
          fillOpacity: 1,
          interactive: false,
        })
      )
    }
  }, [drawingPoints])

  useEffect(() => {
    const preview = previewLayerRef.current
    if (!preview) {
      return
    }
    if (
      !isDesignPlacementTool(tool) &&
      !isDesignGainTool(tool) &&
      ghostMarkerRef.current
    ) {
      preview.removeLayer(ghostMarkerRef.current)
      ghostMarkerRef.current = null
    }
    if (!isDesignDrawTool(tool)) {
      if (rubberRef.current) {
        preview.removeLayer(rubberRef.current)
        rubberRef.current = null
      }
      if (haloRef.current) {
        preview.removeLayer(haloRef.current)
        haloRef.current = null
      }
      if (cursorMarkerRef.current) {
        preview.removeLayer(cursorMarkerRef.current)
        cursorMarkerRef.current = null
      }
    }

    if (isDesignPlacementTool(tool) && mapRef.current) {
      updatePreview(mapRef.current.getCenter())
    }
    if (isDesignGainTool(tool) && mapRef.current) {
      updatePreview(mapRef.current.getCenter())
    }
  }, [tool])

  if (!isDesignDrawTool(tool) && snapElementId !== null) {
    setSnapElementId(null)
  }

  function handleBaseLayerChange(layerId: PlanningMapSelectableBaseLayerId) {
    const map = mapRef.current
    if (!map) {
      return
    }
    setBaseLayer(layerId)
    writePlanningMapBaseLayerToSession(layerId)
    const config = resolvePlanningMapBaseLayerConfig(layerId)
    tileLayerRef.current?.remove()
    tileLayerRef.current = L.tileLayer(config.url, config.options).addTo(map)
    tileLayerRef.current.bringToBack()
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border bg-muted/20">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <PlanningMapBaseLayerControl
        value={baseLayer}
        onChange={handleBaseLayerChange}
      />
    </div>
  )
}
