"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"

import type { TaskPhoto } from "@/lib/types/task-photos"
import {
  clampPhotoViewerPan,
  shouldEnablePhotoViewerPan,
} from "@/lib/tasks/task-photo-viewer-pan"
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

type PanState = { x: number; y: number }

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

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
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
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const currentPhoto = gallery[index] ?? null
  const total = gallery.length
  const hasMultiple = total > 1
  const canPan = shouldEnablePhotoViewerPan(zoom)

  function resetView() {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
    setIsDragging(false)
    dragRef.current = null
  }

  function applyZoom(nextZoom: number, nextPan?: PanState) {
    const stage = stageRef.current
    const clampedZoom = clampZoom(nextZoom)
    const clampedPan = clampPhotoViewerPan({
      x: nextPan?.x ?? (clampedZoom <= MIN_ZOOM ? 0 : pan.x),
      y: nextPan?.y ?? (clampedZoom <= MIN_ZOOM ? 0 : pan.y),
      zoom: clampedZoom,
      stageWidth: stage?.clientWidth ?? 0,
      stageHeight: stage?.clientHeight ?? 0,
    })
    setZoom(clampedZoom)
    setPan(clampedPan)
  }

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false)
      setDeleteError(null)
      setIsDeleting(false)
      resetView()
      return
    }

    const preferredId = photo?.id
    const preferredIndex =
      preferredId != null
        ? gallery.findIndex((item) => item.id === preferredId)
        : -1
    setIndex(preferredIndex >= 0 ? preferredIndex : 0)
    resetView()
  }, [open, photo?.id, gallery])

  useEffect(() => {
    if (!open || !hasMultiple) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setIndex((current) => (current - 1 + total) % total)
        resetView()
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setIndex((current) => (current + 1) % total)
        resetView()
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
      setZoom((current) => {
        const next = clampZoom(current + delta)
        const stageEl = stageRef.current
        setPan((currentPan) =>
          clampPhotoViewerPan({
            x: next <= MIN_ZOOM ? 0 : currentPan.x,
            y: next <= MIN_ZOOM ? 0 : currentPan.y,
            zoom: next,
            stageWidth: stageEl?.clientWidth ?? 0,
            stageHeight: stageEl?.clientHeight ?? 0,
          })
        )
        return next
      })
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
    resetView()
  }

  function goNext() {
    setIndex((current) => (current + 1) % total)
    resetView()
  }

  function handleDoubleClick() {
    applyZoom(zoom > MIN_ZOOM ? MIN_ZOOM : DOUBLE_CLICK_ZOOM, { x: 0, y: 0 })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canPan || event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const stage = stageRef.current
    setPan(
      clampPhotoViewerPan({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
        zoom,
        stageWidth: stage?.clientWidth ?? 0,
        stageHeight: stage?.clientHeight ?? 0,
      })
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setIsDragging(false)
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
        overlayClassName="bg-black/85 supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col gap-3 overflow-hidden rounded-none border-0 bg-zinc-950 p-3 text-zinc-100 ring-1 ring-white/10 sm:h-[96vh] sm:max-h-[96vh] sm:max-w-[96vw] sm:rounded-xl",
          "[&_[data-slot=dialog-close]]:text-zinc-100 [&_[data-slot=dialog-close]]:hover:bg-white/10"
        )}
        data-testid="task-photo-viewer-dialog"
      >
        <DialogHeader className="shrink-0 pr-10">
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

        <div className="relative min-h-0 flex-1">
          <div
            ref={stageRef}
            className={cn(
              "flex h-full min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-black",
              canPan
                ? isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default"
            )}
            data-testid="task-photo-viewer-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={currentPhoto.description || currentPhoto.fileName}
                onDoubleClick={handleDoubleClick}
                draggable={false}
                className={cn(
                  "max-h-full max-w-full select-none object-contain",
                  isDragging ? "transition-none" : "transition-transform duration-150"
                )}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="min-w-0 space-y-1">
            {currentPhoto.description ? (
              <p className="truncate text-sm text-zinc-200">
                {currentPhoto.description}
              </p>
            ) : null}
            <p>{formatTaskDateTime(currentPhoto.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Alejar"
                className="size-8 text-zinc-200 hover:bg-white/10 hover:text-white"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => applyZoom(zoom - ZOOM_STEP)}
                data-testid="task-photo-viewer-zoom-out"
              >
                <Minus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Acercar"
                className="size-8 text-zinc-200 hover:bg-white/10 hover:text-white"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => applyZoom(zoom + ZOOM_STEP)}
                data-testid="task-photo-viewer-zoom-in"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-zinc-500" data-testid="task-photo-viewer-zoom-label">
              Zoom {Math.round(zoom * 100)}%
              {canPan ? " · arrastrar para desplazar" : " · rueda o doble clic"}
            </p>
          </div>
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
