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

type EvidenceRejectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
  fileName: string
}

export function EvidenceRejectDialog({
  open,
  onOpenChange,
  onConfirm,
  fileName,
}: EvidenceRejectDialogProps) {
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    const trimmed = comment.trim()
    if (!trimmed) {
      setError("Debe indicar el motivo del rechazo antes de continuar.")
      return
    }

    onConfirm(trimmed)
    setComment("")
    setError(null)
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setComment("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar evidencia</DialogTitle>
          <DialogDescription>
            Indique el motivo del rechazo para{" "}
            <span className="font-medium text-foreground">{fileName}</span>.
            El comentario es obligatorio y se notificará al operario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-comment">Motivo del rechazo</Label>
          <Textarea
            id="reject-comment"
            value={comment}
            onChange={(event) => {
              setComment(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Describa qué debe corregirse o repetirse..."
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
            Confirmar rechazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
