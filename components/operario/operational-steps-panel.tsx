"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Camera, Loader2 } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import {
  getLatestPhotoForStep,
  getOperationalStepsProgress,
  hasOperationalSteps,
  isOperationalStepComplete,
} from "@/lib/operational-steps/utils"
import { filterFtthTextStepsForPhotoPanel } from "@/lib/tasks/ftth-installation"
import {
  listTaskEvidencePhotos,
  uploadOperationalStepPhoto,
} from "@/lib/supabase/task-photos.browser"
import type { OperationalStep, Task } from "@/lib/types/tasks"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

type OperationalStepsPanelProps = {
  task: Task
  refreshKey?: number
  onProgressChange?: () => void
  actionsDisabled?: boolean
}

type OperationalTextStepFieldProps = {
  step: OperationalStep
  actionsDisabled: boolean
  isSaving: boolean
  onSave: (stepId: string, value: string) => Promise<void>
}

function OperationalTextStepField({
  step,
  actionsDisabled,
  isSaving,
  onSave,
}: OperationalTextStepFieldProps) {
  const [value, setValue] = useState(step.observation)

  useEffect(() => {
    setValue(step.observation)
  }, [step.observation])

  const savedValue = step.observation.trim()
  const isComplete = savedValue.length > 0
  const isDirty = value.trim() !== savedValue

  return (
    <div className="mt-3 space-y-2">
      {actionsDisabled ? (
        <p className="text-sm text-foreground">
          {savedValue || "Sin datos"}
        </p>
      ) : (
        <>
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={`Ingrese ${step.label.toLowerCase()}`}
            className="h-11 rounded-xl"
            disabled={isSaving}
          />
          <Button
            type="button"
            size="lg"
            className="h-11 w-full gap-2 rounded-xl text-base font-semibold"
            onClick={() => void onSave(step.id, value)}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </>
      )}
      {isComplete ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Dato guardado
        </p>
      ) : null}
    </div>
  )
}

export function OperationalStepsPanel({
  task,
  refreshKey = 0,
  onProgressChange,
  actionsDisabled = false,
}: OperationalStepsPanelProps) {
  const { getTask, syncOperationalStepsProgress, updateOperationalStepObservation } =
    useTasks()
  const liveTask = getTask(task.id) ?? task
  const allSteps = liveTask.operationalSteps ?? []
  const photoSteps = filterFtthTextStepsForPhotoPanel(allSteps)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null)
  const [savingStepId, setSavingStepId] = useState<string | null>(null)
  const [pendingStepId, setPendingStepId] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      const result = await listTaskEvidencePhotos(task.id)
      if (cancelled || !result.data) return
      setPhotos(result.data)
    }

    void loadPhotos()

    return () => {
      cancelled = true
    }
  }, [task.id, refreshKey])

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
      allSteps.filter((step) => isOperationalStepComplete(step, stepPhotoCounts))
        .length,
    [allSteps, stepPhotoCounts]
  )
  const progress = getOperationalStepsProgress(allSteps, stepPhotoCounts)

  if (!hasOperationalSteps(liveTask)) {
    return null
  }

  function openStepPhotoPicker(stepId: string) {
    if (actionsDisabled || uploadingStepId) return
    setPendingStepId(stepId)
    fileInputRef.current?.click()
  }

  async function handleSaveObservation(stepId: string, value: string) {
    setSavingStepId(stepId)

    const result = await updateOperationalStepObservation(
      task.id,
      stepId,
      value.trim()
    )

    setSavingStepId(null)

    if (result.success) {
      onProgressChange?.()
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file || !pendingStepId) return

    setUploadingStepId(pendingStepId)

    const result = await uploadOperationalStepPhoto({
      taskId: task.id,
      operationalStepId: pendingStepId,
      file,
    })

    if (result.error || !result.data) {
      setUploadingStepId(null)
      setPendingStepId(null)
      return
    }

    const refreshed = await listTaskEvidencePhotos(task.id)
    const nextPhotos = refreshed.data ?? []
    setPhotos(nextPhotos)

    const nextCounts: Record<string, number> = {}
    for (const photo of nextPhotos) {
      if (!photo.operationalStepId) continue
      nextCounts[photo.operationalStepId] =
        (nextCounts[photo.operationalStepId] ?? 0) + 1
    }

    await syncOperationalStepsProgress(task.id, nextCounts)
    setUploadingStepId(null)
    setPendingStepId(null)
    onProgressChange?.()
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      {!actionsDisabled ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={handleFileSelected}
          disabled={Boolean(uploadingStepId)}
        />
      ) : null}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {completedSteps} de {allSteps.length} completados
          </p>
          <span className="text-lg font-bold tabular-nums text-primary">
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      <div className="mt-4 space-y-3">
        {photoSteps.map((step) => {
          const isTextStep = step.stepKind === "text"
          const isComplete = isOperationalStepComplete(step, stepPhotoCounts)
          const latestPhoto = getLatestPhotoForStep(photos, step.id)
          const isUploading = uploadingStepId === step.id
          const isSaving = savingStepId === step.id

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-xl border p-3",
                isComplete
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : "bg-muted/20"
              )}
            >
              <p className="text-base font-semibold leading-snug">
                {isComplete ? `✅ ${step.label}` : `☐ ${step.label}`}
              </p>

              {isTextStep ? (
                <OperationalTextStepField
                  step={step}
                  actionsDisabled={actionsDisabled}
                  isSaving={isSaving}
                  onSave={handleSaveObservation}
                />
              ) : isComplete && latestPhoto ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(latestPhoto)
                      setViewerOpen(true)
                    }}
                    className="block w-full overflow-hidden rounded-lg border bg-background"
                  >
                    {latestPhoto.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={latestPhoto.signedUrl}
                        alt={step.label}
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-muted/40 text-sm text-muted-foreground">
                        {latestPhoto.fileName}
                      </div>
                    )}
                  </button>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Foto cargada
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 flex-1 rounded-xl"
                      onClick={() => {
                        setSelectedPhoto(latestPhoto)
                        setViewerOpen(true)
                      }}
                    >
                      Ver
                    </Button>
                    {!actionsDisabled ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-10 flex-1 rounded-xl"
                        onClick={() => openStepPhotoPicker(step.id)}
                        disabled={Boolean(uploadingStepId)}
                      >
                        Reemplazar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : !actionsDisabled ? (
                <Button
                  type="button"
                  size="lg"
                  className="mt-3 h-12 w-full gap-2 rounded-xl text-base font-semibold"
                  onClick={() => openStepPhotoPicker(step.id)}
                  disabled={Boolean(uploadingStepId)}
                >
                  {isUploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5" />
                  )}
                  {isUploading ? "Subiendo..." : "Tomar foto"}
                </Button>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sin foto</p>
              )}
            </div>
          )
        })}
      </div>

      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </section>
  )
}
