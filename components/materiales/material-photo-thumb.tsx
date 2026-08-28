"use client"

import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"

import { getAttachmentPreviewLink } from "@/lib/attachments/client"
import { cn } from "@/lib/utils"

type MaterialPhotoThumbProps = {
  photoAttachmentId?: string | null
  alt: string
  className?: string
  size?: "sm" | "lg"
}

export function MaterialPhotoThumb({
  photoAttachmentId,
  alt,
  className,
  size = "lg",
}: MaterialPhotoThumbProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!photoAttachmentId) {
        setPreviewUrl(null)
        return
      }
      const result = await getAttachmentPreviewLink(photoAttachmentId)
      if (!cancelled) {
        setPreviewUrl(result.success ? result.url : null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [photoAttachmentId])

  const dimension = size === "lg" ? "size-28" : "size-16"

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border bg-muted/20",
        dimension,
        previewUrl ? "overflow-hidden" : "border-dashed",
        className
      )}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt}
          className="size-full object-cover"
        />
      ) : (
        <ImageIcon className="size-8 text-muted-foreground/50" />
      )}
    </div>
  )
}
