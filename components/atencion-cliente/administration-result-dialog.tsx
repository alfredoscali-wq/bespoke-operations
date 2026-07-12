"use client"

import { useEffect, useState } from "react"

import {
  buildAdministrationDeferInput,
  buildAdministrationResolvedInput,
  mapAdministrationOutcomeToAction,
  validateAdministrationDeferDetail,
  validateAdministrationResolvedResolution,
  type AdministrationOutcome,
} from "@/lib/customer-atenciones/administration-flow"
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
import { cn } from "@/lib/utils"

const OUTCOME_OPTIONS: {
  value: AdministrationOutcome
  label: string
}[] = [
  { value: "facturacion_resuelta", label: "Facturación resuelta" },
  { value: "cliente_con_deuda", label: "Cliente con deuda" },
  { value: "esperando_documentacion", label: "Esperando documentación" },
  { value: "confirmar_baja", label: "Confirmar baja" },
]

type AdministrationResultDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: (resolution: string) => Promise<{ success: boolean; message?: string }>
  onDefer: (
    nextStep: string,
    detail: string
  ) => Promise<{ success: boolean; message?: string }>
}

export function AdministrationResultDialog({
  open,
  onOpenChange,
  onResolve,
  onDefer,
}: AdministrationResultDialogProps) {
  const [outcome, setOutcome] = useState<AdministrationOutcome | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setOutcome(null)
      setNote("")
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!outcome) {
      setError("Seleccioná el resultado de la gestión administrativa.")
      return
    }

    setIsSubmitting(true)

    try {
      const action = mapAdministrationOutcomeToAction(outcome)

      if (action.kind === "resolve") {
        const resolutionResult = validateAdministrationResolvedResolution(note)
        if (typeof resolutionResult !== "string") {
          setError(resolutionResult.error)
          return
        }

        const result = await onResolve(
          buildAdministrationResolvedInput(resolutionResult).resolution
        )

        if (!result.success) {
          setError(result.message ?? "No se pudo registrar el resultado.")
          return
        }
      } else {
        const detailResult = validateAdministrationDeferDetail(note)
        if (typeof detailResult !== "string") {
          setError(detailResult.error)
          return
        }

        const deferInput = buildAdministrationDeferInput(action.nextStep!, detailResult)
        const result = await onDefer(deferInput.nextStep, deferInput.detail)

        if (!result.success) {
          setError(result.message ?? "No se pudo registrar el resultado.")
          return
        }
      }

      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const noteLabel =
    outcome === "facturacion_resuelta"
      ? "Resolución de facturación"
      : "Detalle operativo"

  const notePlaceholder =
    outcome === "facturacion_resuelta"
      ? "Ej.: se corrigió el cupón, se ajustó el plan…"
      : outcome === "cliente_con_deuda"
        ? "Ej.: cliente informado de deuda pendiente…"
        : outcome === "esperando_documentacion"
          ? "Ej.: se solicitó documentación al cliente…"
          : outcome === "confirmar_baja"
            ? "Ej.: baja confirmada administrativamente, preparar retiro…"
            : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Resultado administrativo</DialogTitle>
            <DialogDescription>
              Registrá el resultado de la gestión administrativa sobre esta consulta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>¿Qué ocurrió?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {OUTCOME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={outcome === option.value ? "default" : "outline"}
                    className={cn(
                      "h-auto whitespace-normal py-3 text-left",
                      outcome === option.value && "ring-2 ring-primary/30"
                    )}
                    onClick={() => setOutcome(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {outcome ? (
              <div className="space-y-2">
                <Label htmlFor="administration-note">{noteLabel}</Label>
                <Textarea
                  id="administration-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder={notePlaceholder}
                />
                {outcome === "confirmar_baja" ? (
                  <p className="text-xs text-muted-foreground">
                    La consulta quedará preparada para generar OT en el siguiente
                    circuito. No se creará ninguna OT en este paso.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !outcome}>
              {isSubmitting ? "Guardando…" : "Registrar resultado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
