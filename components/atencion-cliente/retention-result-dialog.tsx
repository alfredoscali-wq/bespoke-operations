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
  /** RC 3.2.2 — render inside the expediente (no modal). */
  presentation?: "dialog" | "inline"
}

export function RetentionResultDialog({
  open,
  onOpenChange,
  onResolve,
  onDefer,
  presentation = "dialog",
}: RetentionResultDialogProps) {
  const [outcome, setOutcome] = useState<RetentionOutcome | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isInline = presentation === "inline"

  useEffect(() => {
    if (!open && !isInline) {
      setOutcome(null)
      setNote("")
      setError(null)
      setIsSubmitting(false)
    }
  }, [open, isInline])

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
      if (isInline) {
        setOutcome(null)
        setNote("")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className={cn(isInline && "space-y-3")}>
      {!isInline ? (
        <DialogHeader>
          <DialogTitle>Resultado de la retención</DialogTitle>
          <DialogDescription>
            Registrá el resultado del intento de retención sobre esta consulta.
          </DialogDescription>
        </DialogHeader>
      ) : null}

      <div className={cn("space-y-4", isInline ? "py-0" : "py-4")}>
        <div className="space-y-2">
          <Label>¿Qué resultado tuvo el intento de retención?</Label>
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

      {isInline ? (
        <Button
          type="submit"
          className="h-10 w-full text-[13px] font-semibold"
          disabled={isSubmitting || !outcome}
        >
          {isSubmitting ? "Registrando…" : "Registrar gestión"}
        </Button>
      ) : (
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
            {isSubmitting ? "Guardando…" : "Registrar gestión"}
          </Button>
        </DialogFooter>
      )}
    </form>
  )

  if (isInline) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5">
        {form}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{form}</DialogContent>
    </Dialog>
  )
}
