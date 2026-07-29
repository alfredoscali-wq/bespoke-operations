"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { COMMERCIAL_ETIQUETA_FALLBACK_COLOR } from "@/lib/commercial/map-layers"
import { getCommercialTerritorialActivityByIdBrowser } from "@/lib/supabase/commercial-territorial-activities.browser"
import type { CommercialTerritorialActivity } from "@/lib/types/commercial-territorial-activity"

type AttachmentListItem = {
  id: string
  originalName: string
  mimeType: string
}

type CommercialTerritorialActivityDetailDialogProps = {
  open: boolean
  activityId: string | null
  companyId: string | null
  onOpenChange: (open: boolean) => void
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function CommercialTerritorialActivityDetailDialog({
  open,
  activityId,
  companyId,
  onOpenChange,
}: CommercialTerritorialActivityDetailDialogProps) {
  const [activity, setActivity] = useState<CommercialTerritorialActivity | null>(
    null
  )
  const [photos, setPhotos] = useState<
    Array<AttachmentListItem & { previewUrl?: string }>
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !activityId || !companyId) {
      setActivity(null)
      setPhotos([])
      setError(null)
      return
    }

    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const result = await getCommercialTerritorialActivityByIdBrowser(
        companyId,
        activityId
      )
      if (cancelled) return
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo cargar el detalle.")
        setActivity(null)
        setIsLoading(false)
        return
      }
      setActivity(result.data)

      const attachmentsResponse = await fetch(
        `/api/attachments?module=commercial&recordId=${encodeURIComponent(activityId)}`
      )
      const attachmentsPayload = (await attachmentsResponse
        .json()
        .catch(() => null)) as {
        success?: boolean
        attachments?: AttachmentListItem[]
      } | null

      if (!cancelled && attachmentsResponse.ok && attachmentsPayload?.attachments) {
        const imageAttachments = attachmentsPayload.attachments.filter(
          (entry) => entry.mimeType.startsWith("image/")
        )
        const withPreviews = await Promise.all(
          imageAttachments.map(async (entry) => {
            const previewResponse = await fetch(
              `/api/attachments?id=${encodeURIComponent(entry.id)}&preview=1`
            )
            const previewPayload = (await previewResponse
              .json()
              .catch(() => null)) as { url?: string } | null
            return {
              ...entry,
              previewUrl: previewPayload?.url,
            }
          })
        )
        if (!cancelled) setPhotos(withPreviews)
      } else if (!cancelled) {
        setPhotos([])
      }

      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [activityId, companyId, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle de actividad</DialogTitle>
          <DialogDescription>
            {activity?.code ?? "Actividad comercial territorial"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : activity ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{
                  backgroundColor:
                    activity.activityTypeColor ||
                    COMMERCIAL_ETIQUETA_FALLBACK_COLOR,
                }}
                aria-hidden
              />
              <span className="font-medium">
                {activity.activityTypeName ?? "Sin tipo"}
              </span>
            </div>

            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Fecha y hora</dt>
                <dd>{formatDateTime(activity.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Usuario</dt>
                <dd>{activity.employeeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Descripción</dt>
                <dd className="whitespace-pre-wrap">{activity.description}</dd>
              </div>
              {activity.observations.trim() ? (
                <div>
                  <dt className="text-muted-foreground">Observaciones</dt>
                  <dd className="whitespace-pre-wrap">
                    {activity.observations}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Ubicación</dt>
                <dd className="font-mono text-xs">
                  {activity.latitude.toFixed(5)}, {activity.longitude.toFixed(5)}
                </dd>
              </div>
            </dl>

            {photos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Fotos</p>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) =>
                    photo.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photo.id}
                        src={photo.previewUrl}
                        alt={photo.originalName}
                        className="h-28 w-full rounded-md border object-cover"
                      />
                    ) : (
                      <div
                        key={photo.id}
                        className="flex h-28 items-center justify-center rounded-md border text-xs text-muted-foreground"
                      >
                        {photo.originalName}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin fotos.</p>
            )}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
