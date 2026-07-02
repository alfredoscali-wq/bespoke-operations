"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  buildExecutionOrderPersistPlan,
  type ExecutionOrderUpdate,
} from "@/lib/planificacion/planning-execution-order"
import {
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdateBatch,
  EMPTY_PLANNING_EDIT_FORM,
  resolveOperationalOrderProposalForCrew,
  resolvePlanningTaskAddress,
  validatePlanningEditForm,
  type PlanningEditFormState,
} from "@/lib/planificacion/planning-edit"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskServiceLabel,
} from "@/lib/planificacion/planning-utils"
import {
  WORK_ORDER_SHIFT_OPTIONS,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskEditPanelProps = {
  task: Task | null
  allTasks: Task[]
  open: boolean
  onClose: () => void
  onSaved?: (task: Task) => void
  className?: string
}

export function PlanningTaskEditPanel({
  task,
  allTasks,
  open,
  onClose,
  onSaved,
  className,
}: PlanningTaskEditPanelProps) {
  const { editTask } = useTasks()
  const { crews } = useCrews()
  const [form, setForm] = useState<PlanningEditFormState>(() =>
    task
      ? buildPlanningEditFormFromTask(task, allTasks, crews)
      : EMPTY_PLANNING_EDIT_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const resolvedTaskCrewId = useMemo(
    () => (task ? resolveTaskCrewId(task, crews) : undefined),
    [task, crews]
  )

  useEffect(() => {
    if (task && open) {
      setForm(buildPlanningEditFormFromTask(task, allTasks, crews))
      setError(null)
    }
  }, [task, open, crews, allTasks])

  const selectableCrews = useMemo(
    () =>
      getCrewsForTaskSelection(
        crews,
        form.crewId || resolvedTaskCrewId || null
      ),
    [crews, form.crewId, resolvedTaskCrewId]
  )

  async function applyExecutionOrderUpdates(updates: ExecutionOrderUpdate[]) {
    const plan = buildExecutionOrderPersistPlan(updates, allTasks)

    for (const phase of plan.phases) {
      for (const update of phase) {
        const result = await editTask(update.taskId, {
          executionOrder: update.executionOrder,
        })

        if (!result.success) {
          throw new Error(
            result.message ?? "No se pudo actualizar el orden de ejecución."
          )
        }
      }
    }
  }

  function updateField<K extends keyof PlanningEditFormState>(
    key: K,
    value: PlanningEditFormState[K]
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === "crewId" && task && typeof value === "string") {
        next.operationalOrder = resolveOperationalOrderProposalForCrew({
          task,
          crewId: value,
          dueDate: task.dueDate,
          allTasks,
          crews,
        })
      }

      return next
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!task) {
      return
    }

    const validation = validatePlanningEditForm(form)
    if (!validation.valid) {
      setError(validation.message ?? "Complete los campos obligatorios.")
      return
    }

    const selectedCrew = form.crewId
      ? crews.find((crew) => crew.id === form.crewId)
      : undefined

    if (form.crewId) {
      const crewValidation = validateCrewAssignment(selectedCrew)
      if (!crewValidation.allowed) {
        setError(crewValidation.message ?? "Cuadrilla no disponible.")
        return
      }
    }

    setIsSaving(true)
    setError(null)

    try {
      const batch = buildPlanningTaskUpdateBatch({
        task,
        form,
        crew: selectedCrew ?? null,
        allTasks,
        crews,
      })

      const result = await editTask(batch.primaryTaskId, batch.primaryPayload)
      if (!result.success || !result.task) {
        throw new Error(
          result.message ?? "No se pudo actualizar la orden de trabajo."
        )
      }

      if (batch.relatedUpdates.length > 0) {
        await applyExecutionOrderUpdates(batch.relatedUpdates)
      }

      onSaved?.(result.task)
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar los cambios."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !task) {
    return null
  }

  return (
    <section
      className={cn(
        "flex h-full min-h-[420px] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm xl:w-96",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Organizar despacho</h2>
          <p className="text-xs text-muted-foreground">
            Asigne cuadrilla y jornada. Los datos de la OT se editan en Órdenes de Trabajo.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onClose}
          aria-label="Cerrar organización"
        >
          <X className="size-4" />
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <section className="space-y-3 rounded-lg border bg-muted/15 p-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Datos de la OT (solo lectura)
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium text-foreground">
                  {resolvePlanningTaskClientLabel(task)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dirección</dt>
                <dd className="font-medium text-foreground">
                  {resolvePlanningTaskAddress(task)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo de OT</dt>
                <dd className="font-medium text-foreground">
                  {resolvePlanningTaskServiceLabel(task)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duración estimada</dt>
                <dd className="font-medium text-foreground">
                  {task.estimatedDuration || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Ajustes de planificación
            </h3>

            <div className="space-y-2">
              <Label htmlFor="planning-edit-crew">Cuadrilla</Label>
              <Select
                value={form.crewId || undefined}
                onValueChange={(value) => updateField("crewId", value)}
              >
                <SelectTrigger id="planning-edit-crew">
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

            <div className="space-y-2">
              <Label htmlFor="planning-edit-operational-order">
                Orden operativo
              </Label>
              <Input
                id="planning-edit-operational-order"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={form.operationalOrder}
                onChange={(event) =>
                  updateField("operationalOrder", event.target.value)
                }
                placeholder="Siguiente disponible"
              />
              <p className="text-xs text-muted-foreground">
                Propuesta automática según la cuadrilla. Puede ajustarla antes de
                guardar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planning-edit-shift">Turno</Label>
              <Select
                value={form.shift || undefined}
                onValueChange={(value) =>
                  updateField("shift", value as WorkOrderShift)
                }
              >
                <SelectTrigger id="planning-edit-shift">
                  <SelectValue placeholder="Seleccionar turno" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_SHIFT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar despacho"}
          </Button>
        </div>
      </form>
    </section>
  )
}
