"use client"

import { useEffect, useMemo, useState } from "react"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import {
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdateBatch,
  EMPTY_PLANNING_EDIT_FORM,
  validatePlanningAdjustForm,
  type PlanningEditFormState,
} from "@/lib/planificacion/planning-edit"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  WORK_ORDER_DURATION_PRESET_OPTIONS,
  WORK_ORDER_SHIFT_OPTIONS,
  type WorkOrderDurationPreset,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

type PlanningTaskAdjustSheetProps = {
  task: Task | null
  allTasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (task: Task) => void
}

export function PlanningTaskAdjustSheet({
  task,
  allTasks,
  open,
  onOpenChange,
  onSaved,
}: PlanningTaskAdjustSheetProps) {
  const { editTask, applyExecutionOrderUpdates } = useTasks()
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

    const validation = validatePlanningAdjustForm(form)
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
        const orderResult = await applyExecutionOrderUpdates(batch.relatedUpdates)
        if (!orderResult.success) {
          throw new Error(
            orderResult.message ?? "No se pudo actualizar el orden operativo."
          )
        }
      }

      onSaved?.(result.task)
      onOpenChange(false)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajustes de planificación</SheetTitle>
          <SheetDescription>
            {task
              ? `${task.code} · Ajuste de cuadrilla, turno y duración estimada.`
              : "Seleccione una OT del listado."}
          </SheetDescription>
        </SheetHeader>

        {task ? (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          >
            <div className="space-y-2">
              <Label htmlFor="planning-adjust-crew">Cuadrilla</Label>
              <Select
                value={form.crewId || undefined}
                onValueChange={(value) => updateField("crewId", value)}
              >
                <SelectTrigger id="planning-adjust-crew">
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
              <Label htmlFor="planning-adjust-shift">Turno</Label>
              <Select
                value={form.shift || undefined}
                onValueChange={(value) =>
                  updateField("shift", value as WorkOrderShift)
                }
              >
                <SelectTrigger id="planning-adjust-shift">
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
              <Label htmlFor="planning-adjust-duration">Duración estimada</Label>
              <Select
                value={form.estimatedDurationPreset || undefined}
                onValueChange={(value) =>
                  updateField(
                    "estimatedDurationPreset",
                    value as WorkOrderDurationPreset
                  )
                }
              >
                <SelectTrigger id="planning-adjust-duration">
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
            </div>

            {form.estimatedDurationPreset === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="planning-adjust-duration-custom">
                  Minutos personalizados
                </Label>
                <Input
                  id="planning-adjust-duration-custom"
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
                />
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar ajustes"}
              </Button>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
