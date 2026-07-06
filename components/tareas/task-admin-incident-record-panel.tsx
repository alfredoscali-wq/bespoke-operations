"use client"

import { useEffect, useMemo, useState } from "react"
import { ImageIcon } from "lucide-react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import {
  PLANNING_INCIDENT_STATUS_LABELS,
  resolvePlanningIncidentEventLabel,
} from "@/lib/planificacion/planning-incidents"
import { createClient } from "@/lib/supabase/client"
import { TASK_PHOTOS_STORAGE_BUCKET } from "@/lib/supabase/task-photos.storage"
import type { IncidentResponse } from "@/lib/types/task-incidents"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type TaskAdminIncidentRecordPanelProps = {
  incident: IncidentResponse | null
  incidentTypeLabel: string
  isLoading?: boolean
}

type IncidentPhotoPreview = {
  id: string
  fileName: string
  signedUrl: string | null
}

async function signIncidentPhotoPath(
  storagePath: string
): Promise<string | null> {
  const client = createClient()
  const { data, error } = await client.storage
    .from(TASK_PHOTOS_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

export function TaskAdminIncidentRecordPanel({
  incident,
  incidentTypeLabel,
  isLoading = false,
}: TaskAdminIncidentRecordPanelProps) {
  const { getEmployee } = useEmployees()
  const [photoPreviews, setPhotoPreviews] = useState<IncidentPhotoPreview[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)

  const sortedEvents = useMemo(() => {
    if (!incident) {
      return []
    }

    return [...incident.events].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    )
  }, [incident])

  useEffect(() => {
    if (isLoading || !incident) {
      return
    }

    let cancelled = false

    async function loadPhotoPreviews() {
      if (!incident) {
        return
      }

      setPhotosLoading(true)

      if (incident.photos.length === 0) {
        if (!cancelled) {
          setPhotoPreviews([])
          setPhotosLoading(false)
        }
        return
      }

      const previews = await Promise.all(
        incident.photos.map(async (photo) => ({
          id: photo.id,
          fileName: photo.fileName?.trim() || "Fotografía de incidencia",
          signedUrl: await signIncidentPhotoPath(photo.storagePath),
        }))
      )

      if (!cancelled) {
        setPhotoPreviews(previews)
        setPhotosLoading(false)
      }
    }

    void loadPhotoPreviews()

    return () => {
      cancelled = true
    }
  }, [incident, isLoading])

  if (isLoading || !incident) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incidencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Incidencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <Badge variant="outline" className="mt-1">
              {PLANNING_INCIDENT_STATUS_LABELS[incident.status]}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="mt-1 text-sm font-medium">{incidentTypeLabel}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Comentario</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {incident.comment?.trim() || "Sin comentario."}
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fotos de la incidencia
          </p>
          {photosLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : photoPreviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin fotografías registradas para esta incidencia.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {photoPreviews.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-lg border bg-muted/20"
                >
                  {photo.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.signedUrl}
                      alt={photo.fileName}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-8" aria-hidden />
                    </div>
                  )}
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {photo.fileName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de eventos
          </p>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay eventos registrados.
            </p>
          ) : (
            <ol className="space-y-3">
              {sortedEvents.map((event) => {
                const actor = getEmployee(event.createdBy)
                const actorLabel = actor
                  ? `${actor.firstName} ${actor.lastName}`.trim()
                  : "Usuario del sistema"

                return (
                  <li
                    key={event.id}
                    className="rounded-lg border bg-muted/10 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {resolvePlanningIncidentEventLabel(event.eventType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {actorLabel}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTaskDateTime(event.createdAt)}
                      </p>
                    </div>
                    {event.comment?.trim() ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {event.comment}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
