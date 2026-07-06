"use client"

import { useState } from "react"

import { requestPermanentDelete } from "@/lib/admin/permanent-delete.client"
import {
  buildPermanentDeleteSuccessMessage,
  resolvePermanentDeleteEntityTypeLabel,
  type PermanentDeleteEntityType,
} from "@/lib/admin/permanent-delete-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type DeletePermanentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: PermanentDeleteEntityType
  entityId: string
  entityLabel: string
  onSuccess: (message: string) => void
  onDelete?: (input: {
    entityType: PermanentDeleteEntityType
    entityId: string
  }) => Promise<{ success: boolean; message?: string }>
}

export function DeletePermanentDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  onSuccess,
  onDelete,
}: DeletePermanentDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const entityTypeLabel = resolvePermanentDeleteEntityTypeLabel(entityType)

  async function handleConfirm() {
    setError(null)
    setIsSubmitting(true)

    try {
      const result = onDelete
        ? await onDelete({ entityType, entityId })
        : await requestPermanentDelete({ entityType, entityId })

      if (!result.success) {
        setError(
          result.message ?? "No se pudo eliminar definitivamente el registro."
        )
        return
      }

      onSuccess(buildPermanentDeleteSuccessMessage(entityType, entityLabel))
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
                Está a punto de eliminar permanentemente este registro. Esta
                acción eliminará toda la información relacionada y NO podrá
                deshacerse.
              </p>
              <dl className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tipo de entidad
                  </dt>
                  <dd className="font-medium text-foreground">
                    {entityTypeLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nombre o código
                  </dt>
                  <dd className="font-medium text-foreground">{entityLabel}</dd>
                </div>
              </dl>
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
