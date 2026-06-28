"use client"

import { useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { toDateOnly } from "@/lib/availability/utils"
import { getCrewsForTaskSelection } from "@/lib/crews/status-workflow"
import {
  getTaskRescheduleFormDefaults,
  TASK_RESCHEDULE_REASONS,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import { resolveCrewSnapshotsForAssignment } from "@/lib/tasks/crew-relation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const KEEP_CREW_VALUE = "__keep__"

type TaskRescheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  rescheduledBy: string
  description?: string
  onConfirm: (input: TaskRescheduleInput) => Promise<void>
  isSubmitting?: boolean
}

export function TaskRescheduleDialog({
  open,
  onOpenChange,
  task,
  rescheduledBy,
  description = "La orden de trabajo volverá a Programada con la nueva fecha y hora seleccionadas.",
  onConfirm,
  isSubmitting = false,
}: TaskRescheduleDialogProps) {
  const { crews, getCrew } = useCrews()
  const defaults = useMemo(() => getTaskRescheduleFormDefaults(task), [task])
  const crewOptions = useMemo(
    () => getCrewsForTaskSelection(crews, task.crewId),
    [crews, task.crewId]
  )

  const [dueDate, setDueDate] = useState(defaults.dueDate)
  const [scheduledTime, setScheduledTime] = useState(defaults.scheduledTime)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [crewSelection, setCrewSelection] = useState(
    defaults.crewId || KEEP_CREW_VALUE
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setDueDate(defaults.dueDate)
    setScheduledTime(defaults.scheduledTime)
    setReason("")
    setNotes("")
    setCrewSelection(defaults.crewId || KEEP_CREW_VALUE)
    setError(null)
  }, [open, defaults])

  async function handleConfirm() {
    const baseInput = {
      dueDate,
      scheduledTime,
      reason,
      notes,
      rescheduledBy,
    }

    const validation = validateTaskRescheduleInput(baseInput)
    if (!validation.allowed) {
      setError(validation.message ?? "Revise los datos de reprogramación.")
      return
    }

    let crewId: string | null | undefined
    let crew: string | undefined
    let supervisor: string | undefined

    if (crewSelection !== KEEP_CREW_VALUE) {
      const selectedCrew = getCrew(crewSelection)
      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
      crewId = snapshots.crewId ?? crewSelection
      crew = snapshots.crew
      supervisor = snapshots.supervisor
    }

    setError(null)

    await onConfirm({
      ...baseInput,
      ...(crewId !== undefined
        ? { crewId, crew, supervisor }
        : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reprogramar Orden de Trabajo</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-reschedule-date">Nueva fecha *</Label>
              <Input
                id="task-reschedule-date"
                type="date"
                value={dueDate}
                min={toDateOnly()}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-reschedule-time">Nueva hora *</Label>
              <Input
                id="task-reschedule-time"
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-reschedule-crew">Cuadrilla</Label>
            <Select value={crewSelection} onValueChange={setCrewSelection}>
              <SelectTrigger id="task-reschedule-crew">
                <SelectValue placeholder="Mantener cuadrilla actual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP_CREW_VALUE}>
                  Mantener cuadrilla actual
                </SelectItem>
                {crewOptions.map((crew) => (
                  <SelectItem key={crew.id} value={crew.id}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-reschedule-reason">Motivo *</Label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger id="task-reschedule-reason">
                <SelectValue placeholder="Seleccione un motivo" />
              </SelectTrigger>
              <SelectContent>
                {TASK_RESCHEDULE_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-reschedule-notes">Observación</Label>
            <Textarea
              id="task-reschedule-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalle adicional de la reprogramación"
              rows={3}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

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
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Reprogramando..." : "Reprogramar Orden de Trabajo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
