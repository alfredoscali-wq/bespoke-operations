"use client"

import { useEffect, useState } from "react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !rendition) return
    setAmount(String(rendition.amount))
    setDeliveredBy("")
    setNotes("")
    setError(null)
    setIsSubmitting(false)
  }, [open, rendition])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!rendition) return

    const amountReceived = Number(amount.replace(",", "."))
    if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
      setError("Ingrese el monto recibido.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await confirmOtRendition(rendition.id, {
        amountReceived,
        deliveredBy,
        notes,
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
            <DialogTitle>Registrar Rendición</DialogTitle>
            <DialogDescription>
              {rendition
                ? `OT ${rendition.taskCode} · esperado ${formatTreasuryAmount(rendition.amount)}. Al confirmar se crea un ingreso de Cobranza OT.`
                : "Confirme el dinero recibido en caja."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
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
