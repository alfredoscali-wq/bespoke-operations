"use client"

import { Download, ExternalLink, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatAttachmentFileSize,
  resolveAttachmentTypeEmoji,
} from "@/lib/attachments/format"
import type { Attachment } from "@/lib/types/attachments"
import { cn } from "@/lib/utils"

type AttachmentListProps = {
  attachments: Attachment[]
  canDelete?: boolean
  isBusy?: boolean
  onOpen: (attachment: Attachment) => void
  onDownload: (attachment: Attachment) => void
  onDelete?: (attachment: Attachment) => void
  className?: string
  compact?: boolean
}

export function AttachmentList({
  attachments,
  canDelete = false,
  isBusy = false,
  onOpen,
  onDownload,
  onDelete,
  className,
  compact = false,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {attachments.map((attachment) => {
        const emoji = resolveAttachmentTypeEmoji(attachment.mimeType)
        const createdLabel = new Date(attachment.createdAt).toLocaleString(
          "es-AR",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        )

        return (
          <li
            key={attachment.id}
            className={cn(
              "flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2",
              compact && "py-1.5"
            )}
          >
            <span className="mt-0.5 text-sm" aria-hidden>
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="block max-w-full truncate text-left text-[13px] font-medium text-sky-700 hover:underline"
                onClick={() => onOpen(attachment)}
              >
                {attachment.originalName}
              </button>
              {!compact ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatAttachmentFileSize(attachment.fileSize)}
                  {attachment.uploadedByName
                    ? ` · ${attachment.uploadedByName}`
                    : ""}
                  {` · ${createdLabel}`}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={isBusy}
                aria-label={`Abrir ${attachment.originalName}`}
                onClick={() => onOpen(attachment)}
              >
                <ExternalLink className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={isBusy}
                aria-label={`Descargar ${attachment.originalName}`}
                onClick={() => onDownload(attachment)}
              >
                <Download className="size-3.5" />
              </Button>
              {canDelete && onDelete ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive hover:text-destructive"
                  disabled={isBusy}
                  aria-label={`Eliminar ${attachment.originalName}`}
                  onClick={() => onDelete(attachment)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
