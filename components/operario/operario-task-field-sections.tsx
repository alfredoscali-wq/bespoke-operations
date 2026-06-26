"use client"

import { useEffect, useState } from "react"
import { Navigation, Phone, User } from "lucide-react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { listTaskReferencePhotos } from "@/lib/supabase/task-photos.browser"
import {
  formatContractedPlanLabel,
  formatAmountToCollectDisplay,
  getTaskTechnologyLabel,
} from "@/lib/tasks/commercial-plan"
import { isCambioDomicilioTask, parseCambioDomicilioFromTask } from "@/lib/tasks/cambio-domicilio"
import { buildGoogleMapsNavigationUrl, hasCoordinates } from "@/lib/gps"
import type { Task } from "@/lib/types/tasks"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { Button } from "@/components/ui/button"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"

function resolveCustomerName(task: Task): string | undefined {
  return task.customerName?.trim() || task.projectName?.trim() || undefined
}

function ServiceInfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0 last:pb-0">
      <p className="shrink-0 text-xs text-muted-foreground">{label}</p>
      <p className="text-right text-sm font-semibold leading-snug text-foreground">
        {value}
      </p>
    </div>
  )
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
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="sr-only">Cliente</h2>
      <div className="space-y-2">
        {customerName ? (
          <div className="flex items-center gap-2.5">
            <User className="size-5 shrink-0 text-primary" />
            <p className="text-lg font-bold leading-tight text-foreground">
              {customerName}
            </p>
          </div>
        ) : null}
        {phone ? (
          <WhatsAppLink
            phone={phone}
            className="flex items-center gap-2.5 rounded-lg bg-primary/8 px-3 py-2.5 text-base font-semibold text-primary no-underline hover:bg-primary/12 hover:text-primary hover:no-underline active:bg-primary/12"
          >
            <Phone className="size-4 shrink-0" />
            {phone}
          </WhatsAppLink>
        ) : null}
      </div>
    </section>
  )
}

type OperarioTaskLocationCardProps = {
  task: Task
}

export function OperarioTaskLocationCard({ task }: OperarioTaskLocationCardProps) {
  if (isCambioDomicilioTask(task)) {
    const details = parseCambioDomicilioFromTask(task)

    return (
      <section className="space-y-3">
        {[
          { title: "Domicilio actual", location: details.current },
          { title: "Domicilio nuevo", location: details.new },
        ].map(({ title, location }) => (
          <div
            key={title}
            className="rounded-xl border bg-card px-4 py-3 shadow-sm"
          >
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
            <div className="space-y-2">
              {location.address ? (
                <div>
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {location.address}
                  </p>
                </div>
              ) : null}
              {location.locality ? (
                <div>
                  <p className="text-xs text-muted-foreground">Localidad</p>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {location.locality}
                  </p>
                </div>
              ) : null}
              {hasCoordinates(location.latitude, location.longitude) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-full gap-2 rounded-lg text-sm font-semibold"
                  onClick={() =>
                    window.open(
                      buildGoogleMapsNavigationUrl(
                        location.latitude as number,
                        location.longitude as number
                      ),
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  <Navigation className="size-4" />
                  Navegar
                </Button>
              ) : location.sharedLocation ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-full gap-2 rounded-lg text-sm font-semibold"
                  onClick={() =>
                    window.open(location.sharedLocation, "_blank", "noopener,noreferrer")
                  }
                >
                  <Navigation className="size-4" />
                  Abrir ubicación
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    )
  }

  const address = task.serviceAddress?.trim()
  const locality = task.locality?.trim()
  const sharedLocation = task.sharedLocation?.trim()

  if (!address && !locality && !sharedLocation) {
    return null
  }

  function handleOpenLocation() {
    if (!sharedLocation) return
    window.open(sharedLocation, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        📍 Ubicación
      </h2>
      <div className="space-y-2">
        {address ? (
          <div>
            <p className="text-xs text-muted-foreground">Dirección</p>
            <p className="text-sm font-medium leading-snug text-foreground">
              {address}
            </p>
          </div>
        ) : null}
        {locality ? (
          <div>
            <p className="text-xs text-muted-foreground">Localidad</p>
            <p className="text-sm font-medium leading-snug text-foreground">
              {locality}
            </p>
          </div>
        ) : null}
        {sharedLocation ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-full gap-2 rounded-lg text-sm font-semibold"
            onClick={handleOpenLocation}
          >
            <Navigation className="size-4" />
            🧭 Abrir ubicación
          </Button>
        ) : null}
      </div>
    </section>
  )
}

type OperarioTaskServiceInfoCardProps = {
  task: Task
}

export function OperarioTaskServiceInfoCard({
  task,
}: OperarioTaskServiceInfoCardProps) {
  const technologyLabel = getTaskTechnologyLabel(task)
  const planLabel = formatContractedPlanLabel(task.contractedPlan)
  const amountLabel =
    task.amountToCollect != null
      ? formatAmountToCollectDisplay(task.amountToCollect)
      : null

  if (!technologyLabel && !planLabel && !amountLabel) {
    return null
  }

  return (
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Información del servicio
      </h2>
      <div>
        {technologyLabel ? (
          <ServiceInfoRow label="Tecnología" value={technologyLabel} />
        ) : null}
        {planLabel ? (
          <ServiceInfoRow label="Plan contratado" value={planLabel} />
        ) : null}
        {amountLabel ? (
          <ServiceInfoRow label="💰 Importe a cobrar" value={amountLabel} />
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
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Observaciones
      </h2>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
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
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Fotos de referencia
      </h2>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              setSelectedPhoto(photo)
              setViewerOpen(true)
            }}
            className="size-20 shrink-0 snap-start overflow-hidden rounded-lg border bg-muted/30"
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
