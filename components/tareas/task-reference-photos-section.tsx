"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2 } from "lucide-react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import {
  listTaskReferencePhotos,
  uploadTaskReferencePhotoFiles,
} from "@/lib/supabase/task-photos.browser"
import { validateTaskReferencePhotoFile } from "@/lib/supabase/task-photos.storage"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskReferencePhotosSectionProps = {
  taskId: string
}

export function TaskReferencePhotosSection({
  taskId,
}: TaskReferencePhotosSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
  }, [taskId, refreshKey])

  async function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) return

    const validFiles: File[] = []
    for (const file of files) {
      const validationMessage = validateTaskReferencePhotoFile(file)
      if (validationMessage) {
        setUploadError(validationMessage)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    setIsUploading(true)
    setUploadMessage(null)
    setUploadError(null)

    const result = await uploadTaskReferencePhotoFiles({
      taskId,
      photos: validFiles.map((file) => ({ file })),
    })

    setIsUploading(false)
    setRefreshKey((value) => value + 1)

    if (result.summary.failedPhotos > 0 && result.summary.uploadedPhotos > 0) {
      setUploadMessage(
        `${result.summary.uploadedPhotos} foto(s) cargada(s). ${result.summary.failedPhotos} no se pudieron subir.`
      )
      return
    }

    if (result.summary.failedPhotos > 0) {
      setUploadError("No se pudieron cargar las fotos seleccionadas.")
      return
    }

    setUploadMessage(
      result.summary.uploadedPhotos === 1
        ? "Foto cargada correctamente."
        : `${result.summary.uploadedPhotos} fotos cargadas correctamente.`
    )
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Fotos para la Cuadrilla
              {photos.length > 0 ? ` (${photos.length})` : ""}
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Agregar fotos
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleSelectFiles}
              disabled={isUploading}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {uploadMessage ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
          ) : null}

          {uploadError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}

          {photos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin fotos cargadas. Use &quot;Agregar fotos&quot; para subir
              referencias para la cuadrilla.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
