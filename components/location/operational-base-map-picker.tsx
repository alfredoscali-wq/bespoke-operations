"use client"

/**
 * OPS 2.3C — interactive base location picker.
 * Reuses Leaflet + planning map tiles (same stack as planning-map-canvas).
 * Location paste UX uses the canonical LocationInput.
 */

import { useEffect, useRef, useState } from "react"
import L from "leaflet"

import { LocationInput } from "@/components/location/location-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import { hasCoordinates } from "@/lib/gps"
import {
  PLANNING_MAP_DEFAULT_CENTER,
  PLANNING_MAP_DEFAULT_ZOOM,
  PLANNING_MAP_SINGLE_MARKER_ZOOM,
} from "@/lib/planificacion/planning-utils"
import { resolvePlanningMapBaseLayerConfig } from "@/lib/planificacion/planning-map-tiles"
import { cn } from "@/lib/utils"

import "leaflet/dist/leaflet.css"

export type OperationalBaseLocationValue = {
  address: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
}

type OperationalBaseMapPickerProps = {
  value: OperationalBaseLocationValue
  onChange: (next: OperationalBaseLocationValue) => void
  readOnly?: boolean
  idPrefix?: string
  className?: string
}

const DEFAULT_CENTER: L.LatLngExpression = [
  PLANNING_MAP_DEFAULT_CENTER.latitude,
  PLANNING_MAP_DEFAULT_CENTER.longitude,
]

export function OperationalBaseMapPicker({
  value,
  onChange,
  readOnly = false,
  idPrefix = "ops-base",
  className,
}: OperationalBaseMapPickerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
    valueRef.current = value
  }, [onChange, value])

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return
    }

    const layer = resolvePlanningMapBaseLayerConfig("street")
    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, PLANNING_MAP_DEFAULT_ZOOM)

    L.tileLayer(layer.url, layer.options).addTo(map)

    const marker = L.marker(DEFAULT_CENTER, {
      draggable: !readOnly,
      opacity: 0,
    }).addTo(map)

    marker.on("dragend", () => {
      if (readOnly) {
        return
      }
      const pos = marker.getLatLng()
      onChangeRef.current({
        ...valueRef.current,
        latitude: Number(pos.lat.toFixed(6)),
        longitude: Number(pos.lng.toFixed(6)),
      })
    })

    map.on("click", (event: L.LeafletMouseEvent) => {
      if (readOnly) {
        return
      }
      marker.setLatLng(event.latlng)
      marker.setOpacity(1)
      onChangeRef.current({
        ...valueRef.current,
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      })
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) {
      return
    }

    marker.dragging?.[readOnly ? "disable" : "enable"]()

    if (hasCoordinates(value.latitude, value.longitude)) {
      const latLng: L.LatLngExpression = [
        value.latitude as number,
        value.longitude as number,
      ]
      marker.setLatLng(latLng)
      marker.setOpacity(1)
      map.setView(latLng, PLANNING_MAP_SINGLE_MARKER_ZOOM)
    } else {
      marker.setOpacity(0)
    }
  }, [value.latitude, value.longitude, readOnly])

  async function handleResolveLink() {
    const link = value.sharedLocation.trim()
    if (!link || readOnly) {
      return
    }
    setIsResolving(true)
    setResolveError(null)
    try {
      const resolved = await resolveLocationViaApi(link)
      onChange({
        ...value,
        sharedLocation: resolved.normalizedLocation || link,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      })
    } catch (error) {
      setResolveError(
        error instanceof Error
          ? error.message
          : "No se pudo resolver la ubicación."
      )
    } finally {
      setIsResolving(false)
    }
  }

  const coordsReady = hasCoordinates(value.latitude, value.longitude)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Dirección</Label>
        <Input
          id={`${idPrefix}-address`}
          value={value.address}
          disabled={readOnly}
          onChange={(event) =>
            onChange({ ...value, address: event.target.value })
          }
          placeholder="Calle, número, localidad"
        />
      </div>

      <LocationInput
        id={`${idPrefix}-maps-link`}
        value={value.sharedLocation}
        onChange={(sharedLocation) =>
          onChange({ ...value, sharedLocation })
        }
        readOnly={readOnly}
      />

      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!value.sharedLocation.trim() || isResolving}
          onClick={() => void handleResolveLink()}
        >
          {isResolving ? "Resolviendo…" : "Ubicar en el mapa"}
        </Button>
      ) : null}

      {resolveError ? (
        <p className="text-[12px] text-amber-700">{resolveError}</p>
      ) : null}

      <div
        ref={mapNodeRef}
        className="h-52 w-full overflow-hidden rounded-lg border border-slate-200"
        role="application"
        aria-label="Mapa de Base Operativa"
      />

      <p className="text-[11px] leading-snug text-slate-500">
        {readOnly
          ? coordsReady
            ? `GPS: ${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)}`
            : "Sin coordenadas GPS."
          : "Hacé clic en el mapa o arrastrá el marcador. También podés pegar un enlace de Google Maps."}
      </p>
    </div>
  )
}
