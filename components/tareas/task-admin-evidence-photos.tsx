"use client"

import { useEffect, useState } from "react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { listTaskEvidencePhotos } from "@/lib/supabase/task-photos.browser"
import type { TaskPhoto } from "@/lib/types/task-photos"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminEvidencePhotosProps = {
  taskId: string
  compact?: boolean
}

export function TaskAdminEvidencePhotos({
  taskId,
  compact = false,
}: TaskAdminEvidencePhotosProps) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchPhotos() {
      const result = await listTaskEvidencePhotos(taskId)
      if (cancelled) return

      if (result.error) {
        setPhotos([])
        setLoadError(result.error.message)
        return
      }

      setLoadError(null)
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
            Evidencias operativas
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
              No hay evidencias fotográficas registradas para esta orden.
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
