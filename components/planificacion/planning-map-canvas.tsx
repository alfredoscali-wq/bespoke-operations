"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import type { PlanningMapMarker } from "@/components/planificacion/planning-map"
import {
  PLANNING_MAP_DEFAULT_CENTER,
  PLANNING_MAP_DEFAULT_ZOOM,
  resolvePlanningMapBounds,
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskServiceLabel,
} from "@/lib/planificacion/planning-utils"

import "leaflet/dist/leaflet.css"

function createMarkerIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: selected
      ? `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#ea580c;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`
      : `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: selected ? [18, 18] : [14, 14],
    iconAnchor: selected ? [9, 9] : [7, 7],
  })
}

type PlanningMapCanvasProps = {
  markers: PlanningMapMarker[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
}

export function PlanningMapCanvas({
  markers,
  selectedTaskId,
  onSelectTask,
}: PlanningMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectTaskRef = useRef(onSelectTask)

  onSelectTaskRef.current = onSelectTask

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(
      [
        PLANNING_MAP_DEFAULT_CENTER.latitude,
        PLANNING_MAP_DEFAULT_CENTER.longitude,
      ],
      PLANNING_MAP_DEFAULT_ZOOM
    )

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    if (!map || !markerLayer) {
      return
    }

    markerLayer.clearLayers()

    for (const { task, coordinates } of markers) {
      const isSelected = task.id === selectedTaskId
      const marker = L.marker([coordinates.latitude, coordinates.longitude], {
        icon: createMarkerIcon(isSelected),
      })

      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.4">
          <strong>${resolvePlanningTaskClientLabel(task)}</strong><br/>
          ${resolvePlanningTaskServiceLabel(task)}<br/>
          <span style="color:#64748b">${task.estimatedDuration || "—"} · ${resolvePlanningTaskCrewLabel(task)}</span>
        </div>
      `)

      marker.on("click", () => {
        onSelectTaskRef.current(task.id)
      })

      marker.addTo(markerLayer)
    }

    const bounds = resolvePlanningMapBounds(
      markers.map((marker) => marker.coordinates)
    )

    if (bounds) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
    } else {
      map.setView(
        [
          PLANNING_MAP_DEFAULT_CENTER.latitude,
          PLANNING_MAP_DEFAULT_CENTER.longitude,
        ],
        PLANNING_MAP_DEFAULT_ZOOM
      )
    }
  }, [markers, selectedTaskId])

  return <div ref={containerRef} className="h-full w-full" />
}
