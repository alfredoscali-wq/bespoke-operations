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
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdatePayload,
  EMPTY_PLANNING_EDIT_FORM,
  resolvePlanningEditEstimatedDuration,
  resolvePlanningTaskAddress,
  validatePlanningEditForm,
  type PlanningEditFormState,
} from "@/lib/planificacion/planning-edit"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskServiceLabel,
} from "@/lib/planificacion/planning-utils"
import {
  WORK_ORDER_DURATION_PRESET_OPTIONS,
  WORK_ORDER_SHIFT_OPTIONS,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskEditPanelProps = {
  task: Task | null
  open: boolean
  onClose: () => void
  onSaved?: (task: Task) => void
  className?: string
}

export function PlanningTaskEditPanel({
  task,
  open,
  onClose,
  onSaved,
  className,
}: PlanningTaskEditPanelProps) {
  const { editTask } = useTasks()
  const { crews } = useCrews()
  const [form, setForm] = useState<PlanningEditFormState>(() =>
    task ? buildPlanningEditFormFromTask(task, crews) : EMPTY_PLANNING_EDIT_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const resolvedTaskCrewId = useMemo(
    () => (task ? resolveTaskCrewId(task, crews) : undefined),
    [task, crews]
  )

  useEffect(() => {
    if (task && open) {
      setForm(buildPlanningEditFormFromTask(task, crews))
      setError(null)
    }
  }, [task, open, crews])

  const selectableCrews = useMemo(
    () =>
      getCrewsForTaskSelection(
        crews,
        form.crewId || resolvedTaskCrewId || null
      ),
    [crews, form.crewId, resolvedTaskCrewId]
  )

  function updateField<K extends keyof PlanningEditFormState>(
    key: K,
    value: PlanningEditFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
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
      const payload = buildPlanningTaskUpdatePayload({
        task,
        form,
        crew: selectedCrew ?? null,
      })

      const result = await editTask(task.id, payload)
      if (!result.success || !result.task) {
        throw new Error(
          result.message ?? "No se pudo actualizar la orden de trabajo."
        )
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
          <h2 className="text-sm font-semibold text-foreground">Edición rápida</h2>
          <p className="text-xs text-muted-foreground">
            Ajuste cuadrilla, turno y duración sin salir de la planificación.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onClose}
          aria-label="Cerrar edición"
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
              Información de la OT
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
            </dl>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Ajustes operativos
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

            <div className="space-y-2">
              <Label htmlFor="planning-edit-duration">Duración estimada</Label>
              <Select
                value={form.estimatedDurationPreset || undefined}
                onValueChange={(value) =>
                  updateField(
                    "estimatedDurationPreset",
                    value as PlanningEditFormState["estimatedDurationPreset"]
                  )
                }
              >
                <SelectTrigger id="planning-edit-duration">
                  <SelectValue placeholder="Seleccionar duración" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_DURATION_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.estimatedDurationPreset === "other" ? (
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.estimatedDurationCustomMinutes}
                  onChange={(event) =>
                    updateField(
                      "estimatedDurationCustomMinutes",
                      event.target.value
                    )
                  }
                  placeholder="Minutos"
                />
              ) : null}
              {form.estimatedDurationPreset ? (
                <p className="text-xs text-muted-foreground">
                  Total: {resolvePlanningEditEstimatedDuration(form) || "—"}
                </p>
              ) : null}
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
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </section>
  )
}
