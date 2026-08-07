"use client"

import { useEffect, useMemo, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  CUSTOMER_INTERACTION_MEDIA_OPTIONS,
  getCustomerInteractionResultOptions,
  type CustomerInteractionMedium,
} from "@/lib/customer-atenciones/customer-interaction-catalog"
import {
  CUSTOMER_ATENCION_NEXT_STEP_OPTIONS,
  formatCustomerAtencionNextStepLabel,
} from "@/lib/customer-atenciones/format"
import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"
import type { ConsultationInteractionMutationResult } from "@/lib/supabase/customer-atenciones-management.browser"
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

const KEEP_CURRENT_NEXT_STEP = "__keep_current__"

type CustomerInteractionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  atencionId: string
  customerId: string
  currentNextStep: CustomerAtencionNextStep | null
  onRegistered?: (
    result: Extract<ConsultationInteractionMutationResult, { success: true }>
  ) => void | Promise<void>
}

export function CustomerInteractionDialog({
  open,
  onOpenChange,
  atencionId,
  customerId,
  currentNextStep,
  onRegistered,
}: CustomerInteractionDialogProps) {
  const { registerConsultationInteraction } = useAtencionCliente()
  const [medium, setMedium] = useState<CustomerInteractionMedium | "">("")
  const [result, setResult] = useState("")
  const [observations, setObservations] = useState("")
  const [nextStepSelection, setNextStepSelection] = useState<string>(
    KEEP_CURRENT_NEXT_STEP
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const resultOptions = useMemo(
    () => getCustomerInteractionResultOptions(medium),
    [medium]
  )

  useEffect(() => {
    if (!open) {
      setMedium("")
      setResult("")
      setObservations("")
      setNextStepSelection(KEEP_CURRENT_NEXT_STEP)
      setError(null)
      setIsSaving(false)
    }
  }, [open])

  useEffect(() => {
    setResult("")
  }, [medium])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!medium) {
      setError("Seleccioná el medio de contacto.")
      return
    }
    if (!result) {
      setError("Seleccioná el resultado del contacto.")
      return
    }

    const nextStep =
      nextStepSelection === KEEP_CURRENT_NEXT_STEP
        ? null
        : nextStepSelection

    setIsSaving(true)
    try {
      const response = await registerConsultationInteraction(atencionId, {
        interactionKind: "contact",
        interactionResult: result,
        clientInteraction: {
          medio: medium,
          resultado: result,
          observations: observations.trim() || null,
          nextStep,
          customerId,
        },
      })

      if (!response.success) {
        setError(response.message)
        return
      }

      onOpenChange(false)
      await onRegistered?.(response)
    } finally {
      setIsSaving(false)
    }
  }

  const currentNextStepLabel = currentNextStep
    ? formatCustomerAtencionNextStepLabel(currentNextStep)
    : "Sin próximo paso"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar interacción</DialogTitle>
            <DialogDescription>
              Registra el contacto con el cliente en el historial del
              expediente. No cambia el estado ni la bandeja.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-interaction-medium">
                Medio de contacto
              </Label>
              <Select
                value={medium || undefined}
                onValueChange={(value) =>
                  setMedium(value as CustomerInteractionMedium)
                }
              >
                <SelectTrigger
                  id="customer-interaction-medium"
                  className="w-full"
                >
                  <SelectValue placeholder="Seleccioná el medio" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_INTERACTION_MEDIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-interaction-result">
                Resultado del contacto
              </Label>
              <Select
                value={result || undefined}
                onValueChange={setResult}
                disabled={!medium}
              >
                <SelectTrigger
                  id="customer-interaction-result"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={
                      medium
                        ? "Seleccioná el resultado"
                        : "Primero elegí el medio"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {resultOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-interaction-observations">
                Observaciones{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Textarea
                id="customer-interaction-observations"
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                rows={3}
                placeholder="Detalle de la conversación o del intento de contacto."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-interaction-next-step">
                Próximo paso{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Select
                value={nextStepSelection}
                onValueChange={setNextStepSelection}
              >
                <SelectTrigger
                  id="customer-interaction-next-step"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_CURRENT_NEXT_STEP}>
                    Mantener actual — {currentNextStepLabel}
                  </SelectItem>
                  {CUSTOMER_ATENCION_NEXT_STEP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] leading-snug text-muted-foreground">
                Si indicás otro próximo paso, queda registrado en el historial
                y en la actividad. El workflow del expediente no se modifica
                desde aquí.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !medium || !result}>
              {isSaving ? "Registrando…" : "Guardar interacción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
