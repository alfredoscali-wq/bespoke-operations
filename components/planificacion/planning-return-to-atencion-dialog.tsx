"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

import type { Task } from "@/lib/types/tasks"
import { validatePlanningReturnReason } from "@/lib/tasks/planning-return"
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

type Step = "form" | "confirm"

type PlanningReturnToAtencionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  isSubmitting?: boolean
  onConfirm: (reason: string) => Promise<void>
}

export function PlanningReturnToAtencionDialog({
  open,
  onOpenChange,
  task,
  isSubmitting = false,
  onConfirm,
}: PlanningReturnToAtencionDialogProps) {
  const [step, setStep] = useState<Step>("form")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("form")
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

  function handleContinue() {
    const validation = validatePlanningReturnReason(reason)
    if (!validation.allowed) {
      setError(validation.message ?? "Indique el motivo de la devolución.")
      return
    }

    setError(null)
    setStep("confirm")
  }

  async function handleConfirm() {
    const validation = validatePlanningReturnReason(reason)
    if (!validation.allowed) {
      setError(validation.message ?? "Indique el motivo de la devolución.")
      setStep("form")
      return
    }

    setError(null)
    await onConfirm(reason.trim())
  }

  if (!task) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devolver a Atención</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? `La OT ${task.code} será retirada de la planificación y volverá a Atención al Cliente para su revisión.`
              : "Confirme la devolución de la OT a Atención al Cliente."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Se eliminará la programación actual, la cuadrilla asignada y la
              fecha/hora programadas. La información operativa de la OT se
              conservará.
            </div>

            <div className="space-y-2">
              <Label htmlFor="planning-return-reason">
                Motivo de la devolución *
              </Label>
              <Textarea
                id="planning-return-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej.: Falta de materiales, cliente solicita otra fecha..."
                rows={4}
                disabled={isSubmitting}
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                La OT dejará de aparecer en Planificación y volverá al módulo
                Órdenes de Trabajo en el KPI Devueltas por Planificación.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Motivo
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {reason.trim()}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "form" ? (
            <>
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
                onClick={handleContinue}
                disabled={isSubmitting || !reason.trim()}
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
                variant="destructive"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Devolviendo..." : "Confirmar devolución"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
