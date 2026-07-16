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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FORCE_DELETE_CONFIRM_TEXT } from "@/lib/admin/force-delete-types"

type ForceDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  onConfirm: () => Promise<void>
  isSubmitting?: boolean
  error?: string | null
}

/**
 * Reinforced confirmation for admin force soft-delete.
 * Requires typing ELIMINAR exactly.
 */
export function ForceDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  onConfirm,
  isSubmitting = false,
  error = null,
}: ForceDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("")

  const canSubmit =
    confirmation === FORCE_DELETE_CONFIRM_TEXT && !isSubmitting

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("")
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!canSubmit) {
      return
    }
    await onConfirm()
    setConfirmation("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⚠️ FORZAR ELIMINACIÓN</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Está por eliminar un registro ignorando las reglas normales del
                sistema.
              </p>
              <p className="font-medium text-destructive">
                Esta acción es exclusiva para Administradores.
              </p>
              <p>
                El registro será eliminado mediante Soft Delete. Esta operación
                puede afectar la trazabilidad histórica.
              </p>
              <p>
                Registro:{" "}
                <span className="font-medium text-foreground">{entityLabel}</span>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="force-delete-confirm">
            Escriba {FORCE_DELETE_CONFIRM_TEXT} para confirmar
          </Label>
          <Input
            id="force-delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={FORCE_DELETE_CONFIRM_TEXT}
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
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
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Eliminando..." : "Forzar eliminación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
