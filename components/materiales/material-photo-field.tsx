"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"

import {
  deleteAttachmentFile,
  getAttachmentPreviewLink,
  uploadAttachmentFile,
} from "@/lib/attachments/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

type MaterialPhotoFieldProps = {
  materialId?: string | null
  photoAttachmentId?: string | null
  pendingFile?: File | null
  onPendingFileChange?: (file: File | null) => void
  disabled?: boolean
  onPhotoAttachmentIdChange?: (attachmentId: string | null) => void
  className?: string
}

export function MaterialPhotoField({
  materialId,
  photoAttachmentId,
  pendingFile = null,
  onPendingFileChange,
  disabled = false,
  onPhotoAttachmentIdChange,
  className,
}: MaterialPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const canSelectBeforeCreate = Boolean(onPendingFileChange)
  const canSelectFile = Boolean(materialId) || canSelectBeforeCreate

  useEffect(() => {
    let cancelled = false
    async function loadPreview() {
      if (pendingFile) {
        setPreviewUrl(URL.createObjectURL(pendingFile))
        return
      }

      if (!photoAttachmentId) {
        setPreviewUrl(null)
        return
      }

      const result = await getAttachmentPreviewLink(photoAttachmentId)
      if (!cancelled) {
        setPreviewUrl(result.success ? result.url : null)
      }
    }
    loadPreview()
    return () => {
      cancelled = true
    }
  }, [photoAttachmentId, pendingFile])

  useEffect(() => {
    if (!pendingFile || !previewUrl?.startsWith("blob:")) return
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [pendingFile, previewUrl])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError(null)

    if (!materialId && onPendingFileChange) {
      onPendingFileChange(file)
      return
    }

    if (!materialId) return

    setIsUploading(true)
    try {
      const upload = await uploadAttachmentFile({
        module: "materials",
        recordId: materialId,
        file,
      })
      if (!upload.success) {
        setError(upload.message)
        return
      }
      const attachment = upload.attachment as { id?: string }
      if (!attachment?.id) {
        setError("No se recibió el identificador de la foto.")
        return
      }
      onPhotoAttachmentIdChange?.(attachment.id)
    } catch {
      setError("Error al subir la foto.")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    setError(null)

    if (pendingFile && onPendingFileChange) {
      onPendingFileChange(null)
      setPreviewUrl(null)
      return
    }

    if (!photoAttachmentId) return

    setIsUploading(true)
    try {
      const result = await deleteAttachmentFile(photoAttachmentId)
      if (!result.success) {
        setError(result.message)
        return
      }
      onPhotoAttachmentIdChange?.(null)
      setPreviewUrl(null)
    } catch {
      setError("No se pudo eliminar la foto.")
    } finally {
      setIsUploading(false)
    }
  }

  const hasPhoto = Boolean(previewUrl)
  const canRemove = Boolean(pendingFile || photoAttachmentId)

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Foto</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex size-28 shrink-0 items-center justify-center rounded-lg border bg-muted/20",
            hasPhoto ? "overflow-hidden" : "border-dashed"
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Foto del material"
              className="size-full object-cover"
            />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            disabled={disabled || isUploading || !canSelectFile}
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading || !canSelectFile}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading
              ? "Subiendo..."
              : hasPhoto
                ? "Reemplazar foto"
                : "Seleccionar foto"}
          </Button>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={disabled || isUploading}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 size-4" />
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Opcional. JPG, PNG o WebP.
        {canSelectBeforeCreate && !materialId
          ? " Se asociará al material al crearlo."
          : null}
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
    </div>
  )
}
