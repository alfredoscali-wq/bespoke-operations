"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import {
  buildPlanningIncidentResolvePayload,
  PLANNING_INCIDENT_RESOLVE_DECISIONS,
  type PlanningIncidentResolveDecision,
  type PlanningIncidentResolvePayload,
} from "@/lib/planificacion/planning-incidents-resolve"
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

type PlanningIncidentResolveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  onConfirm: (payload: PlanningIncidentResolvePayload) => Promise<void>
}

type ResolveDialogStep = "choose" | PlanningIncidentResolveDecision

export function PlanningIncidentResolveDialog({
  open,
  onOpenChange,
  isSubmitting = false,
  onConfirm,
}: PlanningIncidentResolveDialogProps) {
  const [step, setStep] = useState<ResolveDialogStep>("choose")
  const [message, setMessage] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("choose")
      setMessage("")
      setReason("")
      setError(null)
    }
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) {
      return
    }

    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (step === "choose") {
      return
    }

    const validation = buildPlanningIncidentResolvePayload({
      decision: step,
      message,
      reason,
    })

    if (!validation.ok) {
      setError(validation.message)
      return
    }

    setError(null)

    try {
      await onConfirm(validation.payload)
      onOpenChange(false)
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "No fue posible resolver la incidencia."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="planning-incident-resolve-dialog">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Resolver incidencia</DialogTitle>
              <DialogDescription>
                Seleccione la decisión operativa para esta incidencia activa.
              </DialogDescription>
            </DialogHeader>
            <div
              className="grid gap-2"
              data-testid="planning-incident-resolve-decisions"
            >
              {PLANNING_INCIDENT_RESOLVE_DECISIONS.map((decision) => (
                <Button
                  key={decision.id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start px-4 py-3 text-left"
                  data-testid={`planning-incident-resolve-decision-${decision.id}`}
                  disabled={isSubmitting}
                  onClick={() => {
                    setStep(decision.id)
                    setError(null)
                  }}
                >
                  {decision.label}
                </Button>
              ))}
            </div>
          </>
        ) : step === "continue" ? (
          <>
            <DialogHeader>
              <DialogTitle>Continuar OT</DialogTitle>
              <DialogDescription>
                Indique un mensaje para el operario. La OT permanecerá en
                curso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="resolve-continue-message">
                Mensaje al operario
              </Label>
              <Textarea
                id="resolve-continue-message"
                data-testid="planning-incident-resolve-continue-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Instrucciones para continuar la ejecución..."
                rows={4}
                disabled={isSubmitting}
              />
            </div>
          </>
        ) : step === "reprogram" ? (
          <>
            <DialogHeader>
              <DialogTitle>Reprogramar OT</DialogTitle>
              <DialogDescription>
                La OT volverá a Administración en estado programada para
                definir fecha, horario y cuadrilla.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="resolve-reprogram-reason">Motivo</Label>
              <Textarea
                id="resolve-reprogram-reason"
                data-testid="planning-incident-resolve-reprogram-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo de la reprogramación..."
                rows={4}
                disabled={isSubmitting}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cancelar OT</DialogTitle>
              <DialogDescription>
                Esta acción cancelará la orden de trabajo asociada.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  La OT será cancelada. Esta decisión resuelve la incidencia,
                  pero no elimina el historial operativo registrado.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolve-cancel-reason">Motivo</Label>
              <Textarea
                id="resolve-cancel-reason"
                data-testid="planning-incident-resolve-cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo de la cancelación..."
                rows={4}
                disabled={isSubmitting}
              />
            </div>
          </>
        )}

        {error ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            data-testid="planning-incident-resolve-error"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => {
              if (step === "choose") {
                handleOpenChange(false)
                return
              }

              setStep("choose")
              setError(null)
            }}
          >
            {step === "choose" ? "Cancelar" : "Volver"}
          </Button>
          {step !== "choose" ? (
            <Button
              type="button"
              disabled={isSubmitting}
              data-testid="planning-incident-resolve-confirm"
              onClick={() => {
                void handleConfirm()
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
