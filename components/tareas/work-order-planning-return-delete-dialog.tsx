"use client"

import { useEffect, useState } from "react"

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
import { WORK_ORDER_PLANNING_RETURN_DELETE_OBSERVATION_REQUIRED_MESSAGE } from "@/lib/tasks/work-order-deletion-policy"

type WorkOrderPlanningReturnDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskLabel: string
  onConfirm: (observation: string) => Promise<void>
  isSubmitting?: boolean
  error?: string | null
}

export function WorkOrderPlanningReturnDeleteDialog({
  open,
  onOpenChange,
  taskLabel,
  onConfirm,
  isSubmitting = false,
  error = null,
}: WorkOrderPlanningReturnDeleteDialogProps) {
  const [observation, setObservation] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setObservation("")
      setLocalError(null)
    }
  }, [open])

  async function handleConfirm() {
    const trimmed = observation.trim()
    if (!trimmed) {
      setLocalError(WORK_ORDER_PLANNING_RETURN_DELETE_OBSERVATION_REQUIRED_MESSAGE)
      return
    }

    setLocalError(null)
    await onConfirm(trimmed)
  }

  const displayError = localError ?? error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar Orden de Trabajo</DialogTitle>
          <DialogDescription>
            La OT se eliminará de Devueltas por Planificación. Esta acción no se
            puede deshacer.
            <span className="mt-2 block font-medium text-foreground">
              {taskLabel}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="planning-return-delete-observation">
            Observación *
          </Label>
          <Textarea
            id="planning-return-delete-observation"
            rows={4}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Indique el motivo de la eliminación"
            disabled={isSubmitting}
          />
        </div>

        {displayError ? (
          <p className="text-sm text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}

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
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !observation.trim()}
          >
            {isSubmitting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
