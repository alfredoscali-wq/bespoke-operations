"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"

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

type EvidenceVoidDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  fileName: string
}

export function EvidenceVoidDialog({
  open,
  onOpenChange,
  onConfirm,
  fileName,
}: EvidenceVoidDialogProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Debe indicar el motivo de la anulación antes de continuar.")
      return
    }

    onConfirm(trimmed)
    setReason("")
    setError(null)
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular evidencia</DialogTitle>
          <DialogDescription>
            La evidencia{" "}
            <span className="font-medium text-foreground">{fileName}</span>{" "}
            dejará de contar en KPIs y listados operativos. El registro se
            conserva con trazabilidad completa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="void-reason">Motivo de anulación</Label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Describa por qué se anula esta evidencia..."
            rows={4}
            className="resize-none"
          />
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirmar anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
