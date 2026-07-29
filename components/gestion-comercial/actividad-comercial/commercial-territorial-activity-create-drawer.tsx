"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { CheckCircle2, LocateFixed, MapPin } from "lucide-react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { COMMERCIAL_ETIQUETA_FALLBACK_COLOR } from "@/lib/commercial/map-layers"
import { createCommercialTerritorialActivityBrowser } from "@/lib/supabase/commercial-territorial-activities.browser"
import type { CommercialTerritorialActivityType } from "@/lib/types/commercial-territorial-activity"
import { cn } from "@/lib/utils"

const MapCanvas = dynamic(
  () =>
    import("@/components/gestion-comercial/map/commercial-map-canvas").then(
      (mod) => mod.CommercialMapCanvas
    ),
  { ssr: false }
)

const FORM_ID = "commercial-territorial-activity-create-form"

type CommercialTerritorialActivityCreateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  actorEmployeeId: string | null
  types: CommercialTerritorialActivityType[]
  onCreated: () => void
}

export function CommercialTerritorialActivityCreateDrawer({
  open,
  onOpenChange,
  companyId,
  actorEmployeeId,
  types,
  onCreated,
}: CommercialTerritorialActivityCreateDrawerProps) {
  const [activityTypeId, setActivityTypeId] = useState("")
  const [description, setDescription] = useState("")
  const [observations, setObservations] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationSource, setLocationSource] = useState<string | null>(null)
  /** Only set from GPS so recentering never fights a manually placed pin. */
  const [gpsFocus, setGpsFocus] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setActivityTypeId("")
    setDescription("")
    setObservations("")
    setPhotos([])
    setLatitude(null)
    setLongitude(null)
    setLocationSource(null)
    setError(null)
    setGeoError(null)
    setMapExpanded(false)
    setGpsFocus(null)
    setIsLocating(false)
    setGpsAccuracy(null)
  }, [open])

  function requestCurrentLocation(options?: { forMapCenter?: boolean }) {
    if (!navigator.geolocation) {
      setGeoError("Geolocalización no disponible en este dispositivo.")
      return
    }
    setIsLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = Number(position.coords.latitude.toFixed(7))
        const nextLongitude = Number(position.coords.longitude.toFixed(7))
        setLatitude(nextLatitude)
        setLongitude(nextLongitude)
        setLocationSource("gps")
        setGpsFocus({ latitude: nextLatitude, longitude: nextLongitude })
        setGpsAccuracy(
          Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null
        )
        setGeoError(null)
        setIsLocating(false)
        if (options?.forMapCenter) {
          setMapExpanded(true)
        }
      },
      () => {
        setIsLocating(false)
        setGeoError(
          options?.forMapCenter
            ? "No se pudo obtener la ubicación. Marcá el punto en el mapa."
            : "No se pudo obtener la ubicación."
        )
        if (options?.forMapCenter) {
          setMapExpanded(true)
        }
      },
      { enableHighAccuracy: true, timeout: 12_000 }
    )
  }

  function handleUseMyLocation() {
    // GPS only — keep the map collapsed for the fast path.
    requestCurrentLocation()
  }

  function handleOpenManualMap() {
    if (latitude != null && longitude != null) {
      setGpsFocus({ latitude, longitude })
      setMapExpanded(true)
      return
    }
    // No coords yet: try GPS to center, then still show the map for picking.
    requestCurrentLocation({ forMapCenter: true })
  }

  const selectedTypeColor = useMemo(() => {
    const type = types.find((entry) => entry.id === activityTypeId)
    return type?.color?.trim() || COMMERCIAL_ETIQUETA_FALLBACK_COLOR
  }, [activityTypeId, types])

  const draftPin =
    latitude != null && longitude != null
      ? { latitude, longitude, color: selectedTypeColor }
      : null

  const locationStatus = useMemo(() => {
    if (latitude == null || longitude == null) {
      return {
        icon: MapPin,
        tone: "muted" as const,
        label: "Sin ubicación registrada",
        description: "Todavía no se seleccionó una ubicación.",
      }
    }
    if (locationSource === "manual") {
      return {
        icon: MapPin,
        tone: "manual" as const,
        label: "Ubicación ajustada manualmente",
        description: "El punto fue modificado manualmente.",
      }
    }
    return {
      icon: CheckCircle2,
      tone: "ok" as const,
      label: "GPS registrado correctamente",
      description: "La ubicación fue obtenida exitosamente.",
    }
  }, [latitude, locationSource, longitude])

  async function uploadPhotos(recordId: string) {
    for (const file of photos) {
      const formData = new FormData()
      formData.set("module", "commercial")
      formData.set("recordId", recordId)
      formData.set("file", file)
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(
          payload?.message ?? "No se pudo subir una de las fotos."
        )
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!companyId) {
      setError("Empresa no resuelta.")
      return
    }
    if (latitude == null || longitude == null) {
      setError("Indicá la ubicación con GPS o moviendo el pin.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createCommercialTerritorialActivityBrowser(
        companyId,
        {
          activityTypeId,
          description,
          observations,
          latitude,
          longitude,
          locationSource,
        },
        { employeeId: actorEmployeeId }
      )
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo crear la actividad.")
        return
      }
      if (photos.length > 0) {
        await uploadPhotos(result.data.id)
      }
      onCreated()
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la actividad."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const StatusIcon = locationStatus.icon

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Nueva Actividad</SheetTitle>
          <SheetDescription>
            Registrá la acción comercial en el territorio. Solo GPS, sin
            dirección.
          </SheetDescription>
        </SheetHeader>

        <form
          id={FORM_ID}
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="territorial-activity-type">Tipo *</Label>
              <Select
                value={activityTypeId || undefined}
                onValueChange={setActivityTypeId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="territorial-activity-type">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Configurá tipos en Configuración
                    </SelectItem>
                  ) : (
                    types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: type.color }}
                            aria-hidden
                          />
                          {type.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="territorial-activity-description">
                Descripción *
              </Label>
              <Textarea
                id="territorial-activity-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSubmitting}
                rows={3}
                placeholder="Ej. Se dejaron folletos en el edificio"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="territorial-activity-observations">
                Observaciones
              </Label>
              <Textarea
                id="territorial-activity-observations"
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                disabled={isSubmitting}
                rows={2}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="territorial-activity-photos">Fotos</Label>
              <Input
                id="territorial-activity-photos"
                type="file"
                accept="image/*"
                multiple
                disabled={isSubmitting}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  setPhotos(files)
                }}
              />
              {photos.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {photos.length} archivo{photos.length === 1 ? "" : "s"}{" "}
                  seleccionado{photos.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

            <div
              className={cn(
                "space-y-3 rounded-lg border p-4 transition-colors",
                locationStatus.tone === "ok" &&
                  "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
                locationStatus.tone === "manual" &&
                  "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                <span>Ubicación</span>
              </div>

              <div className="space-y-1" role="status">
                <p
                  className={cn(
                    "inline-flex items-center gap-2 text-sm font-medium",
                    locationStatus.tone === "ok" &&
                      "text-emerald-700 dark:text-emerald-400",
                    locationStatus.tone === "manual" &&
                      "text-amber-700 dark:text-amber-400",
                    locationStatus.tone === "muted" && "text-muted-foreground"
                  )}
                >
                  <StatusIcon className="size-4 shrink-0" aria-hidden />
                  {locationStatus.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locationStatus.description}
                </p>
                {locationSource === "gps" && gpsAccuracy != null ? (
                  <p className="text-xs text-muted-foreground">
                    Precisión aproximada ±{gpsAccuracy} m
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {locationSource !== "manual" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 justify-start gap-2 bg-background"
                    disabled={isSubmitting || isLocating}
                    onClick={handleUseMyLocation}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                    <LocateFixed className="size-3.5" />
                    {isLocating ? "Obteniendo…" : "Usar mi ubicación"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={mapExpanded ? "default" : "outline"}
                  className={cn(
                    "h-9 justify-start gap-2",
                    !mapExpanded && "bg-background"
                  )}
                  disabled={isSubmitting || isLocating}
                  onClick={handleOpenManualMap}
                  aria-expanded={mapExpanded}
                >
                  <MapPin className="size-3.5" />
                  {locationSource === "manual"
                    ? "Ver mapa"
                    : locationSource === "gps"
                      ? "Ajustar ubicación"
                      : "Ajustar manualmente"}
                </Button>
              </div>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-in-out",
                  mapExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 pt-1">
                    <div className="h-[280px] overflow-hidden rounded-md border">
                      {mapExpanded ? (
                        <MapCanvas
                          mode="activity"
                          markers={[]}
                          selectedId={null}
                          pickMode
                          draftPin={draftPin}
                          focusPoint={gpsFocus}
                          onBoundsChange={() => {
                            /* create drawer does not filter by viewport */
                          }}
                          onSelect={() => {
                            /* no markers */
                          }}
                          onPickLocation={(coords) => {
                            setLatitude(coords.latitude)
                            setLongitude(coords.longitude)
                            setLocationSource("manual")
                            setGpsAccuracy(null)
                          }}
                          className="h-full min-h-[280px] border-0"
                        />
                      ) : null}
                    </div>
                    {mapExpanded ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Tocá el mapa o arrastrá el pin para ajustar el punto.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0"
                          onClick={() => setMapExpanded(false)}
                        >
                          Ocultar mapa
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {geoError ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {geoError}
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <CommercialDrawerFooter
            formId={FORM_ID}
            isSubmitting={isSubmitting}
            onCancel={() => onOpenChange(false)}
            submitLabel="Guardar Actividad"
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}
