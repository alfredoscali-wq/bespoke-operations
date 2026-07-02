"use client"

import { useEffect, useState } from "react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { listTaskReferencePhotos } from "@/lib/supabase/task-photos.browser"
import type { TaskPhoto } from "@/lib/types/task-photos"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminReferencePhotosProps = {
  taskId: string
  compact?: boolean
}

export function TaskAdminReferencePhotos({
  taskId,
  compact = false,
}: TaskAdminReferencePhotosProps) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchPhotos() {
      const result = await listTaskReferencePhotos(taskId)
      if (cancelled) return
      setPhotos(result.data ?? [])
    }

    void fetchPhotos()

    return () => {
      cancelled = true
    }
  }, [taskId])

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Fotografías de referencia
            {photos.length > 0 ? ` (${photos.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay fotografías de referencia cargadas al crear la orden.
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
      />
    </>
  )
}
