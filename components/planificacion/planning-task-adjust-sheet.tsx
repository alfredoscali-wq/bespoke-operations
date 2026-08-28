"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  TaskMaterialLinesEditor,
  useMaterialsContextLoader,
  type TaskMaterialLinesEditorHandle,
} from "@/components/materiales/task-material-lines-editor"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { formatCrewOptionLabel } from "@/lib/crews/origin"
import {
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdateBatch,
  EMPTY_PLANNING_EDIT_FORM,
  validatePlanningAdjustForm,
  type PlanningEditFormState,
} from "@/lib/planificacion/planning-edit"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  resolveServiceTechnicalWorkInfoFromTask,
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
  const materialLinesRef = useRef<TaskMaterialLinesEditorHandle>(null)
  const {
    catalog,
    inventory,
    warehouseContext,
    isLoading: isMaterialsContextLoading,
    error: materialsContextError,
  } = useMaterialsContextLoader()
  /** Seed form once per open+task; ignore remote refreshes while editing. */
  const seededTaskIdRef = useRef<string | null>(null)
  const latestSeedInputsRef = useRef({ task, allTasks, crews })
  latestSeedInputsRef.current = { task, allTasks, crews }

  const resolvedTaskCrewId = useMemo(
    () => (task ? resolveTaskCrewId(task, crews) : undefined),
    [task, crews]
  )

  const workInfo = useMemo(
    () => (task ? resolveServiceTechnicalWorkInfoFromTask(task) : null),
    [task]
  )

  useEffect(() => {
    if (!open) {
      seededTaskIdRef.current = null
      return
    }

    const currentTask = latestSeedInputsRef.current.task
    if (!currentTask) {
      return
    }

    // Same OT still open: keep local edits stable across polling/refetch.
    if (seededTaskIdRef.current === currentTask.id) {
      return
    }

    seededTaskIdRef.current = currentTask.id
    setForm(
      buildPlanningEditFormFromTask(
        currentTask,
        latestSeedInputsRef.current.allTasks,
        latestSeedInputsRef.current.crews
      )
    )
    setError(null)
  }, [open, task?.id])

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
      const lineValidation = materialLinesRef.current?.validate()
      if (lineValidation && !lineValidation.valid) {
        throw new Error(
          lineValidation.message ?? "Revise los materiales del catálogo."
        )
      }

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

      await materialLinesRef.current?.sync(task.id)

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
              ? `${task.code} · Ajuste de cuadrilla, fecha, turno y duración estimada.`
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
                      {formatCrewOptionLabel(crew)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planning-adjust-date">
                {task.projectId ? "Fecha fin" : "Fecha operativa"}
              </Label>
              {task.projectId ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="planning-adjust-start"
                      className="text-xs text-muted-foreground"
                    >
                      Inicio
                    </Label>
                    <Input
                      id="planning-adjust-start"
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        updateField("startDate", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="planning-adjust-date"
                      className="text-xs text-muted-foreground"
                    >
                      Fin
                    </Label>
                    <Input
                      id="planning-adjust-date"
                      type="date"
                      value={form.scheduledDate}
                      onChange={(event) =>
                        updateField("scheduledDate", event.target.value)
                      }
                    />
                  </div>
                </div>
              ) : (
                <Input
                  id="planning-adjust-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) => {
                    updateField("scheduledDate", event.target.value)
                    updateField("startDate", event.target.value)
                  }}
                />
              )}
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

            {workInfo ? (
              <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Información del Trabajo
                </h4>
                <div className="space-y-3">
                  {workInfo.reasonLabel ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Motivo</p>
                      <p className="text-sm font-medium text-foreground">
                        {workInfo.reasonLabel}
                      </p>
                    </div>
                  ) : null}
                  {workInfo.detail ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Detalle</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {workInfo.detail}
                      </p>
                    </div>
                  ) : null}
                  {!workInfo.reasonLabel && !workInfo.detail ? (
                    <p className="text-sm text-muted-foreground">
                      Sin información registrada.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <TaskMaterialLinesEditor
              ref={materialLinesRef}
              taskId={task.id}
              catalog={catalog}
              inventory={inventory}
              warehouseContext={warehouseContext}
              disabled={isSaving || isMaterialsContextLoading}
            />

            {materialsContextError ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {materialsContextError}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="planning-adjust-materials">
                Materiales Necesarios
              </Label>
              <Textarea
                id="planning-adjust-materials"
                value={form.materialsNeeded}
                onChange={(event) =>
                  updateField("materialsNeeded", event.target.value)
                }
                placeholder={
                  "Ej:\nCable UTP 30 metros\n2 conectores RJ45\nFuente 24V"
                }
                rows={5}
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                Texto libre para preparación de la cuadrilla. No se muestra en
                Field Agent. Utilizá este campo para materiales o indicaciones
                que todavía no estén en el catálogo.
              </p>
            </div>

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
