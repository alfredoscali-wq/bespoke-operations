"use client"

import { useEffect, useState } from "react"
import { MapPin, Navigation, Phone, Signal, User } from "lucide-react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { listTaskReferencePhotos } from "@/lib/supabase/task-photos.browser"
import {
  formatContractedPlanLabel,
  getTaskTechnologyLabel,
  isNewInstallationTask,
} from "@/lib/tasks/commercial-plan"
import type { Task } from "@/lib/types/tasks"
import type { TaskPhoto } from "@/lib/types/task-photos"
import {
  getSharedLocationHref,
  hasLoadedGps,
} from "@/lib/utils/shared-location"
import { Button } from "@/components/ui/button"

function toTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, "")
  return `tel:${normalized}`
}

function resolveCustomerName(task: Task): string | undefined {
  return task.customerName?.trim() || task.projectName?.trim() || undefined
}

function resolveAddressLine(task: Task): string | undefined {
  const parts = [task.serviceAddress?.trim(), task.locality?.trim()].filter(
    Boolean
  )
  return parts.length > 0 ? parts.join(" - ") : undefined
}

type OperarioTaskClientCardProps = {
  task: Task
}

export function OperarioTaskClientCard({ task }: OperarioTaskClientCardProps) {
  const customerName = resolveCustomerName(task)
  const phone = task.customerPhone?.trim()

  if (!customerName && !phone) {
    return null
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="sr-only">Cliente</h2>
      <div className="space-y-3">
        {customerName ? (
          <div className="flex items-start gap-3">
            <User className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="text-base font-semibold leading-snug text-foreground">
              {customerName}
            </p>
          </div>
        ) : null}
        {phone ? (
          <a
            href={toTelHref(phone)}
            className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-3 text-base font-medium text-primary active:bg-muted/50"
          >
            <Phone className="size-5 shrink-0" />
            {phone}
          </a>
        ) : null}
      </div>
    </section>
  )
}

type OperarioTaskCommercialCardProps = {
  task: Task
}

export function OperarioTaskCommercialCard({ task }: OperarioTaskCommercialCardProps) {
  if (!isNewInstallationTask(task)) {
    return null
  }

  const technologyLabel = getTaskTechnologyLabel(task)
  const planLabel = formatContractedPlanLabel(task.contractedPlan)

  if (!technologyLabel && !planLabel) {
    return null
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="sr-only">Información comercial</h2>
      <div className="space-y-3">
        {technologyLabel ? (
          <div className="flex items-start gap-3">
            <Signal className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tecnología</p>
              <p className="text-base font-semibold">{technologyLabel}</p>
            </div>
          </div>
        ) : null}
        {planLabel ? (
          <div>
            <p className="text-xs text-muted-foreground">Plan contratado</p>
            <p className="text-base font-semibold">{planLabel}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

type OperarioTaskLocationCardProps = {
  task: Task
}

export function OperarioTaskLocationCard({ task }: OperarioTaskLocationCardProps) {
  const addressLine = resolveAddressLine(task)
  const gpsLoaded = hasLoadedGps(
    task.sharedLocation,
    task.latitude,
    task.longitude
  )
  const mapsHref = getSharedLocationHref(
    task.sharedLocation,
    task.latitude,
    task.longitude
  )

  if (!addressLine && !gpsLoaded && !mapsHref) {
    return null
  }

  function handleOpenGps() {
    if (!mapsHref) return
    window.open(mapsHref, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="sr-only">Ubicación</h2>
      <div className="space-y-3">
        {addressLine ? (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="text-base font-medium leading-snug">{addressLine}</p>
          </div>
        ) : null}
        {gpsLoaded ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ✅ GPS cargado
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">GPS no disponible</p>
        )}
        {mapsHref ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2 rounded-xl text-base font-semibold"
            onClick={handleOpenGps}
          >
            <Navigation className="size-5" />
            Abrir GPS
          </Button>
        ) : null}
      </div>
    </section>
  )
}

type OperarioTaskCrewNotesProps = {
  task: Task
}

export function OperarioTaskCrewNotes({ task }: OperarioTaskCrewNotesProps) {
  const notes = task.observationsForCrew?.trim()
  if (!notes) return null

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Observaciones para la cuadrilla
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground">
        {notes}
      </p>
    </section>
  )
}

type OperarioTaskReferencePhotosProps = {
  taskId: string
}

export function OperarioTaskReferencePhotos({
  taskId,
}: OperarioTaskReferencePhotosProps) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      const result = await listTaskReferencePhotos(taskId)
      if (cancelled) return
      setPhotos(result.data ?? [])
    }

    void loadPhotos()

    return () => {
      cancelled = true
    }
  }, [taskId])

  if (photos.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Fotos de referencia
      </h2>
      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              setSelectedPhoto(photo)
              setViewerOpen(true)
            }}
            className="size-24 shrink-0 snap-start overflow-hidden rounded-xl border bg-muted/30"
          >
            {photo.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.signedUrl}
                alt={photo.description || photo.fileName}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                {photo.fileName}
              </div>
            )}
          </button>
        ))}
      </div>
      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </section>
  )
}
