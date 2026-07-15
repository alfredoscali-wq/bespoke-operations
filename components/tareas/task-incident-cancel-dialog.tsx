"use client"

import { useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  DEFAULT_CANCELACION_MOTIVO_OPTIONS,
  motivoOptionsFromCatalog,
} from "@/lib/tasks/operational-motivos"
import { listOperationalMotivos } from "@/lib/supabase/operational-control.browser"
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

type TaskIncidentCancelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: {
    reason: string
    observation: string
  }) => Promise<void>
  isSubmitting?: boolean
}

export function TaskIncidentCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: TaskIncidentCancelDialogProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [reason, setReason] = useState("")
  const [observation, setObservation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [motivoOptions, setMotivoOptions] = useState<
    Array<{ value: string; label: string }>
  >([...DEFAULT_CANCELACION_MOTIVO_OPTIONS])

  useEffect(() => {
    if (!open || !isAuthReady || !companyId) {
      return
    }

    let cancelled = false

    async function loadMotivos() {
      const result = await listOperationalMotivos(
        companyId,
        "cancelacion",
        true
      )
      if (cancelled) return
      setMotivoOptions(
        motivoOptionsFromCatalog(
          result.data ?? [],
          DEFAULT_CANCELACION_MOTIVO_OPTIONS
        )
      )
    }

    void loadMotivos()
    return () => {
      cancelled = true
    }
  }, [open, companyId, isAuthReady])

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
      setError("Seleccione un motivo de cancelación.")
      return
    }

    setError(null)
    await onConfirm({ reason, observation: observation.trim() })
    setReason("")
    setObservation("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Orden de Trabajo</DialogTitle>
          <DialogDescription>
            La OT permanecerá en el historial operativo. El motivo es
            obligatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Select
              value={reason || undefined}
              onValueChange={setReason}
              disabled={isSubmitting}
            >
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="Seleccionar motivo" />
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
            <Label htmlFor="cancel-observation">Observaciones</Label>
            <Textarea
              id="cancel-observation"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Detalle adicional (opcional)"
              disabled={isSubmitting}
              rows={3}
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
            {isSubmitting ? "Cancelando..." : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
