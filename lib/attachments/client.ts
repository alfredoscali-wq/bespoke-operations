"use client"

export async function uploadAttachmentFile(input: {
  module: string
  recordId: string
  timelineEventId?: string | null
  file: File
  onProgress?: (percent: number) => void
}): Promise<{ success: true; attachment: unknown } | { success: false; message: string }> {
  const formData = new FormData()
  formData.set("module", input.module)
  formData.set("recordId", input.recordId)
  if (input.timelineEventId) {
    formData.set("timelineEventId", input.timelineEventId)
  }
  formData.set("file", input.file)

  // Native fetch has no upload progress; signal start/end for UX.
  input.onProgress?.(10)

  const response = await fetch("/api/attachments", {
    method: "POST",
    body: formData,
  })

  input.onProgress?.(90)

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; attachment?: unknown; message?: string }
    | null

  if (!response.ok || !payload?.success) {
    return {
      success: false,
      message: payload?.message ?? "No se pudo subir el archivo.",
    }
  }

  input.onProgress?.(100)
  return { success: true, attachment: payload.attachment }
}

export async function listAttachmentFiles(input: {
  module: string
  recordId: string
  timelineEventId?: string | null
}): Promise<{ success: true; attachments: unknown[] } | { success: false; message: string }> {
  const params = new URLSearchParams({
    module: input.module,
    recordId: input.recordId,
  })
  if (input.timelineEventId) {
    params.set("timelineEventId", input.timelineEventId)
  }

  const response = await fetch(`/api/attachments?${params.toString()}`)
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; attachments?: unknown[]; message?: string }
    | null

  if (!response.ok || !payload?.success || !Array.isArray(payload.attachments)) {
    return {
      success: false,
      message: payload?.message ?? "No se pudieron cargar los adjuntos.",
    }
  }

  return { success: true, attachments: payload.attachments }
}

export async function getAttachmentPreviewLink(attachmentId: string): Promise<
  | { success: true; url: string }
  | { success: false; message: string }
> {
  const params = new URLSearchParams({
    id: attachmentId,
    preview: "1",
  })
  const response = await fetch(`/api/attachments?${params.toString()}`)
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; url?: string; message?: string }
    | null

  if (!response.ok || !payload?.success || !payload.url) {
    return {
      success: false,
      message: payload?.message ?? "No se pudo abrir el archivo.",
    }
  }

  return { success: true, url: payload.url }
}

export async function deleteAttachmentFile(attachmentId: string): Promise<
  | { success: true }
  | { success: false; message: string }
> {
  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
  })
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string }
    | null

  if (!response.ok || !payload?.success) {
    return {
      success: false,
      message: payload?.message ?? "No se pudo eliminar el archivo.",
    }
  }

  return { success: true }
}
