"use client"

import { useState } from "react"

import type { PauseProjectInput, ProjectPauseReason } from "@/lib/types/projects"
import { PROJECT_PAUSE_REASON_OPTIONS } from "@/lib/projects/constants"
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

type ProjectPauseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: PauseProjectInput) => Promise<void> | void
  isSubmitting?: boolean
}

export function ProjectPauseDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ProjectPauseDialogProps) {
  const [reason, setReason] = useState<ProjectPauseReason | "">("")
  const [notes, setNotes] = useState("")

  function resetForm() {
    setReason("")
    setNotes("")
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!reason) return

    await onConfirm({
      reason,
      notes: notes.trim() || undefined,
    })
    resetForm()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pausar obra</DialogTitle>
          <DialogDescription>
            Registre el motivo de la pausa. Esta información aparecerá en el
            resumen operativo de la obra.
          </DialogDescription>
        </DialogHeader>

        <form id="pause-project-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pause-reason">Motivo *</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ProjectPauseReason)}
            >
              <SelectTrigger id="pause-reason" className="w-full">
                <SelectValue placeholder="Seleccione un motivo" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_PAUSE_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pause-notes">Observaciones (opcional)</Label>
            <Textarea
              id="pause-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalle adicional sobre la pausa..."
              rows={3}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="pause-project-form"
            disabled={!reason || isSubmitting}
          >
            {isSubmitting ? "Pausando..." : "Confirmar pausa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
