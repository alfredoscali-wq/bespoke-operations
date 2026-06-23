"use client"

import { useEffect, useMemo, useState } from "react"
import { Camera, CheckCircle2, ImageOff } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import {
  getLatestPhotoForStep,
  getOperationalStepsProgress,
  hasOperationalSteps,
} from "@/lib/operational-steps/utils"
import { listTaskEvidencePhotos } from "@/lib/supabase/task-photos.browser"
import type { Task } from "@/lib/types/tasks"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type TaskOperationalStepsTabProps = {
  task: Task
}

export function TaskOperationalStepsTab({ task }: TaskOperationalStepsTabProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const steps = liveTask.operationalSteps ?? []

  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    if (!hasOperationalSteps(liveTask)) return

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
  }, [liveTask, task.id])

  const stepPhotoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const photo of photos) {
      if (!photo.operationalStepId) continue
      counts[photo.operationalStepId] =
        (counts[photo.operationalStepId] ?? 0) + 1
    }
    return counts
  }, [photos])

  const completedSteps = useMemo(
    () =>
      steps.filter((step) => (stepPhotoCounts[step.id] ?? 0) > 0).length,
    [stepPhotoCounts, steps]
  )
  const progress = getOperationalStepsProgress(steps, stepPhotoCounts)

  if (!hasOperationalSteps(liveTask)) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pasos Operativos</CardTitle>
              <CardDescription>
                Revisión de avance operativo (solo lectura)
              </CardDescription>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-primary">
              {progress}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2.5" />
          <p className="text-sm text-muted-foreground">
            {completedSteps} de {steps.length} pasos completados
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => {
          const isComplete = (stepPhotoCounts[step.id] ?? 0) > 0
          const latestPhoto = getLatestPhotoForStep(photos, step.id)
          const observation = step.observation?.trim()

          return (
            <Card
              key={step.id}
              className={cn(
                "shadow-sm",
                isComplete &&
                  "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {step.label}
                  </CardTitle>
                  <Badge
                    variant={isComplete ? "default" : "secondary"}
                    className={cn(
                      "shrink-0",
                      isComplete &&
                        "bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-700"
                    )}
                  >
                    {isComplete ? (
                      <>
                        <CheckCircle2 className="size-3" />
                        Completado
                      </>
                    ) : (
                      "Pendiente"
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Estado
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {isComplete ? "✓ Completado" : "Pendiente"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Foto
                  </p>
                  {latestPhoto ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(latestPhoto)
                        setViewerOpen(true)
                      }}
                      className="mt-2 block w-full overflow-hidden rounded-lg border bg-background text-left transition-opacity hover:opacity-90"
                    >
                      {latestPhoto.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={latestPhoto.signedUrl}
                          alt={step.label}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground">
                          <Camera className="size-4" />
                          {latestPhoto.fileName}
                        </div>
                      )}
                    </button>
                  ) : (
                    <div className="mt-2 flex aspect-video items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
                      <ImageOff className="size-4" />
                      Sin foto
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Observación
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {observation || "Sin observación"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  )
}
