"use client"

import { useState } from "react"

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

type OperarioTaskTrabajoRealizadoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (trabajoRealizado: string) => Promise<void>
  isSubmitting?: boolean
}

export function OperarioTaskTrabajoRealizadoDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: OperarioTaskTrabajoRealizadoDialogProps) {
  const [trabajoRealizado, setTrabajoRealizado] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTrabajoRealizado("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    const trimmed = trabajoRealizado.trim()
    if (!trimmed) {
      setError("Describa el trabajo realizado antes de solicitar el cierre.")
      return
    }

    setError(null)
    await onConfirm(trimmed)
    setTrabajoRealizado("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trabajo Realizado</DialogTitle>
          <DialogDescription>
            Documente qué tareas realizó realmente en el sitio. Este campo es
            obligatorio y no reemplaza el checklist ni las evidencias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="trabajo-realizado">Trabajo Realizado</Label>
          <Textarea
            id="trabajo-realizado"
            value={trabajoRealizado}
            onChange={(event) => setTrabajoRealizado(event.target.value)}
            placeholder="Ej.: Se cambió acometida. Se configuró router. Se alineó antena."
            rows={5}
            disabled={isSubmitting}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
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
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            Solicitar cierre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
