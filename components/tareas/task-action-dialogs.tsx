"use client"

import { useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import type { Task, TaskPriority, TaskType } from "@/lib/types/tasks"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/tasks/constants"
import { getWorkflowActionForTargetStatus } from "@/lib/tasks/task-status-workflow"
import { resolveTaskSupervisorForCrewChange } from "@/lib/tasks/utils"
import {
  isSameTaskCrewAssignment,
  resolveCrewSnapshotsForAssignment,
  resolveTaskCrewId,
} from "@/lib/tasks/crew-relation"
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

type TaskEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  onSubmit: (payload: {
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

function buildEditForm(
  task: Task,
  crews: { id: string; name: string }[]
): TaskFormState {
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

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: TaskEditDialogProps) {
  const { crews } = useCrews()
  const selectableCrews = useMemo(
    () => getCrewsForTaskSelection(crews, task.crewId),
    [crews, task.crewId]
  )
  const [form, setForm] = useState<TaskFormState>(() =>
    buildEditForm(task, crews)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(buildEditForm(task, crews))
      setError(null)
    }
  }, [open, task, crews])

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

    const selectedCrew = selectableCrews.find((crew) => crew.id === form.crewId)
    const crewValidation = validateCrewAssignment(selectedCrew)
    if (!crewValidation.allowed) {
      setError(crewValidation.message ?? "Cuadrilla no válida.")
      return
    }

    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
    const supervisor = resolveTaskSupervisorForCrewChange(
      form.crewId,
      crews,
      task.crewId,
      task.supervisor
    )

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        priority: form.priority,
        supervisor,
        crewId: snapshots.crewId ?? form.crewId,
        crew: snapshots.crew || selectedCrew?.name || task.crew,
        startDate: form.startDate,
        dueDate: form.dueDate,
        estimatedDuration: form.estimatedDuration.trim(),
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la tarea."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
          <DialogDescription>
            {task.code} · Actualice los datos operativos de la tarea.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-edit-title">Título</Label>
            <Input
              id="task-edit-title"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-edit-description">Descripción</Label>
            <Textarea
              id="task-edit-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) => updateField("type", value as TaskType)}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  updateField("priority", value as TaskPriority)
                }
              >
                <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Cuadrilla</Label>
            <Select
              value={form.crewId || undefined}
              onValueChange={(value) => updateField("crewId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuadrilla" />
              </SelectTrigger>
              <SelectContent>
                {selectableCrews.map((crew) => (
                  <SelectItem key={crew.id} value={crew.id}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-edit-start">Inicio</Label>
              <Input
                id="task-edit-start"
                type="date"
                value={form.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-edit-due">Fecha límite</Label>
              <Input
                id="task-edit-due"
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField("dueDate", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-edit-duration">Duración estimada</Label>
            <Input
              id="task-edit-duration"
              value={form.estimatedDuration}
              onChange={(event) =>
                updateField("estimatedDuration", event.target.value)
              }
            />
          </div>

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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TaskStatusDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  onSubmit: (status: Task["status"]) => Promise<void>
}) {
  const [status, setStatus] = useState<Task["status"]>(task.status)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allowedStatusOptions = useMemo(
    () =>
      TASK_STATUS_OPTIONS.filter((option) => {
        if (option.value === task.status) {
          return false
        }

        const action = getWorkflowActionForTargetStatus(task.status, option.value)
        return action !== null && action !== "assign-crew"
      }),
    [task]
  )

  useEffect(() => {
    if (open) {
      setStatus(task.status)
      setError(null)
    }
  }, [open, task.status])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit(status)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo cambiar el estado."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            {task.code} · {task.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Estado operativo</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Task["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedStatusOptions.length === 0 ? (
                  <SelectItem value={task.status} disabled>
                    Sin transiciones disponibles
                  </SelectItem>
                ) : (
                  allowedStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
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
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                status === task.status ||
                allowedStatusOptions.length === 0
              }
            >
              {isSubmitting ? "Guardando..." : "Actualizar estado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TaskCrewAssignDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  onSubmit: (crewId: string) => Promise<void>
}) {
  const { crews } = useCrews()
  const selectableCrews = useMemo(
    () => getCrewsForTaskSelection(crews, task.crewId),
    [crews, task.crewId]
  )
  const currentCrewId = resolveTaskCrewId(task, crews) ?? ""
  const [crewId, setCrewId] = useState(currentCrewId)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setCrewId(currentCrewId)
      setError(null)
    }
  }, [open, currentCrewId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!crewId) {
      setError("Seleccione una cuadrilla.")
      return
    }

    if (isSameTaskCrewAssignment(task, crewId)) {
      setError("La tarea ya está asignada a esta cuadrilla.")
      return
    }

    const selectedCrew = selectableCrews.find((crew) => crew.id === crewId)
    const crewValidation = validateCrewAssignment(selectedCrew)
    if (!crewValidation.allowed) {
      setError(crewValidation.message ?? "Cuadrilla no válida.")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(crewId)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo reasignar la cuadrilla."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reasignar cuadrilla</DialogTitle>
          <DialogDescription>
            {task.code} · {task.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cuadrilla</Label>
            <Select value={crewId || undefined} onValueChange={setCrewId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuadrilla" />
              </SelectTrigger>
              <SelectContent>
                {selectableCrews.map((crew) => (
                  <SelectItem key={crew.id} value={crew.id}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Reasignar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
