"use client"

import { useEffect, useState } from "react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { listTaskEvidencePhotos, listTaskReferencePhotos } from "@/lib/supabase/task-photos.browser"
import type { TaskPhoto, TaskPhotoType } from "@/lib/types/task-photos"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskPhotosGalleryProps = {
  taskId: string
  photoType: TaskPhotoType
  title: string
}

async function loadPhotos(taskId: string, photoType: TaskPhotoType) {
  if (photoType === "evidence") {
    return listTaskEvidencePhotos(taskId)
  }

  return listTaskReferencePhotos(taskId)
}

export function TaskPhotosGallery({
  taskId,
  photoType,
  title,
}: TaskPhotosGalleryProps) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchPhotos() {
      const result = await loadPhotos(taskId, photoType)
      if (cancelled) return

      if (result.data) {
        setPhotos(result.data)
      }
    }

    void fetchPhotos()

    return () => {
      cancelled = true
    }
  }, [taskId, photoType])

  if (photos.length === 0) {
    return null
  }

  function handlePhotoClick(photo: TaskPhoto) {
    setSelectedPhoto(photo)
    setViewerOpen(true)
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {title} ({photos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => handlePhotoClick(photo)}
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
        </CardContent>
      </Card>

      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        photos={photos}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}
