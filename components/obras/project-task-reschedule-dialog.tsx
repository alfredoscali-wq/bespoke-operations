"use client"

import { useEffect, useMemo, useState } from "react"

import { toDateOnly } from "@/lib/availability/utils"
import { formatTaskDate } from "@/lib/tasks/constants"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  getTaskRescheduleFormDefaults,
  resolveRescheduleReasonLabel,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import {
  defaultRescheduleMotivoOptions,
  motivoOptionsFromCatalog,
} from "@/lib/tasks/operational-motivos"
import { listOperationalMotivos } from "@/lib/supabase/operational-control.browser"
import {
  formatScheduledTimeForInput,
  getDefaultScheduledTime,
} from "@/lib/tasks/scheduling"
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

type Step = "form" | "confirm"

type ProjectTaskRescheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  rescheduledBy: string
  onConfirm: (input: TaskRescheduleInput) => Promise<void>
  isSubmitting?: boolean
}

export function ProjectTaskRescheduleDialog({
  open,
  onOpenChange,
  task,
  rescheduledBy,
  onConfirm,
  isSubmitting = false,
}: ProjectTaskRescheduleDialogProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const defaults = useMemo(() => getTaskRescheduleFormDefaults(task), [task])
  const currentTimeLabel =
    formatScheduledTimeForInput(task.scheduledTime) || "—"

  const [step, setStep] = useState<Step>("form")
  const [dueDate, setDueDate] = useState(defaults.dueDate)
  const [scheduledTime, setScheduledTime] = useState(defaults.scheduledTime)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [motivoOptions, setMotivoOptions] = useState(
    defaultRescheduleMotivoOptions()
  )

  useEffect(() => {
    if (!open || !isAuthReady || !companyId) {
      return
    }

    let cancelled = false

    async function loadMotivos() {
      const result = await listOperationalMotivos(
        companyId,
        "reprogramacion",
        true
      )
      if (cancelled) return
      setMotivoOptions(
        motivoOptionsFromCatalog(
          result.data ?? [],
          defaultRescheduleMotivoOptions()
        )
      )
    }

    void loadMotivos()
    return () => {
      cancelled = true
    }
  }, [open, companyId, isAuthReady])

  useEffect(() => {
    if (!open) return

    setStep("form")
    setDueDate(defaults.dueDate)
    setScheduledTime(defaults.scheduledTime)
    setReason("")
    setNotes("")
    setError(null)
  }, [open, defaults])

  function handleContinueToConfirm() {
    const validation = validateTaskRescheduleInput({
      dueDate,
      scheduledTime,
      reason,
    })
    if (!validation.allowed) {
      setError(validation.message ?? "Revise los datos de reprogramación.")
      return
    }

    setError(null)
    setStep("confirm")
  }

  async function handleConfirm() {
    const validation = validateTaskRescheduleInput({
      dueDate,
      scheduledTime,
      reason,
    })
    if (!validation.allowed) {
      setError(validation.message ?? "Revise los datos de reprogramación.")
      setStep("form")
      return
    }

    setError(null)
    await onConfirm({
      dueDate,
      scheduledTime,
      reason,
      notes,
      rescheduledBy,
    })
  }

  const newTimeLabel =
    formatScheduledTimeForInput(scheduledTime) ||
    scheduledTime.trim() ||
    getDefaultScheduledTime()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reprogramar OT</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Indique la nueva fecha, hora y el motivo. La cuadrilla y el resto de datos no se modifican."
              : "Confirme la reprogramación antes de guardar."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Programación actual
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatTaskDate(task.dueDate)} · {currentTimeLabel}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="obra-task-reschedule-date">Nueva fecha *</Label>
                <Input
                  id="obra-task-reschedule-date"
                  type="date"
                  value={dueDate}
                  min={toDateOnly()}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obra-task-reschedule-time">Nueva hora *</Label>
                <Input
                  id="obra-task-reschedule-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obra-task-reschedule-reason">Motivo *</Label>
              <Select value={reason || undefined} onValueChange={setReason}>
                <SelectTrigger id="obra-task-reschedule-reason">
                  <SelectValue placeholder="Seleccione un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obra-task-reschedule-notes">Observación</Label>
              <Textarea
                id="obra-task-reschedule-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Detalle adicional (opcional)"
                rows={3}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Fecha anterior</span>
              <span className="font-medium text-foreground">
                {formatTaskDate(task.dueDate)} · {currentTimeLabel}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Nueva fecha</span>
              <span className="font-medium text-foreground">
                {formatTaskDate(dueDate)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Nueva hora</span>
              <span className="font-medium text-foreground">{newTimeLabel}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Motivo</span>
              <span className="max-w-[60%] text-right font-medium text-foreground">
                {resolveRescheduleReasonLabel(reason)}
              </span>
            </div>
            {notes.trim() ? (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">Observación</p>
                <p className="mt-0.5 text-foreground">{notes.trim()}</p>
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "form" ? (
            <>
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
                onClick={handleContinueToConfirm}
                disabled={isSubmitting}
              >
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Reprogramando..." : "Confirmar reprogramación"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
