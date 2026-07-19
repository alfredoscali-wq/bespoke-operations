"use client"

import { useEffect, useState } from "react"

import {
  mapTechnicalOutcomeToAction,
  validateTechnicalDeferDetail,
  validateTechnicalResolvedResolution,
  type TechnicalOutcome,
} from "@/lib/customer-atenciones/technical-flow"
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
  value: TechnicalOutcome
  label: string
}[] = [
  { value: "consulta_resuelta", label: "Consulta técnica resuelta" },
  {
    value: "seguimiento_con_cliente",
    label: "Requiere contacto con el cliente",
  },
  { value: "pendiente_generar_ot", label: "Pendiente de generar OT" },
  {
    value: "esperando_cliente",
    label: "Esperar respuesta del cliente",
  },
]

type TechnicalResultDialogProps = {
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

export function TechnicalResultDialog({
  open,
  onOpenChange,
  onResolve,
  onDefer,
  presentation = "dialog",
}: TechnicalResultDialogProps) {
  const [outcome, setOutcome] = useState<TechnicalOutcome | null>(null)
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
      setError("Seleccioná el resultado de la gestión técnica.")
      return
    }

    setIsSubmitting(true)

    try {
      const action = mapTechnicalOutcomeToAction(outcome)

      if (action.kind === "resolve") {
        const resolutionResult = validateTechnicalResolvedResolution(note)
        if (typeof resolutionResult !== "string") {
          setError(resolutionResult.error)
          return
        }

        const result = await onResolve(resolutionResult)
        if (!result.success) {
          setError(result.message ?? "No se pudo registrar el resultado.")
          return
        }
      } else {
        const detailResult = validateTechnicalDeferDetail(note)
        if (typeof detailResult !== "string") {
          setError(detailResult.error)
          return
        }

        const result = await onDefer(action.nextStep!, detailResult)
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
          <DialogTitle>Resultado técnico</DialogTitle>
          <DialogDescription>
            Registrá el resultado de la intervención técnica. Atención puede
            validar con el cliente después.
          </DialogDescription>
        </DialogHeader>
      ) : null}

      <div className={cn("space-y-4", isInline ? "py-0" : "py-4")}>
        <div className="space-y-2">
          <Label>¿Qué resultado tuvo el análisis técnico?</Label>
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
            <Label htmlFor="technical-note">Detalle / resolución</Label>
            <Textarea
              id="technical-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Describí el resultado técnico…"
            />
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
      <DialogContent className="sm:max-w-lg">{form}</DialogContent>
    </Dialog>
  )
}
