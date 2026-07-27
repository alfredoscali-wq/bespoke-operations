"use client"

import { uploadAttachmentFile } from "@/lib/attachments/client"
import type { AttachmentModule } from "@/lib/attachments/constants"
import type { StagedAttachmentFile } from "@/components/attachments/attachment-uploader"

export async function uploadStagedAttachments(input: {
  module: AttachmentModule
  recordId: string
  timelineEventId: string | null | undefined
  files: StagedAttachmentFile[]
  onFileProgress?: (fileName: string, percent: number) => void
}): Promise<{ success: true } | { success: false; message: string }> {
  if (input.files.length === 0) {
    return { success: true }
  }

  if (!input.timelineEventId) {
    return {
      success: false,
      message:
        "El registro se guardó, pero no se pudo vincular los adjuntos al evento del timeline.",
    }
  }

  for (const staged of input.files) {
    const result = await uploadAttachmentFile({
      module: input.module,
      recordId: input.recordId,
      timelineEventId: input.timelineEventId,
      file: staged.file,
      onProgress: (percent) =>
        input.onFileProgress?.(staged.file.name, percent),
    })

    if (!result.success) {
      return {
        success: false,
        message: `Error al subir ${staged.file.name}: ${result.message}`,
      }
    }
  }

  return { success: true }
}
