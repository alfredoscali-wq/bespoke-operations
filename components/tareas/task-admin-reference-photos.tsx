"use client"

import { useCallback, useEffect, useState } from "react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { blockDemoWrite } from "@/lib/demo/demo-write-block"
import {
  deleteTaskReferencePhoto,
  listTaskReferencePhotos,
} from "@/lib/supabase/task-photos.browser"
import type { TaskPhoto } from "@/lib/types/task-photos"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminReferencePhotosProps = {
  taskId: string
  canDeleteReferencePhotos?: boolean
  compact?: boolean
}

export function TaskAdminReferencePhotos({
  taskId,
  canDeleteReferencePhotos = false,
  compact = false,
}: TaskAdminReferencePhotosProps) {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const loadPhotos = useCallback(async () => {
    const result = await listTaskReferencePhotos(taskId)

    if (result.error) {
      setPhotos([])
      setLoadError(result.error.message)
      return
    }

    setLoadError(null)
    setPhotos(result.data ?? [])
  }, [taskId])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos])

  async function handleDeleteSelectedPhoto(): Promise<{
    success: boolean
    message?: string
  }> {
    if (!selectedPhoto) {
      return { success: false, message: "Fotografia no seleccionada." }
    }

    if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
      return {
        success: false,
        message: "La plataforma demo no permite eliminar fotografias.",
      }
    }

    const result = await deleteTaskReferencePhoto({
      taskId,
      photoId: selectedPhoto.id,
    })

    if (result.error || !result.data) {
      return {
        success: false,
        message: result.error?.message ?? "No se pudo eliminar la fotografia.",
      }
    }

    await loadPhotos()
    return { success: true }
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Fotografias de referencia
            {photos.length > 0 ? ` (${photos.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="py-4 text-center text-sm text-destructive">
              {loadError}
            </p>
          ) : photos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay fotografias de referencia cargadas al crear la orden.
            </p>
          ) : (
            <div
              className={
                compact
                  ? "grid grid-cols-2 gap-2"
                  : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              }
            >
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    setSelectedPhoto(photo)
                    setViewerOpen(true)
                  }}
                  className="group overflow-hidden rounded-lg border bg-muted/20 text-left transition hover:border-primary/40"
                >
                  {photo.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.signedUrl}
                      alt={photo.description || photo.fileName}
                      className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center px-2 text-center text-xs text-muted-foreground">
                      {photo.fileName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        canDelete={canDeleteReferencePhotos}
        onDelete={canDeleteReferencePhotos ? handleDeleteSelectedPhoto : undefined}
      />
    </>
  )
}
