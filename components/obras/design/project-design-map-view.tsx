"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"

import { PlanningMapBaseLayerControl } from "@/components/planificacion/planning-map-base-layer-control"
import {
  createProjectDesignElementDivIcon,
  createProjectDesignGainDivIcon,
} from "@/components/obras/design/project-design-map-icons"
import { buildProjectDesignMapViewModel } from "@/lib/projects/design/map-view"
import {
  PLANNING_MAP_DEFAULT_BASE_LAYER,
  readPlanningMapBaseLayerFromSession,
  resolvePlanningMapBaseLayerConfig,
  writePlanningMapBaseLayerToSession,
  type PlanningMapSelectableBaseLayerId,
} from "@/lib/planificacion/planning-map-tiles"
import type {
  ProjectDesignMapHighlight,
  ProjectDesignSelection,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"
import { cn } from "@/lib/utils"

import "leaflet/dist/leaflet.css"

export type ProjectDesignMapViewProps = {
  snapshot: ProjectDesignSnapshot
  projectLatitude?: number | null
  projectLongitude?: number | null
  highlight?: ProjectDesignMapHighlight | null
  className?: string
  onInspect?: (selection: ProjectDesignSelection) => void
}

export function ProjectDesignMapView({
  snapshot,
  projectLatitude,
  projectLongitude,
  highlight = null,
  className,
  onInspect,
}: ProjectDesignMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const overlayRef = useRef<L.FeatureGroup | null>(null)
  const didFitRef = useRef(false)
  const onInspectRef = useRef(onInspect)
  const [baseLayer, setBaseLayer] = useState<PlanningMapSelectableBaseLayerId>(
    PLANNING_MAP_DEFAULT_BASE_LAYER
  )

  const model = useMemo(
    () =>
      buildProjectDesignMapViewModel({
        snapshot,
        projectLatitude,
        projectLongitude,
        highlight,
      }),
    [snapshot, projectLatitude, projectLongitude, highlight]
  )

  useEffect(() => {
    onInspectRef.current = onInspect
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) {
      return
    }

    const initialLayer = readPlanningMapBaseLayerFromSession()
    setBaseLayer(initialLayer)
    const layer = resolvePlanningMapBaseLayerConfig(initialLayer)
    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    }).setView(
      [model.frame.center.latitude, model.frame.center.longitude],
      model.frame.zoom
    )

    const tileLayer = L.tileLayer(layer.url, layer.options).addTo(map)
    const overlay = L.featureGroup().addTo(map)

    mapRef.current = map
    tileLayerRef.current = tileLayer
    overlayRef.current = overlay

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()

    for (const segment of model.segments) {
      const latLngs = segment.geometry.map(
        (point) => [point.latitude, point.longitude] as L.LatLngExpression
      )
      const polyline = L.polyline(latLngs, {
        color: segment.color,
        weight: segment.weight,
        opacity: segment.opacity,
        interactive: true,
      })
      polyline.bindTooltip(segment.tooltip, {
        sticky: true,
        direction: "top",
      })
      polyline.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        onInspectRef.current?.({ type: "segment", id: segment.id })
      })
      overlay.addLayer(polyline)
    }

    for (const element of model.elements) {
      const marker = L.marker([element.latitude, element.longitude], {
        icon: createProjectDesignElementDivIcon(element, {
          selected: element.highlighted,
        }),
        draggable: false,
        keyboard: false,
        zIndexOffset: element.highlighted ? 650 : 400,
      })
      marker.bindTooltip(element.tooltip, { direction: "top" })
      marker.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event)
        onInspectRef.current?.({ type: "element", id: element.id })
      })
      overlay.addLayer(marker)
    }

    for (const gain of model.gains) {
      const marker = L.marker([gain.latitude, gain.longitude], {
        icon: createProjectDesignGainDivIcon({
          gainM: gain.gainM,
          color: gain.color,
          selected: gain.highlighted,
          labeled: true,
        }),
        draggable: false,
        keyboard: false,
        zIndexOffset: gain.highlighted ? 800 : 560,
      })
      marker.bindTooltip(gain.tooltip, { direction: "top" })
      marker.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event)
        onInspectRef.current?.({ type: "gain", id: gain.id })
      })
      overlay.addLayer(marker)
    }

    if (!didFitRef.current && model.hasRenderableFeatures) {
      const bounds = overlay.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18))
        didFitRef.current = true
      }
    }
  }, [model])

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
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden rounded-xl border bg-muted/20",
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <PlanningMapBaseLayerControl
        value={baseLayer}
        onChange={handleBaseLayerChange}
      />
    </div>
  )
}
