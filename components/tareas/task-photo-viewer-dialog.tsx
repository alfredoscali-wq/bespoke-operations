"use client"

import { useEffect, useState } from "react"

import type { TaskPhoto } from "@/lib/types/task-photos"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TaskPhotoViewerDialogProps = {
  photo: TaskPhoto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canDelete?: boolean
  onDelete?: () => Promise<{ success: boolean; message?: string }>
}

export function TaskPhotoViewerDialog({
  photo,
  open,
  onOpenChange,
  canDelete = false,
  onDelete,
}: TaskPhotoViewerDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false)
      setDeleteError(null)
      setIsDeleting(false)
    }
  }, [open, photo?.id])

  if (!photo) return null

  const imageUrl = photo.signedUrl

  async function handleDelete() {
    if (!onDelete) {
      return
    }

    setDeleteError(null)
    setIsDeleting(true)

    try {
      const result = await onDelete()

      if (!result.success) {
        setDeleteError(result.message ?? "No se pudo eliminar la fotografia.")
        return
      }

      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{photo.fileName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={photo.description || photo.fileName}
              className="max-h-[60vh] w-full rounded-lg border object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
              No se pudo cargar la imagen.
            </div>
          )}
          {photo.description ? (
            <p className="text-sm text-foreground">{photo.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {formatTaskDateTime(photo.createdAt)}
          </p>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
        </div>

        {canDelete && onDelete ? (
          <DialogFooter className="gap-2 sm:gap-0">
            {confirmDelete ? (
              <>
                <p className="w-full text-sm text-muted-foreground sm:mr-auto">
                  Esta accion no se puede deshacer.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Eliminando..." : "Confirmar eliminacion"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar foto
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
