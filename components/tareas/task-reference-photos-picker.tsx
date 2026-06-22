"use client"

import { useEffect, useRef } from "react"
import { ImagePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateTaskReferencePhotoFile } from "@/lib/supabase/task-photos.storage"
import type { PendingTaskReferencePhoto } from "@/lib/types/task-photos"

type TaskReferencePhotosPickerProps = {
  photos: PendingTaskReferencePhoto[]
  onChange: (photos: PendingTaskReferencePhoto[]) => void
  disabled?: boolean
  onError?: (message: string | null) => void
}

function createPendingPhoto(file: File): PendingTaskReferencePhoto {
  return {
    clientId: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    description: "",
  }
}

export function TaskReferencePhotosPicker({
  photos,
  onChange,
  disabled = false,
  onError,
}: TaskReferencePhotosPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef(photos)

  photosRef.current = photos

  useEffect(() => {
    return () => {
      revokePendingTaskReferencePhotos(photosRef.current)
    }
  }, [])

  function handleSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) return

    const nextPhotos = [...photos]
    for (const file of files) {
      const validationMessage = validateTaskReferencePhotoFile(file)
      if (validationMessage) {
        onError?.(validationMessage)
        continue
      }

      nextPhotos.push(createPendingPhoto(file))
    }

    onChange(nextPhotos)
    onError?.(null)
  }

  function handleRemovePhoto(clientId: string) {
    const photo = photos.find((item) => item.clientId === clientId)
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl)
    }

    onChange(photos.filter((item) => item.clientId !== clientId))
  }

  function handleDescriptionChange(clientId: string, description: string) {
    onChange(
      photos.map((photo) =>
        photo.clientId === clientId ? { ...photo, description } : photo
      )
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Fotos para la Cuadrilla</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Agregar fotos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleSelectFiles}
        />
      </div>

      {photos.length > 0 ? (
        <div className="space-y-3">
          {photos.map((photo) => (
            <div
              key={photo.clientId}
              className="flex gap-3 rounded-lg border bg-muted/20 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
                className="size-16 shrink-0 rounded-md border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{photo.file.name}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={disabled}
                    onClick={() => handleRemovePhoto(photo.clientId)}
                    aria-label={`Quitar ${photo.file.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Input
                  value={photo.description}
                  onChange={(event) =>
                    handleDescriptionChange(photo.clientId, event.target.value)
                  }
                  placeholder="Ej: Frente de la vivienda"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function revokePendingTaskReferencePhotos(
  photos: PendingTaskReferencePhoto[]
) {
  photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
}
