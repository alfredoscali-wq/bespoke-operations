"use client"

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
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
import { Textarea } from "@/components/ui/textarea"

type TaskReprogramFromVencidaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  onSuccess?: () => void
}

export function TaskReprogramFromVencidaDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: TaskReprogramFromVencidaDialogProps) {
  const { sessionUser } = useAuth()
  const { rescheduleTaskFromOverdue } = useTasks()
  const [motivo, setMotivo] = useState("")
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaults = useMemo(() => {
    if (!task) {
      return { dueDate: "", scheduledTime: getDefaultScheduledTime() }
    }
    return {
      dueDate: task.dueDate?.trim() || "",
      scheduledTime:
        formatScheduledTimeForInput(task.scheduledTime) ||
        getDefaultScheduledTime(),
    }
  }, [task])

  useEffect(() => {
    if (!open) return
    setMotivo("")
    setNuevaFecha("")
    setError(null)
    setIsSubmitting(false)
  }, [open, task?.id])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!task) return

    const trimmedMotivo = motivo.trim()
    const trimmedFecha = nuevaFecha.trim()
    if (!trimmedMotivo) {
      setError("Indicá el motivo de reprogramación.")
      return
    }
    if (!trimmedFecha) {
      setError("Seleccioná la nueva fecha.")
      return
    }

    const rescheduledBy =
      sessionUser?.displayName?.trim() ||
      sessionUser?.email?.trim() ||
      "Usuario"

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await rescheduleTaskFromOverdue(task.id, {
        dueDate: trimmedFecha,
        scheduledTime: defaults.scheduledTime,
        reason: trimmedMotivo,
        notes: trimmedMotivo,
        rescheduledBy,
      })

      if (!result.success) {
        setError(result.message ?? "No se pudo reprogramar la OT.")
        return
      }

      onOpenChange(false)
      onSuccess?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reprogramar OT vencida</DialogTitle>
            <DialogDescription>
              La OT volverá a Programada con la nueva fecha. Quedará registro
              en el historial operativo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ot-vencida-motivo">Motivo de reprogramación</Label>
              <Textarea
                id="ot-vencida-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                rows={3}
                placeholder="¿Por qué se reprograma esta OT vencida?"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ot-vencida-nueva-fecha">Nueva fecha</Label>
              <Input
                id="ot-vencida-nueva-fecha"
                type="date"
                value={nuevaFecha}
                onChange={(event) => setNuevaFecha(event.target.value)}
                disabled={isSubmitting}
              />
              {defaults.dueDate ? (
                <p className="text-xs text-muted-foreground">
                  Fecha original: {defaults.dueDate}
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !task}>
              {isSubmitting ? "Reprogramando…" : "Reprogramar OT"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
