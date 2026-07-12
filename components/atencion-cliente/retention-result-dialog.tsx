"use client"

import { useEffect, useState } from "react"

import {
  buildRetentionFirmBajaDeferInput,
  buildRetentionRetainedResolveInput,
  validateRetentionFirmBajaDetail,
  validateRetentionRetainedResolution,
  type RetentionOutcome,
} from "@/lib/customer-atenciones/retention-flow"
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

type RetentionResultDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: (resolution: string) => Promise<{ success: boolean; message?: string }>
  onDefer: (
    nextStep: string,
    detail: string
  ) => Promise<{ success: boolean; message?: string }>
}

export function RetentionResultDialog({
  open,
  onOpenChange,
  onResolve,
  onDefer,
}: RetentionResultDialogProps) {
  const [outcome, setOutcome] = useState<RetentionOutcome | null>(null)
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
      setError("Seleccioná qué ocurrió con el intento de retención.")
      return
    }

    setIsSubmitting(true)

    try {
      if (outcome === "cliente_retenido") {
        const resolutionResult = validateRetentionRetainedResolution(note)
        if (typeof resolutionResult !== "string") {
          setError(resolutionResult.error)
          return
        }

        const result = await onResolve(
          buildRetentionRetainedResolveInput(resolutionResult).resolution
        )

        if (!result.success) {
          setError(result.message ?? "No se pudo registrar el resultado.")
          return
        }
      } else {
        const detailResult = validateRetentionFirmBajaDetail(note)
        if (typeof detailResult !== "string") {
          setError(detailResult.error)
          return
        }

        const deferInput = buildRetentionFirmBajaDeferInput(detailResult)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Resultado de la retención</DialogTitle>
            <DialogDescription>
              Registrá el resultado del intento de retención sobre esta consulta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>¿Qué ocurrió?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={outcome === "cliente_retenido" ? "default" : "outline"}
                  className={cn(
                    "h-auto whitespace-normal py-3 text-left",
                    outcome === "cliente_retenido" && "ring-2 ring-primary/30"
                  )}
                  onClick={() => setOutcome("cliente_retenido")}
                >
                  Cliente retenido
                </Button>
                <Button
                  type="button"
                  variant={outcome === "baja_sigue_firme" ? "default" : "outline"}
                  className={cn(
                    "h-auto whitespace-normal py-3 text-left",
                    outcome === "baja_sigue_firme" && "ring-2 ring-primary/30"
                  )}
                  onClick={() => setOutcome("baja_sigue_firme")}
                >
                  Baja sigue firme
                </Button>
              </div>
            </div>

            {outcome === "cliente_retenido" ? (
              <div className="space-y-2">
                <Label htmlFor="retention-resolution">
                  Resolución / solución ofrecida
                </Label>
                <Textarea
                  id="retention-resolution"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder="Ej.: se ofreció cambio de plan, se resolvió el reclamo…"
                />
              </div>
            ) : null}

            {outcome === "baja_sigue_firme" ? (
              <div className="space-y-2">
                <Label htmlFor="retention-firm-baja-detail">
                  Resultado / motivo
                </Label>
                <Textarea
                  id="retention-firm-baja-detail"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder="Ej.: mudanza sin cobertura, disconformidad, decisión definitiva…"
                />
                <p className="text-xs text-muted-foreground">
                  El cliente debe enviar el pedido formal de baja por email según el
                  procedimiento de ABNet.
                </p>
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
