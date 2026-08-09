"use client"

import { useEffect, useMemo, useState } from "react"

import {
  type ProjectTaskIncidentResolveDecision,
  type ProjectTaskIncidentResolveInput,
  validateProjectTaskIncidentResolveInput,
} from "@/lib/projects/project-task-incident-resolve"
import { resolvePlanningRangeStartDate } from "@/lib/planificacion/planning-date-range"
import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import { readMaterialsNeededFromTask } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
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

type PlanningObraIncidentResolveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  isSubmitting?: boolean
  onConfirm: (input: ProjectTaskIncidentResolveInput) => Promise<void>
}

export function PlanningObraIncidentResolveDialog({
  open,
  onOpenChange,
  task,
  isSubmitting = false,
  onConfirm,
}: PlanningObraIncidentResolveDialogProps) {
  const defaults = useMemo(() => {
    if (!task) {
      return {
        observationsForCrew: "",
        materialsNeeded: "",
        startDate: "",
        dueDate: "",
      }
    }
    return {
      observationsForCrew: task.observationsForCrew?.trim() || "",
      materialsNeeded: readMaterialsNeededFromTask(task),
      startDate: resolvePlanningRangeStartDate(task),
      dueDate: task.dueDate,
    }
  }, [task])

  const [decision, setDecision] =
    useState<ProjectTaskIncidentResolveDecision>("return-to-programmed")
  const [observationsForCrew, setObservationsForCrew] = useState("")
  const [materialsNeeded, setMaterialsNeeded] = useState("")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !task) {
      return
    }
    setDecision("return-to-programmed")
    setObservationsForCrew(defaults.observationsForCrew)
    setMaterialsNeeded(defaults.materialsNeeded)
    setStartDate(defaults.startDate)
    setDueDate(defaults.dueDate)
    setError(null)
  }, [open, task, defaults])

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!task) return

    const input: ProjectTaskIncidentResolveInput = {
      decision,
      observationsForCrew,
      materialsNeeded,
      startDate,
      dueDate,
    }
    const validation = validateProjectTaskIncidentResolveInput(input)
    if (!validation.ok) {
      setError(validation.message)
      return
    }

    setError(null)
    try {
      await onConfirm(input)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo resolver la incidencia de Obra."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolver incidencia de Obra</DialogTitle>
          <DialogDescription>
            Ajuste operativo de la OT de Obra. No usa replanificación de ruta.
            {task ? (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {task.code}
                </span>
                {" — "}
                {resolveIncidentReasonLabel(task.incidentReason)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Decisión</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="obra-incident-decision"
                className="mt-1"
                checked={decision === "return-to-programmed"}
                disabled={isSubmitting}
                onChange={() => setDecision("return-to-programmed")}
              />
              <span>
                Devolver a <strong>programada</strong>
                <span className="block text-xs text-muted-foreground">
                  La OT vuelve a Obras activas / Field Agent sin orden de ruta.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="obra-incident-decision"
                className="mt-1"
                checked={decision === "keep-incident"}
                disabled={isSubmitting}
                onChange={() => setDecision("keep-incident")}
              />
              <span>
                Mantener <strong>incidencia</strong>
                <span className="block text-xs text-muted-foreground">
                  Guarda observaciones, materiales o extensión de fechas sin
                  cambiar el estado.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="obra-incident-start">Fecha inicio</Label>
              <Input
                id="obra-incident-start"
                type="date"
                value={startDate}
                disabled={isSubmitting}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-incident-due">Fecha fin</Label>
              <Input
                id="obra-incident-due"
                type="date"
                value={dueDate}
                disabled={isSubmitting}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obra-incident-materials">Materiales</Label>
            <Textarea
              id="obra-incident-materials"
              rows={2}
              value={materialsNeeded}
              disabled={isSubmitting}
              onChange={(event) => setMaterialsNeeded(event.target.value)}
              placeholder="Materiales necesarios para continuar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obra-incident-obs">Observaciones</Label>
            <Textarea
              id="obra-incident-obs"
              rows={3}
              value={observationsForCrew}
              disabled={isSubmitting}
              onChange={(event) => setObservationsForCrew(event.target.value)}
              placeholder="Observaciones para la cuadrilla"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !task}
            onClick={() => void handleConfirm()}
          >
            {isSubmitting ? "Guardando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
