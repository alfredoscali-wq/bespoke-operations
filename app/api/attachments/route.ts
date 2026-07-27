import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  canUploadAttachments,
  canViewAttachments,
  isAttachmentModule,
} from "@/lib/attachments"
import {
  getAttachmentPreviewUrl,
  listAttachments,
  uploadAttachment,
  validateAttachmentFile,
} from "@/lib/attachments/service.server"

export const runtime = "nodejs"

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, message, code },
    { status }
  )
}

export async function GET(request: Request) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return jsonError(auth.message, auth.status)
  }

  const companyId = auth.sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return jsonError("No se pudo resolver la empresa de la sesión.", 403)
  }

  const url = new URL(request.url)
  const module = url.searchParams.get("module")?.trim() ?? ""
  const recordId = url.searchParams.get("recordId")?.trim() ?? ""
  const timelineEventId =
    url.searchParams.get("timelineEventId")?.trim() || null
  const attachmentId = url.searchParams.get("id")?.trim() || null
  const preview = url.searchParams.get("preview") === "1"

  if (attachmentId && preview) {
    const result = await getAttachmentPreviewUrl({
      companyId,
      attachmentId,
    })
    if (result.error || !result.data) {
      return jsonError(
        result.error?.message ?? "No se pudo obtener el adjunto.",
        result.error?.code === "NOT_FOUND" ? 404 : 500,
        result.error?.code
      )
    }

    if (
      !canViewAttachments(auth.sessionUser, result.data.attachment.module)
    ) {
      return jsonError("No tiene permiso para ver adjuntos.", 403, "FORBIDDEN")
    }

    return NextResponse.json({
      success: true,
      url: result.data.url,
      attachment: result.data.attachment,
    })
  }

  if (!module || !isAttachmentModule(module)) {
    return jsonError("Módulo de adjunto inválido.", 400, "INVALID_MODULE")
  }
  if (!recordId) {
    return jsonError("recordId es obligatorio.", 400, "INVALID_RECORD")
  }
  if (!canViewAttachments(auth.sessionUser, module)) {
    return jsonError("No tiene permiso para ver adjuntos.", 403, "FORBIDDEN")
  }

  const result = await listAttachments({
    companyId,
    module,
    recordId,
    timelineEventId,
  })

  if (result.error || !result.data) {
    return jsonError(
      result.error?.message ?? "No se pudieron listar los adjuntos.",
      500,
      result.error?.code
    )
  }

  return NextResponse.json({ success: true, attachments: result.data })
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return jsonError(auth.message, auth.status)
  }

  const companyId = auth.sessionUser.companyId?.trim() ?? ""
  const employeeId = auth.sessionUser.employeeId?.trim() ?? ""
  if (!companyId || !employeeId) {
    return jsonError("No se pudo resolver el usuario operador.", 403)
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(
      "Content-Type debe ser multipart/form-data.",
      400,
      "INVALID_CONTENT_TYPE"
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError("No se pudo leer el formulario.", 400, "INVALID_FORM")
  }

  const moduleRaw = String(formData.get("module") ?? "").trim()
  const recordId = String(formData.get("recordId") ?? "").trim()
  const timelineEventIdRaw = String(formData.get("timelineEventId") ?? "").trim()
  const file = formData.get("file")

  if (!isAttachmentModule(moduleRaw)) {
    return jsonError("Módulo de adjunto inválido.", 400, "INVALID_MODULE")
  }
  if (!canUploadAttachments(auth.sessionUser, moduleRaw)) {
    return jsonError("No tiene permiso para subir adjuntos.", 403, "FORBIDDEN")
  }
  if (!recordId) {
    return jsonError("recordId es obligatorio.", 400, "INVALID_RECORD")
  }
  if (!(file instanceof File)) {
    return jsonError("Archivo obligatorio.", 400, "FILE_REQUIRED")
  }

  const validation = validateAttachmentFile({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  })
  if (!validation.ok) {
    return jsonError(validation.message, 400, "VALIDATION")
  }

  const result = await uploadAttachment({
    companyId,
    module: moduleRaw,
    recordId,
    timelineEventId: timelineEventIdRaw || null,
    uploadedBy: employeeId,
    file,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  })

  if (result.error || !result.data) {
    return jsonError(
      result.error?.message ?? "No se pudo subir el adjunto.",
      500,
      result.error?.code
    )
  }

  return NextResponse.json({ success: true, attachment: result.data }, { status: 201 })
}
