"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MessageSquarePlus,
  Play,
} from "lucide-react"

import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useOperario } from "@/components/operario/operario-provider"
import { getEvidenceTaskKey } from "@/lib/data/evidence"
import { getWorkerTasks } from "@/lib/data/operario"
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  formatTaskDate,
  formatTaskDateTime,
} from "@/lib/tasks/constants"
import { canPerformTaskAction } from "@/lib/tasks/task-status-workflow"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

type OperarioTaskDetailScreenProps = {
  id: string
}

type UploadState = "idle" | "uploading" | "success" | "error"

export function OperarioTaskDetailScreen({ id }: OperarioTaskDetailScreenProps) {
  const { worker } = useOperario()
  const { evidence, uploadEvidence } = useEvidence()
  const {
    tasks,
    detailVersion,
    getTask,
    getDetail,
    startTask,
    submitTaskForApproval,
    toggleChecklistItem,
    addComment,
  } = useTasks()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [observation, setObservation] = useState("")
  const [showObservationForm, setShowObservationForm] = useState(false)

  const task = getTask(id)
  const detail = useMemo(
    () => getDetail(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDetail, id, tasks, detailVersion]
  )

  const taskEvidence = useMemo(() => {
    if (!task) return []

    const taskKey = getEvidenceTaskKey({
      taskId: task.id,
      taskCode: task.code,
    })

    return evidence.filter(
      (item) => getEvidenceTaskKey(item) === taskKey
    )
  }, [evidence, task])

  if (!task || !detail) {
    notFound()
  }

  const isAssigned = getWorkerTasks(tasks).some((item) => item.id === id)
  if (!isAssigned) {
    notFound()
  }

  const activeTask = task as NonNullable<typeof task>
  const activeDetail = detail as NonNullable<typeof detail>
  const isUploading = uploadState === "uploading"

  function openFilePicker() {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    setUploadState("uploading")
    setActionError(null)
    setActionMessage(null)

    const result = await uploadEvidence({
      file,
      projectId: activeTask.projectId ?? "",
      projectCode: activeTask.projectCode,
      projectName: activeTask.projectName,
      taskId: activeTask.id,
      taskCode: activeTask.code,
      taskTitle: activeTask.title,
      crew: activeTask.crew,
      worker: worker.name,
      description: `Evidencia de campo — ${activeTask.code}`,
      category: "Campo",
      evidenceType: "progress-photo",
      origin: "operario",
    })

    if (result.success) {
      setUploadState("success")
      setActionMessage(result.message ?? "Evidencia subida correctamente.")
      return
    }

    setUploadState("error")
    setActionError(
      result.message ??
        "No se pudo subir la evidencia. Verifique su conexión e intente de nuevo."
    )
  }

  async function handleStartWork() {
    setActionError(null)
    setActionMessage(null)

    if (activeTask.status === "asignada") {
      const result = await startTask(activeTask.id)
      if (result.success) {
        setActionMessage("Trabajo iniciado.")
      } else {
        setActionError(result.message ?? "No se pudo iniciar.")
      }
      return
    }

    if (activeTask.status === "en-curso") {
      setActionMessage("La tarea ya está en curso.")
      return
    }

    setActionError("Esta tarea no puede iniciarse en su estado actual.")
  }

  function handleAddObservation() {
    if (!observation.trim()) return

    addComment(activeTask.id, observation.trim(), worker.name, "operario")
    setObservation("")
    setShowObservationForm(false)
    setActionMessage("Observación registrada.")
    setActionError(null)
  }

  async function handleRequestClosure() {
    setActionError(null)
    setActionMessage(null)

    const validation = canPerformTaskAction(activeTask, "submit-for-approval")
    if (!validation.allowed) {
      setActionError(validation.message ?? "Checklist incompleto.")
      return
    }

    const result = await submitTaskForApproval(activeTask.id)
    if (result.success) {
      setActionMessage("Trabajo finalizado. Enviado a supervisión.")
    } else {
      setActionError(result.message ?? "No se pudo enviar a aprobación.")
    }
  }

  const closureBlocked = !canPerformTaskAction(
    activeTask,
    "submit-for-approval"
  ).allowed

  return (
    <div className="space-y-5 px-4 pt-4 pb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileSelected}
        disabled={isUploading}
      />

      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-10 gap-2 text-muted-foreground"
        asChild
      >
        <Link href="/operario">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <header className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-primary">
            {activeTask.code}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {TASK_STATUS_LABELS[activeTask.status]}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-[10px]", TASK_PRIORITY_STYLES[activeTask.priority])}
          >
            {TASK_PRIORITY_LABELS[activeTask.priority]}
          </Badge>
        </div>

        <h1 className="text-xl font-bold leading-snug text-foreground">
          {activeTask.title}
        </h1>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Proyecto</dt>
            <dd className="font-medium">
              <span className="font-mono text-primary">{activeTask.projectCode}</span>
              <span className="mt-0.5 block text-foreground">
                {activeTask.projectName}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="leading-relaxed">{activeTask.description}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <dt className="text-muted-foreground">Supervisor</dt>
              <dd className="font-medium">{activeTask.supervisor}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vence</dt>
              <dd className="font-medium">{formatTaskDate(activeTask.dueDate)}</dd>
            </div>
          </div>
        </dl>
      </header>

      {actionMessage && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {closureBlocked && activeTask.status === "en-curso" && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {canPerformTaskAction(activeTask, "submit-for-approval").message}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-16 gap-2 rounded-2xl text-base font-semibold"
          onClick={handleStartWork}
          disabled={
            activeTask.status !== "asignada" &&
            activeTask.status !== "en-curso"
          }
        >
          <Play className="size-5 shrink-0" />
          Iniciar Trabajo
        </Button>

        <Button
          size="lg"
          variant="secondary"
          className="h-16 gap-2 rounded-2xl text-base font-semibold"
          onClick={openFilePicker}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="size-5 shrink-0 animate-spin" />
          ) : (
            <Camera className="size-5 shrink-0" />
          )}
          {isUploading ? "Subiendo..." : "Subir Evidencias"}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-16 gap-2 rounded-2xl text-base font-semibold"
          onClick={() => setShowObservationForm((value) => !value)}
        >
          <MessageSquarePlus className="size-5 shrink-0" />
          Agregar Observación
        </Button>

        <Button
          size="lg"
          className="h-16 gap-2 rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
          onClick={handleRequestClosure}
          disabled={
            activeTask.status !== "en-curso" || closureBlocked
          }
        >
          <ClipboardCheck className="size-5 shrink-0" />
          Solicitar Cierre
        </Button>
      </section>

      {showObservationForm && (
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <Label htmlFor="observation" className="text-sm font-semibold">
            Nueva observación
          </Label>
          <Textarea
            id="observation"
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Escriba su observación..."
            rows={3}
            className="text-base"
          />
          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-xl"
              onClick={handleAddObservation}
              disabled={!observation.trim()}
            >
              Guardar
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setShowObservationForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Checklist</h2>
          <span className="text-lg font-bold tabular-nums text-primary">
            {activeTask.progress}%
          </span>
        </div>
        <Progress value={activeTask.progress} className="h-2.5" />
        <div className="space-y-3 pt-1">
          {activeTask.checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl bg-muted/30 p-3"
            >
              <Checkbox
                id={`${activeTask.id}-${item.id}`}
                checked={item.completed}
                onCheckedChange={() =>
                  toggleChecklistItem(activeTask.id, item.id)
                }
                className="mt-0.5 size-5"
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`${activeTask.id}-${item.id}`}
                  className={cn(
                    "cursor-pointer text-base leading-snug",
                    item.completed && "text-muted-foreground line-through"
                  )}
                >
                  {item.label}
                </Label>
                {item.required && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Obligatorio
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Evidencias</h2>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={openFilePicker}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {isUploading ? "Subiendo..." : "Subir foto"}
          </Button>
        </div>

        {taskEvidence.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin evidencias cargadas
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {taskEvidence.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border bg-muted/20"
              >
                <div className="relative aspect-square bg-muted/50">
                  {item.previewUrl ? (
                    <Image
                      src={item.previewUrl}
                      alt={item.fileName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 512px) 50vw, 240px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera className="size-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug">
                    {item.fileName}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatTaskDateTime(item.uploadedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Observaciones</h2>

        {activeDetail.comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin observaciones
          </p>
        ) : (
          <div className="space-y-3">
            {[...activeDetail.comments]
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              )
              .map((comment) => {
                const roleLabel =
                  comment.role === "supervisor"
                    ? "Supervisor"
                    : comment.role === "operario"
                      ? "Operario"
                      : "Coordinador"

                return (
                  <div
                    key={comment.id}
                    className="rounded-xl border bg-muted/20 p-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {roleLabel}:
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {comment.content}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {comment.author} · {formatTaskDateTime(comment.timestamp)}
                    </p>
                  </div>
                )
              })}
          </div>
        )}
      </section>
    </div>
  )
}
