"use client"

import type { TaskPhoto } from "@/lib/types/task-photos"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TaskPhotoViewerDialogProps = {
  photo: TaskPhoto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskPhotoViewerDialog({
  photo,
  open,
  onOpenChange,
}: TaskPhotoViewerDialogProps) {
  if (!photo) return null

  const imageUrl = photo.signedUrl

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
        </div>
      </DialogContent>
    </Dialog>
  )
}
