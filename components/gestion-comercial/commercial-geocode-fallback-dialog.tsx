"use client"

import { useEffect, useRef, useState } from "react"
import type {
  LatLngExpression,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolveCommercialLocationPaste } from "@/lib/commercial/resolve-person-location"
import { hasCoordinates } from "@/lib/gps"
import {
  PLANNING_MAP_DEFAULT_CENTER,
  PLANNING_MAP_DEFAULT_ZOOM,
  PLANNING_MAP_SINGLE_MARKER_ZOOM,
} from "@/lib/planificacion/planning-utils"
import { resolvePlanningMapBaseLayerConfig } from "@/lib/planificacion/planning-map-tiles"

import "leaflet/dist/leaflet.css"

type Coords = { latitude: number; longitude: number }

type CommercialGeocodeFallbackDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved: (coords: Coords) => void
  onSkip?: () => void
  /** When opening as last-resort map picker. */
  initialMode?: "choice" | "map" | "paste"
}

type Mode = "choice" | "map" | "paste"

export function CommercialGeocodeFallbackDialog({
  open,
  onOpenChange,
  onResolved,
  onSkip,
  initialMode = "choice",
}: CommercialGeocodeFallbackDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [pasteValue, setPasteValue] = useState("")
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [mapCoords, setMapCoords] = useState<Coords | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(false)

  const mapNodeRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setMode(initialMode)
      setPasteValue("")
      setPasteError(null)
      setIsResolving(false)
      setMapCoords(null)
      setIsMapLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialMode, open])

  useEffect(() => {
    if (!open || mode !== "map") {
      return
    }
    if (typeof window === "undefined") {
      return
    }

    let cancelled = false

    void (async () => {
      setIsMapLoading(true)
      try {
        const leaflet = await import("leaflet")
        const L = leaflet.default

        if (cancelled || !mapNodeRef.current || mapRef.current) {
          return
        }

        const layer = resolvePlanningMapBaseLayerConfig("street")
        const map = L.map(mapNodeRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView(
          [
            PLANNING_MAP_DEFAULT_CENTER.latitude,
            PLANNING_MAP_DEFAULT_CENTER.longitude,
          ],
          PLANNING_MAP_DEFAULT_ZOOM
        )

        L.tileLayer(layer.url, layer.options).addTo(map)

        const marker = L.marker(
          [
            PLANNING_MAP_DEFAULT_CENTER.latitude,
            PLANNING_MAP_DEFAULT_CENTER.longitude,
          ],
          { opacity: 0 }
        ).addTo(map)

        map.on("click", (event: LeafletMouseEvent) => {
          const latitude = Number(event.latlng.lat.toFixed(6))
          const longitude = Number(event.latlng.lng.toFixed(6))
          marker.setLatLng(event.latlng)
          marker.setOpacity(1)
          setMapCoords({ latitude, longitude })
          onResolved({ latitude, longitude })
          onOpenChange(false)
        })

        mapRef.current = map
        markerRef.current = marker

        requestAnimationFrame(() => {
          map.invalidateSize()
        })
      } finally {
        if (!cancelled) {
          setIsMapLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [mode, onOpenChange, onResolved, open])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || !mapCoords) return
    if (!hasCoordinates(mapCoords.latitude, mapCoords.longitude)) return
    const latLng: LatLngExpression = [mapCoords.latitude, mapCoords.longitude]
    marker.setLatLng(latLng)
    marker.setOpacity(1)
    map.setView(latLng, PLANNING_MAP_SINGLE_MARKER_ZOOM)
  }, [mapCoords])

  async function handlePasteConfirm() {
    setIsResolving(true)
    setPasteError(null)
    try {
      const resolved = await resolveCommercialLocationPaste(pasteValue)
      if (!resolved) {
        setPasteError("No se pudo interpretar la ubicación.")
        return
      }
      onResolved({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      })
      onOpenChange(false)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={mode === "map" ? "sm:max-w-lg" : "sm:max-w-sm"}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "choice"
              ? "No encontramos resultados para esta dirección."
              : mode === "map"
                ? "Seleccionar en mapa"
                : "Pegar enlace o coordenadas GPS"}
          </DialogTitle>
          <DialogDescription>
            {mode === "choice"
              ? "Puede pegar una ubicación o continuar sin geolocalizar."
              : mode === "map"
                ? "Última alternativa: haga clic sobre el mapa."
                : "Acepte coordenadas, Google Maps o links compartidos."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choice" ? (
          <DialogFooter className="sm:justify-stretch">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setMode("paste")}
            >
              Pegar enlace o coordenadas GPS
            </Button>
            {onSkip ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  onSkip()
                  onOpenChange(false)
                }}
              >
                Continuar sin ubicación
              </Button>
            ) : null}
            <Button
              type="button"
              variant="link"
              className="w-full text-muted-foreground sm:w-auto"
              onClick={() => setMode("map")}
            >
              Seleccionar en mapa (última alternativa)
            </Button>
          </DialogFooter>
        ) : null}

        {mode === "map" ? (
          <div className="space-y-3">
            <div
              ref={mapNodeRef}
              className="relative h-[280px] w-full overflow-hidden rounded-md border"
            >
              {isMapLoading ? (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Cargando mapa…
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("choice")}
              >
                Volver
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {mode === "paste" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="commercial-geocode-paste">Ubicación</Label>
              <Input
                id="commercial-geocode-paste"
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                placeholder="Pegue un enlace de Google Maps o coordenadas GPS"
                disabled={isResolving}
              />
              {pasteError ? (
                <p className="text-sm text-destructive" role="alert">
                  {pasteError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("choice")}
                disabled={isResolving}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={() => void handlePasteConfirm()}
                disabled={isResolving || !pasteValue.trim()}
              >
                Guardar
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
