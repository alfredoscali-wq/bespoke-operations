"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resolveAttachmentPreviewKind } from "@/lib/attachments/format"
import type { Attachment } from "@/lib/types/attachments"

type AttachmentPreviewProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: Attachment | null
  url: string | null
}

export function AttachmentPreview({
  open,
  onOpenChange,
  attachment,
  url,
}: AttachmentPreviewProps) {
  if (!attachment) {
    return null
  }

  const kind = resolveAttachmentPreviewKind(attachment.mimeType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {attachment.originalName}
          </DialogTitle>
          <DialogDescription>
            Vista previa del archivo adjunto.
          </DialogDescription>
        </DialogHeader>

        {!url ? (
          <p className="text-sm text-muted-foreground">Cargando vista previa…</p>
        ) : kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={attachment.originalName}
            className="max-h-[70vh] w-full rounded-md object-contain"
          />
        ) : kind === "audio" ? (
          <audio controls className="w-full" src={url}>
            Tu navegador no soporta audio.
          </audio>
        ) : kind === "video" ? (
          <video controls className="max-h-[70vh] w-full rounded-md" src={url}>
            Tu navegador no soporta video.
          </video>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Este tipo de archivo se abre fuera del expediente.</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:underline"
            >
              Abrir / descargar {attachment.originalName}
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export async function openAttachmentInBrowser(input: {
  attachment: Attachment
  url: string
}): Promise<void> {
  const kind = resolveAttachmentPreviewKind(input.attachment.mimeType)
  if (kind === "pdf" || kind === "file") {
    window.open(input.url, "_blank", "noopener,noreferrer")
    return
  }

  // Images/audio/video prefer in-app preview via AttachmentPreview.
}
