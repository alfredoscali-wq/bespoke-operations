"use client"

import { useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import type { Project } from "@/lib/types/projects"
import type { Task, TaskPriority, TaskType } from "@/lib/types/tasks"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/tasks/constants"
import {
  generateTaskCode,
  resolveSupervisorFromCrew,
  resolveTaskSupervisorForCrewChange,
} from "@/lib/tasks/utils"
import {
  isSameTaskCrewAssignment,
  resolveCrewSnapshotsForAssignment,
  resolveTaskCrewId,
} from "@/lib/tasks/crew-relation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const defaultChecklist = [
  { id: "cl-1", label: "Fotos iniciales", completed: false, required: true },
  { id: "cl-2", label: "Material asignado", completed: false, required: true },
  { id: "cl-3", label: "Fotos finales", completed: false, required: true },
  {
    id: "cl-4",
    label: "Observaciones finales",
    completed: false,
    required: false,
  },
]

type ProjectTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  project: Project
  task?: Task
  existingTasks: Task[]
  onSubmit: (payload: {
    code: string
    title: string
    description: string
    type: TaskType
    priority: TaskPriority
    supervisor: string
    crewId: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
  }) => Promise<void>
}

type TaskFormState = {
  title: string
  description: string
  type: TaskType
  priority: TaskPriority
  crewId: string
  startDate: string
  dueDate: string
  estimatedDuration: string
}

function projectTypeToTaskType(type: Project["type"]): TaskType {
  return type
}

function buildCreateForm(project: Project): TaskFormState {
  const today = new Date().toISOString().slice(0, 10)

  return {
    title: "",
    description: "",
    type: projectTypeToTaskType(project.type),
    priority: "media",
    crewId: "",
    startDate: today,
    dueDate: project.endDate || today,
    estimatedDuration: "",
  }
}

function buildEditForm(task: Task, crews: { id: string; name: string }[]): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    crewId: resolveTaskCrewId(task, crews) ?? "",
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedDuration: task.estimatedDuration,
  }
}

export function ProjectTaskDialog({
  open,
  onOpenChange,
  mode,
  project,
  task,
  existingTasks,
  onSubmit,
}: ProjectTaskDialogProps) {
  const { crews } = useCrews()
  const crewOptions = useMemo(
    () => getCrewsForTaskSelection(crews, task?.crewId),
    [crews, task?.crewId]
  )
  const assignableCrews = useMemo(
    () => getCrewsForTaskSelection(crews),
    [crews]
  )
  const [form, setForm] = useState<TaskFormState>(() => buildCreateForm(project))
  const [baselineForm, setBaselineForm] = useState<TaskFormState>(() =>
    buildCreateForm(project)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  const selectedCrew = crews.find((crew) => crew.id === form.crewId)
  const inheritedSupervisor =
    mode === "edit" && task
      ? resolveTaskSupervisorForCrewChange(
          form.crewId,
          crews,
          task.crewId ?? resolveTaskCrewId(task, crews) ?? null,
          task.supervisor
        )
      : resolveSupervisorFromCrew(selectedCrew)

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm =
      mode === "edit" && task
        ? buildEditForm(task, crews)
        : {
            ...buildCreateForm(project),
            crewId: assignableCrews[0]?.id ?? "",
          }

    setForm(nextForm)
    setBaselineForm(nextForm)
  }, [open, mode, project, task, assignableCrews, crews])

  function updateField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }

    if (!form.dueDate || !form.startDate) {
      setError("Las fechas de inicio y límite son obligatorias.")
      return
    }

    if (form.dueDate < form.startDate) {
      setError("La fecha límite no puede ser anterior a la fecha de inicio.")
      return
    }

    const isSameCrew =
      mode === "edit" && task && isSameTaskCrewAssignment(task, form.crewId)
    if (!isSameCrew) {
      const crewValidation = validateCrewAssignment(selectedCrew)
      if (!crewValidation.allowed) {
        setError(crewValidation.message ?? "Cuadrilla no disponible.")
        return
      }
    }

    setIsSubmitting(true)

    try {
      const code =
        mode === "edit" && task
          ? task.code
          : generateTaskCode(project.code, existingTasks)

      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

      await onSubmit({
        code,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        priority: form.priority,
        supervisor: inheritedSupervisor || snapshots.supervisor,
        crewId: snapshots.crewId ?? form.crewId,
        crew: snapshots.crew,
        startDate: form.startDate,
        dueDate: form.dueDate,
        estimatedDuration: form.estimatedDuration.trim(),
      })

      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la tarea."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    form.title.trim() !== "" &&
    form.crewId !== "" &&
    form.startDate !== "" &&
    form.dueDate !== ""

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva tarea" : "Editar tarea"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `La tarea se asociará a ${project.code} — ${project.name}.`
              : `Modifique los datos de la tarea en ${project.code}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Obra:</span>{" "}
              {project.code} — {project.name}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Ej. Empalme FO Sector B14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descripción</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Detalle de la actividad..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  updateField("priority", value as TaskPriority)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-start-date">Fecha de inicio</Label>
              <Input
                id="task-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due-date">Fecha límite</Label>
              <Input
                id="task-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField("dueDate", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cuadrilla</Label>
            <Select
              value={form.crewId}
              onValueChange={(value) => updateField("crewId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {crewOptions.map((crew) => (
                  <SelectItem
                    key={crew.id}
                    value={crew.id}
                    disabled={crew.status === "inactiva"}
                  >
                    {crew.name}
                    {crew.status === "inactiva" ? " (inactiva)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.crewId && inheritedSupervisor ? (
              <p className="text-xs text-muted-foreground">
                Supervisor asignado por cuadrilla:{" "}
                <span className="font-medium text-foreground">
                  {inheritedSupervisor}
                </span>
              </p>
            ) : null}
          </div>

          {mode === "create" && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) => updateField("type", value as TaskType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : mode === "create"
                  ? "Crear tarea"
                  : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}

export { defaultChecklist }
