"use client"

import { useState } from "react"

import {
  TASK_INCIDENT_REASONS,
  type TaskIncidentReason,
} from "@/lib/tasks/incidents"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type OperarioTaskIncidentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: {
    reason: TaskIncidentReason
    observation: string
  }) => Promise<void>
  isSubmitting?: boolean
}

export function OperarioTaskIncidentDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: OperarioTaskIncidentDialogProps) {
  const [reason, setReason] = useState<TaskIncidentReason | "">("")
  const [observation, setObservation] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("")
      setObservation("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!reason) {
      setError("Seleccione un motivo de incidencia.")
      return
    }

    const trimmedObservation = observation.trim()
    if (!trimmedObservation) {
      setError("Describa brevemente la situación.")
      return
    }

    setError(null)
    await onConfirm({ reason, observation: trimmedObservation })
    setReason("")
    setObservation("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar incidencia</DialogTitle>
          <DialogDescription>
            Indique por qué no puede completarse la OT en este momento. El
            supervisor revisará el caso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="incident-reason">Motivo *</Label>
            <Select
              value={reason}
              onValueChange={(value) =>
                setReason(value as TaskIncidentReason)
              }
            >
              <SelectTrigger id="incident-reason">
                <SelectValue placeholder="Seleccione un motivo" />
              </SelectTrigger>
              <SelectContent>
                {TASK_INCIDENT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-observation">Observación *</Label>
            <Textarea
              id="incident-observation"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder='Ej.: "El cliente informó que estará disponible recién el viernes."'
              rows={4}
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
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Volver
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            Reportar incidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
