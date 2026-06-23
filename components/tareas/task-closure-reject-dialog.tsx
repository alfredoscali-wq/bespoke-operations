"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type TaskClosureRejectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void>
  isSubmitting?: boolean
}

export function TaskClosureRejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: TaskClosureRejectDialogProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Indique el motivo de rechazo.")
      return
    }

    setError(null)
    await onConfirm(trimmed)
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar cierre</DialogTitle>
          <DialogDescription>
            La tarea volverá a En Curso para que la cuadrilla corrija lo
            necesario.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="closure-reject-reason">Motivo de rechazo</Label>
          <Textarea
            id="closure-reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Indique qué debe corregir la cuadrilla"
            rows={4}
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
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            ✖ Rechazar cierre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
