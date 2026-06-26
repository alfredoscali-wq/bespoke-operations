"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

import { requestPermanentDelete } from "@/lib/admin/permanent-delete.client"
import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PermanentDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: PermanentDeleteEntityType
  entityId: string
  entityLabel: string
  onSuccess: (message: string) => void
}

export function PermanentDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  onSuccess,
}: PermanentDeleteDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConfirm() {
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await requestPermanentDelete({ entityType, entityId })

      if (!result.success) {
        setError(
          result.message ?? "No se pudo eliminar definitivamente el registro."
        )
        return
      }

      const entityName =
        entityType === "customer" ? "Cliente" : "Orden de trabajo"
      onSuccess(`${entityName} ${entityLabel} eliminado definitivamente.`)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar definitivamente</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Esta acción eliminará permanentemente este registro y toda la
                información relacionada. No podrá deshacerse.
              </p>
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-destructive">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Eliminación permanente
                    <span className="mt-1 block font-normal">
                      Esta acción no utiliza Soft Delete y no puede deshacerse.
                    </span>
                  </span>
                </p>
              </div>
              <p className="font-medium text-foreground">{entityLabel}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="bg-destructive/90 hover:bg-destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
