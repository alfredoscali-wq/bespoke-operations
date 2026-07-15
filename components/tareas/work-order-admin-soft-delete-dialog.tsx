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

export const WORK_ORDER_ADMIN_SOFT_DELETE_CONFIRM_TEXT = "ELIMINAR"

type WorkOrderAdminSoftDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskLabel: string
  onConfirm: () => Promise<void>
  isSubmitting?: boolean
  error?: string | null
}

/**
 * Admin-only confirmation to soft-delete a work order.
 * Reuses the existing soft-delete mutation; does not hard-delete.
 */
export function WorkOrderAdminSoftDeleteDialog({
  open,
  onOpenChange,
  taskLabel,
  onConfirm,
  isSubmitting = false,
  error = null,
}: WorkOrderAdminSoftDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("")

  const canSubmit =
    confirmation === WORK_ORDER_ADMIN_SOFT_DELETE_CONFIRM_TEXT && !isSubmitting

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
          <DialogTitle>
            Eliminar definitivamente la Orden de Trabajo
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Esta acción eliminará permanentemente la OT y toda la
                información relacionada.
              </p>
              <p className="font-medium text-destructive">
                No podrá recuperarse.
              </p>
              <p>
                OT:{" "}
                <span className="font-medium text-foreground">{taskLabel}</span>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="work-order-admin-soft-delete-confirm">
            Escribí {WORK_ORDER_ADMIN_SOFT_DELETE_CONFIRM_TEXT} para confirmar
          </Label>
          <Input
            id="work-order-admin-soft-delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={WORK_ORDER_ADMIN_SOFT_DELETE_CONFIRM_TEXT}
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
            {isSubmitting ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
