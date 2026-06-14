"use client"

import { useEffect, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import type { Project } from "@/lib/types/projects"
import type { Task, TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"
import { SUPERVISORS } from "@/lib/projects/constants"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/tasks/constants"
import { generateTaskCode } from "@/lib/tasks/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
    status: TaskStatus
    priority: TaskPriority
    supervisor: string
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
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crew: string
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
    status: "pendiente",
    priority: "media",
    supervisor: project.supervisor,
    crew: "",
    startDate: today,
    dueDate: project.endDate || today,
    estimatedDuration: "",
  }
}

function buildEditForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    supervisor: task.supervisor,
    crew: task.crew,
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
  const [form, setForm] = useState<TaskFormState>(() => buildCreateForm(project))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)
    setForm(
      mode === "edit" && task
        ? buildEditForm(task)
        : {
            ...buildCreateForm(project),
            crew: crews[0]?.name ?? "",
          }
    )
  }, [open, mode, project, task, crews])

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

    setIsSubmitting(true)

    try {
      const code =
        mode === "edit" && task
          ? task.code
          : generateTaskCode(project.code, existingTasks)

      await onSubmit({
        code,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        status: form.status,
        priority: form.priority,
        supervisor: form.supervisor,
        crew: form.crew,
        startDate: form.startDate,
        dueDate: form.dueDate,
        estimatedDuration: form.estimatedDuration.trim(),
      })

      onOpenChange(false)
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
    form.supervisor !== "" &&
    form.crew !== "" &&
    form.startDate !== "" &&
    form.dueDate !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  updateField("status", value as TaskStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((option) => (
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supervisor</Label>
              <Select
                value={form.supervisor}
                onValueChange={(value) => updateField("supervisor", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPERVISORS.map((supervisor) => (
                    <SelectItem key={supervisor} value={supervisor}>
                      {supervisor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cuadrilla</Label>
              <Select
                value={form.crew}
                onValueChange={(value) => updateField("crew", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {crews.map((crew) => (
                    <SelectItem key={crew.id} value={crew.name}>
                      {crew.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  )
}

export { defaultChecklist }
