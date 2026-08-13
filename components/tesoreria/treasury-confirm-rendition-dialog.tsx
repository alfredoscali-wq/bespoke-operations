"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { TreasuryPaymentMatchBadge } from "@/components/tesoreria/treasury-payment-match-badge"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
import {
  formatTreasuryPaymentMethodLabel,
  resolveInitialReceivedPaymentMethod,
  TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS,
} from "@/lib/tesoreria/ot-rendition-payment"
import type { TreasuryOtRendition } from "@/lib/types/treasury-ot-renditions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type TreasuryConfirmRenditionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rendition: TreasuryOtRendition | null
}

export function TreasuryConfirmRenditionDialog({
  open,
  onOpenChange,
  rendition,
}: TreasuryConfirmRenditionDialogProps) {
  const { confirmOtRendition } = useTreasury()
  const [amount, setAmount] = useState("")
  const [deliveredBy, setDeliveredBy] = useState("")
  const [notes, setNotes] = useState("")
  const [paymentMethodReceived, setPaymentMethodReceived] = useState("efectivo")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const receivedOptions = useMemo(() => {
    const expected = rendition?.paymentMethodExpected?.trim() || ""
    if (
      expected &&
      !TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS.some(
        (option) => option.value === expected
      )
    ) {
      return [
        {
          value: expected,
          label: formatTreasuryPaymentMethodLabel(expected),
        },
        ...TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS,
      ]
    }
    return TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS
  }, [rendition?.paymentMethodExpected])

  useEffect(() => {
    if (!open || !rendition) return
    setAmount(String(rendition.amount))
    setDeliveredBy("")
    setNotes("")
    setPaymentMethodReceived(
      resolveInitialReceivedPaymentMethod(rendition.paymentMethodExpected)
    )
    setError(null)
    setIsSubmitting(false)
  }, [open, rendition])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!rendition) return

    const amountReceived = Number(amount.replace(",", "."))
    if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
      setError("Ingrese el monto recibido.")
      return
    }

    if (!paymentMethodReceived.trim()) {
      setError("Seleccione el medio realmente cobrado.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await confirmOtRendition(rendition.id, {
        amountReceived,
        deliveredBy,
        notes,
        paymentMethodReceived,
      })
      if (!result.success) {
        setError(result.message ?? "No se pudo confirmar la rendición.")
        return
      }
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Rendir Cobranza</DialogTitle>
            <DialogDescription>
              {rendition
                ? `OT ${rendition.taskCode} · esperado ${formatTreasuryAmount(rendition.amount)}. Al confirmar se crea un ingreso de Cobranza OT.`
                : "Confirme el dinero recibido en caja."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <section className="space-y-3 rounded-md border border-border/80 p-3">
              <h3 className="text-sm font-medium">Cobranza</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Importe</p>
                  <p className="font-medium tabular-nums">
                    {rendition
                      ? formatTreasuryAmount(rendition.amount)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Medio esperado</p>
                  <p className="font-medium">
                    {formatTreasuryPaymentMethodLabel(
                      rendition?.paymentMethodExpected
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rendition-payment-received">
                  Medio realmente cobrado *
                </Label>
                <Select
                  value={paymentMethodReceived}
                  onValueChange={setPaymentMethodReceived}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="rendition-payment-received" className="w-full">
                    <SelectValue placeholder="Seleccione medio" />
                  </SelectTrigger>
                  <SelectContent>
                    {receivedOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TreasuryPaymentMatchBadge
                  expected={rendition?.paymentMethodExpected}
                  received={paymentMethodReceived}
                />
              </div>
            </section>

            <div className="space-y-2">
              <Label htmlFor="rendition-amount">Monto recibido *</Label>
              <Input
                id="rendition-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rendition-delivered-by">
                Persona que entrega dinero
              </Label>
              <Input
                id="rendition-delivered-by"
                value={deliveredBy}
                onChange={(event) => setDeliveredBy(event.target.value)}
                placeholder="Opcional"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rendition-notes">Observaciones</Label>
              <Textarea
                id="rendition-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !rendition}>
              {isSubmitting ? "Confirmando…" : "Confirmar Rendición"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
