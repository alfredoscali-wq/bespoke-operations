"use client"

import { useEffect, useState } from "react"

import { LocationInput } from "@/components/location/location-input"
import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
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
import { resolveCommercialLocationPaste } from "@/lib/commercial/resolve-person-location"
import { createCommercialTerritorialActivityBrowser } from "@/lib/supabase/commercial-territorial-activities.browser"
import type { CommercialTerritorialActivityType } from "@/lib/types/commercial-territorial-activity"

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
  const [locationInput, setLocationInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setActivityTypeId("")
      setDescription("")
      setObservations("")
      setPhotos([])
      setLocationInput("")
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [open])

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
    if (!locationInput.trim()) {
      setError("Indicá la ubicación de la actividad.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const resolved = await resolveCommercialLocationPaste(locationInput)
      if (!resolved) {
        setError(
          "No se pudo interpretar el enlace de Google Maps o las coordenadas."
        )
        return
      }

      const result = await createCommercialTerritorialActivityBrowser(
        companyId,
        {
          activityTypeId,
          description,
          observations,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          locationSource: resolved.locationSource,
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
            Registrá la acción comercial en el territorio.
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

            <LocationInput
              id="territorial-activity-location"
              value={locationInput}
              onChange={setLocationInput}
              disabled={isSubmitting}
              required
            />

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
