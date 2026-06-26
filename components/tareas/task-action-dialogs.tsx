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
import {
  isNewInstallationTask,
  parseAmountToCollectInput,
  resolveContractedPlanFromForm,
} from "@/lib/tasks/commercial-plan"
import {
  buildAmountToCollectFormFromTask,
  buildCommercialFormFromTask,
  buildLocationFormFromTask,
  buildScheduleFormFromTask,
  isWorkOrderTask,
  type WorkOrderFormInput,
} from "@/lib/tasks/work-order"
import {
  normalizeScheduledTimeForDb,
} from "@/lib/tasks/scheduling"
import { WorkOrderCommercialFields } from "@/components/tareas/work-order-commercial-fields"
import { WorkOrderAmountToCollectField } from "@/components/tareas/work-order-amount-to-collect-field"
import { WorkOrderLocationSection } from "@/components/tareas/work-order-location-section"
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
    scheduledTime?: string | null
    estimatedDuration: string
    amountToCollect?: number | null
    contractedPlan?: string | null
    sharedLocation?: string | null
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
  scheduledDate: string
  scheduledTime: string
  estimatedDuration: string
  amountToCollect: string
  sharedLocation: string
  commercial: Pick<
    WorkOrderFormInput,
    "serviceType" | "technology" | "contractedPlan"
  >
}

function buildEditForm(
  task: Task,
  crews: { id: string; name: string }[]
): TaskFormState {
  const schedule = buildScheduleFormFromTask(task)

  return {
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    crewId: resolveTaskCrewId(task, crews) ?? "",
    startDate: task.startDate,
    dueDate: task.dueDate,
    scheduledDate: schedule.scheduledDate,
    scheduledTime: schedule.scheduledTime,
    estimatedDuration: task.estimatedDuration,
    amountToCollect: buildAmountToCollectFormFromTask(task),
    ...buildLocationFormFromTask(task),
    commercial: buildCommercialFormFromTask(task),
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
  const [baselineForm, setBaselineForm] = useState<TaskFormState>(() =>
    buildEditForm(task, crews)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  useEffect(() => {
    if (open) {
      const nextForm = buildEditForm(task, crews)
      setForm(nextForm)
      setBaselineForm(nextForm)
      setError(null)
    }
  }, [open, task, crews])

  function updateField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateCommercialField<
    K extends keyof TaskFormState["commercial"],
  >(key: K, value: TaskFormState["commercial"][K]) {
    setForm((current) => ({
      ...current,
      commercial: { ...current.commercial, [key]: value },
    }))
  }

  const showCommercialFields =
    isWorkOrderTask(task) && isNewInstallationTask(task)
  const showAmountToCollectField = isWorkOrderTask(task)
  const showWorkOrderSchedule = isWorkOrderTask(task)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }

    if (showWorkOrderSchedule && !form.scheduledDate) {
      setError("La fecha programada es obligatoria.")
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
      const workOrderPayload = showAmountToCollectField
        ? {
            amountToCollect: parseAmountToCollectInput(form.amountToCollect),
            sharedLocation: form.sharedLocation.trim() || null,
            ...(showCommercialFields
              ? {
                  contractedPlan: resolveContractedPlanFromForm(form.commercial),
                }
              : {}),
          }
        : {}

      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        priority: form.priority,
        supervisor,
        crewId: snapshots.crewId ?? form.crewId,
        crew: snapshots.crew || selectedCrew?.name || task.crew,
        startDate: showWorkOrderSchedule ? form.scheduledDate : form.startDate,
        dueDate: showWorkOrderSchedule ? form.scheduledDate : form.dueDate,
        scheduledTime: showWorkOrderSchedule
          ? normalizeScheduledTimeForDb(form.scheduledTime)
          : undefined,
        estimatedDuration: form.estimatedDuration.trim(),
        ...workOrderPayload,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la orden de trabajo."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {isWorkOrderTask(task) ? "Editar Orden de Trabajo" : "Editar Orden de Trabajo"}
          </DialogTitle>
          <DialogDescription>
            {task.code} · Actualice los datos operativos de la orden de trabajo.
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

          {showWorkOrderSchedule ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-edit-scheduled-date">Fecha programada</Label>
                <Input
                  id="task-edit-scheduled-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) =>
                    updateField("scheduledDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-edit-scheduled-time">Hora programada</Label>
                <Input
                  id="task-edit-scheduled-time"
                  type="time"
                  value={form.scheduledTime}
                  onChange={(event) =>
                    updateField("scheduledTime", event.target.value)
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-edit-start">Inicio</Label>
                <Input
                  id="task-edit-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    updateField("startDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-edit-due">Fecha límite</Label>
                <Input
                  id="task-edit-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    updateField("dueDate", event.target.value)
                  }
                />
              </div>
            </div>
          )}

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

          {showAmountToCollectField ? (
            <WorkOrderAmountToCollectField
              id="task-edit-amount-to-collect"
              value={form.amountToCollect}
              onChange={(value) => updateField("amountToCollect", value)}
            />
          ) : null}

          {showAmountToCollectField ? (
            <WorkOrderLocationSection
              sharedLocation={form.sharedLocation}
              onSharedLocationChange={(value) =>
                updateField("sharedLocation", value)
              }
            />
          ) : null}

          {showCommercialFields ? (
            <WorkOrderCommercialFields
              form={form.commercial}
              updateField={updateCommercialField}
            />
          ) : null}

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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
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
  const [baselineStatus, setBaselineStatus] = useState<Task["status"]>(task.status)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = status !== baselineStatus
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

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
      setBaselineStatus(task.status)
      setError(null)
    }
  }, [open, task.status])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit(status)
      forceClose()
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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
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
              onClick={requestClose}
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
  const [baselineCrewId, setBaselineCrewId] = useState(currentCrewId)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = crewId !== baselineCrewId
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  useEffect(() => {
    if (open) {
      setCrewId(currentCrewId)
      setBaselineCrewId(currentCrewId)
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
      setError("La orden de trabajo ya está asignada a esta cuadrilla.")
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
      forceClose()
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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
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
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Reasignar"}
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
