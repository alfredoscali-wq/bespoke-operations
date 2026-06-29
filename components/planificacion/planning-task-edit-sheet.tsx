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
  buildPlanningTaskUpdatePayload,
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

type PlanningTaskEditSheetProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (task: Task) => void
}

export function PlanningTaskEditSheet({
  task,
  open,
  onOpenChange,
  onSaved,
}: PlanningTaskEditSheetProps) {
  const { editTask } = useTasks()
  const { crews } = useCrews()
  const [form, setForm] = useState<PlanningEditFormState>({
    crewId: "",
    shift: "",
    estimatedDurationPreset: "",
    estimatedDurationCustomMinutes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (task && open) {
      setForm(buildPlanningEditFormFromTask(task))
      setError(null)
    }
  }, [task, open])

  const selectableCrews = useMemo(
    () => getCrewsForTaskSelection(crews, form.crewId || task?.crewId || null),
    [crews, form.crewId, task?.crewId]
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
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edición rápida</SheetTitle>
          <SheetDescription>
            Ajuste cuadrilla, turno y duración sin salir de la planificación.
          </SheetDescription>
        </SheetHeader>

        {task ? (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4"
          >
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

            <SheetFooter className="px-0 pb-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
