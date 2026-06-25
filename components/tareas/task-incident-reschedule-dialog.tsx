"use client"

import { useState } from "react"

import { toDateOnly } from "@/lib/availability/utils"
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

type TaskIncidentRescheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDueDate: string
  onConfirm: (dueDate: string) => Promise<void>
  isSubmitting?: boolean
}

export function TaskIncidentRescheduleDialog({
  open,
  onOpenChange,
  currentDueDate,
  onConfirm,
  isSubmitting = false,
}: TaskIncidentRescheduleDialogProps) {
  const [dueDate, setDueDate] = useState(currentDueDate)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDueDate(currentDueDate)
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!dueDate.trim()) {
      setError("Seleccione una nueva fecha.")
      return
    }

    setError(null)
    await onConfirm(dueDate)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogramar OT</DialogTitle>
          <DialogDescription>
            La OT volverá a Programada con la nueva fecha seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="incident-reschedule-date">Nueva fecha *</Label>
          <Input
            id="incident-reschedule-date"
            type="date"
            value={dueDate}
            min={toDateOnly()}
            onChange={(event) => setDueDate(event.target.value)}
          />
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
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Volver
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            Reprogramar OT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
