"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { TaskPhoto } from "@/lib/types/task-photos"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.15
const DOUBLE_CLICK_ZOOM = 2

type TaskPhotoViewerDialogProps = {
  /** Single-photo mode (legacy). Ignored when `photos` has items. */
  photo?: TaskPhoto | null
  /** Gallery mode: thumbnails open into this shared list. */
  photos?: TaskPhoto[]
  open: boolean
  onOpenChange: (open: boolean) => void
  canDelete?: boolean
  onDelete?: () => Promise<{ success: boolean; message?: string }>
}

function resolveGallery(
  photo: TaskPhoto | null | undefined,
  photos: TaskPhoto[] | undefined
): TaskPhoto[] {
  if (photos && photos.length > 0) {
    return photos
  }
  return photo ? [photo] : []
}

export function TaskPhotoViewerDialog({
  photo = null,
  photos,
  open,
  onOpenChange,
  canDelete = false,
  onDelete,
}: TaskPhotoViewerDialogProps) {
  const gallery = useMemo(() => resolveGallery(photo, photos), [photo, photos])
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const currentPhoto = gallery[index] ?? null
  const total = gallery.length
  const hasMultiple = total > 1

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false)
      setDeleteError(null)
      setIsDeleting(false)
      setZoom(MIN_ZOOM)
      return
    }

    const preferredId = photo?.id
    const preferredIndex =
      preferredId != null
        ? gallery.findIndex((item) => item.id === preferredId)
        : -1
    setIndex(preferredIndex >= 0 ? preferredIndex : 0)
    setZoom(MIN_ZOOM)
  }, [open, photo?.id, gallery])

  useEffect(() => {
    if (!open || !hasMultiple) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setIndex((current) => (current - 1 + total) % total)
        setZoom(MIN_ZOOM)
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setIndex((current) => (current + 1) % total)
        setZoom(MIN_ZOOM)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, hasMultiple, total])

  useEffect(() => {
    const stage = stageRef.current
    if (!open || !stage) {
      return
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((current) =>
        Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))
        )
      )
    }

    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => stage.removeEventListener("wheel", onWheel)
  }, [open, index])

  if (!currentPhoto) {
    return null
  }

  const imageUrl = currentPhoto.signedUrl

  function goPrevious() {
    setIndex((current) => (current - 1 + total) % total)
    setZoom(MIN_ZOOM)
  }

  function goNext() {
    setIndex((current) => (current + 1) % total)
    setZoom(MIN_ZOOM)
  }

  function handleDoubleClick() {
    setZoom((current) =>
      current > MIN_ZOOM ? MIN_ZOOM : DOUBLE_CLICK_ZOOM
    )
  }

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
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/80 supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "max-h-[92vh] gap-3 overflow-hidden border-0 bg-zinc-950 p-3 text-zinc-100 ring-1 ring-white/10 sm:max-w-4xl md:max-w-5xl",
          "[&_[data-slot=dialog-close]]:text-zinc-100 [&_[data-slot=dialog-close]]:hover:bg-white/10"
        )}
        data-testid="task-photo-viewer-dialog"
      >
        <DialogHeader className="pr-10">
          <DialogTitle className="truncate text-zinc-50">
            {currentPhoto.fileName}
          </DialogTitle>
          {hasMultiple ? (
            <p
              className="text-xs text-zinc-400"
              data-testid="task-photo-viewer-counter"
            >
              Imagen {index + 1} de {total}
            </p>
          ) : null}
        </DialogHeader>

        <div className="relative">
          <div
            ref={stageRef}
            className="flex max-h-[min(70vh,720px)] min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-black"
            data-testid="task-photo-viewer-stage"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={currentPhoto.description || currentPhoto.fileName}
                onDoubleClick={handleDoubleClick}
                draggable={false}
                className="max-h-[min(70vh,720px)] max-w-full select-none object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
                data-testid="task-photo-viewer-image"
              />
            ) : (
              <div className="flex h-48 items-center justify-center px-4 text-sm text-zinc-400">
                No se pudo cargar la imagen.
              </div>
            )}
          </div>

          {hasMultiple ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Imagen anterior"
                onClick={goPrevious}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                data-testid="task-photo-viewer-prev"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Imagen siguiente"
                onClick={goNext}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                data-testid="task-photo-viewer-next"
              >
                <ChevronRight className="size-5" />
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="min-w-0 space-y-1">
            {currentPhoto.description ? (
              <p className="truncate text-sm text-zinc-200">
                {currentPhoto.description}
              </p>
            ) : null}
            <p>{formatTaskDateTime(currentPhoto.createdAt)}</p>
          </div>
          <p className="text-zinc-500">
            Zoom {Math.round(zoom * 100)}% · rueda o doble clic
          </p>
        </div>

        {deleteError ? (
          <p className="text-sm text-destructive">{deleteError}</p>
        ) : null}

        {canDelete && onDelete ? (
          <DialogFooter className="gap-2 border-t border-white/10 bg-transparent sm:gap-0">
            {confirmDelete ? (
              <>
                <p className="w-full text-sm text-zinc-400 sm:mr-auto">
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
