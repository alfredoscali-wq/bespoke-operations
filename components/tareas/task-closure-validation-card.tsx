"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ClipboardCheck, ImageIcon } from "lucide-react"

import { TaskEvidencePhotosGallery } from "@/components/tareas/task-evidence-photos-gallery"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import {
  getLatestPhotoForStep,
  hasOperationalSteps,
} from "@/lib/operational-steps/utils"
import { listTaskEvidencePhotos } from "@/lib/supabase/task-photos.browser"
import type { Task } from "@/lib/types/tasks"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type TaskClosureValidationCardProps = {
  task: Task
  onApprove: () => void
  onReject: () => void
  isPending?: boolean
}

export function TaskClosureValidationCard({
  task,
  onApprove,
  onReject,
  isPending = false,
}: TaskClosureValidationCardProps) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const usesSteps = hasOperationalSteps(task)

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      const result = await listTaskEvidencePhotos(task.id)
      if (cancelled) return
      setPhotos(result.data ?? [])
    }

    void loadPhotos()

    return () => {
      cancelled = true
    }
  }, [task.id])

  const evidenceCount = photos.length
  const completedChecklistItems = task.checklist.filter(
    (item) => item.completed
  ).length
  const completedSteps = useMemo(() => {
    if (!usesSteps) return 0

    return (task.operationalSteps ?? []).filter((step) =>
      photos.some((photo) => photo.operationalStepId === step.id)
    ).length
  }, [photos, task.operationalSteps, usesSteps])

  return (
    <Card className="border-orange-200 bg-orange-50/50 shadow-sm dark:border-orange-900 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Validación de Cierre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {usesSteps ? (
          <>
            <div className="rounded-lg border bg-background/80 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ClipboardCheck className="size-4 text-orange-700" />
                Pasos Operativos
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {completedSteps} de {task.operationalSteps?.length ?? 0} pasos
                completados
              </p>
              <Progress
                value={
                  task.operationalSteps?.length
                    ? Math.round(
                        (completedSteps / task.operationalSteps.length) * 100
                      )
                    : 0
                }
                className="mt-3 h-2"
              />
            </div>

            <div className="space-y-3">
              {(task.operationalSteps ?? []).map((step) => {
                const latestPhoto = getLatestPhotoForStep(photos, step.id)

                return (
                  <div
                    key={step.id}
                    className="rounded-lg border bg-background/80 p-3"
                  >
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.observation?.trim() ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {step.observation}
                      </p>
                    ) : null}
                    {latestPhoto?.signedUrl ? (
                      <button
                        type="button"
                        className="mt-3 block w-full overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={latestPhoto.signedUrl}
                          alt={step.label}
                          className="aspect-video w-full object-cover"
                        />
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sin evidencia cargada
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-background/80 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardCheck className="size-4 text-orange-700" />
                  Checklist
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {completedChecklistItems} de {task.checklist.length} elementos
                  completados
                </p>
                <Progress value={task.progress} className="mt-3 h-2" />
              </div>
              <div className="rounded-lg border bg-background/80 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ImageIcon className="size-4 text-orange-700" />
                  Evidencias
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {evidenceCount} evidencia{evidenceCount === 1 ? "" : "s"} cargada
                  {evidenceCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <TaskEvidencePhotosGallery taskId={task.id} />
          </>
        )}

        {task.completedAt ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Fecha de finalización:</span>{" "}
            {formatTaskDateTime(task.completedAt)}
          </p>
        ) : null}

        {task.observationsForCrew?.trim() ? (
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">
              Observaciones para la cuadrilla
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {task.observationsForCrew}
            </p>
          </div>
        ) : null}

        {task.description.trim() ? (
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={isPending} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            ✔ Aprobar cierre
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isPending}
          >
            ✖ Rechazar cierre
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
