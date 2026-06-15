import type {
  EvidenceCategoryType,
  EvidenceRecord,
  EvidenceUploadEvent,
} from "@/lib/types/evidence"
import { PREVIEW_IMAGES } from "@/lib/evidence/constants"

export type BaseEvidenceRecord = Omit<
  EvidenceRecord,
  "evidenceType" | "previewUrl" | "uploadHistory"
>

const EVIDENCE_TYPE_MAP: Record<string, EvidenceCategoryType> = {
  "ev-001": "initial-photo",
  "ev-002": "otdr-certification",
  "ev-003": "progress-photo",
  "ev-004": "plan",
  "ev-005": "progress-photo",
  "ev-006": "progress-photo",
  "ev-007": "client-document",
  "ev-008": "final-photo",
  "ev-009": "initial-photo",
  "ev-010": "otdr-certification",
  "ev-011": "final-photo",
  "ev-012": "progress-photo",
  "ev-013": "initial-photo",
  "ev-014": "plan",
  "ev-015": "initial-photo",
  "ev-016": "progress-photo",
  "ev-017": "plan",
  "ev-018": "progress-photo",
}

const PREVIEW_URL_MAP: Record<string, string> = {
  "ev-001": PREVIEW_IMAGES.fiber,
  "ev-002": PREVIEW_IMAGES.document,
  "ev-003": PREVIEW_IMAGES.camera,
  "ev-004": PREVIEW_IMAGES.plan,
  "ev-005": PREVIEW_IMAGES.pole,
  "ev-006": PREVIEW_IMAGES.trench,
  "ev-007": PREVIEW_IMAGES.document,
  "ev-008": PREVIEW_IMAGES.wireless,
  "ev-009": PREVIEW_IMAGES.pole,
  "ev-010": PREVIEW_IMAGES.document,
  "ev-011": PREVIEW_IMAGES.fiber,
  "ev-012": PREVIEW_IMAGES.camera,
  "ev-013": PREVIEW_IMAGES.pole,
  "ev-014": PREVIEW_IMAGES.plan,
  "ev-015": PREVIEW_IMAGES.fiber,
  "ev-016": PREVIEW_IMAGES.video,
  "ev-017": PREVIEW_IMAGES.plan,
  "ev-018": PREVIEW_IMAGES.trench,
}

function resolvePreviewUrl(record: BaseEvidenceRecord): string {
  if (PREVIEW_URL_MAP[record.id]) return PREVIEW_URL_MAP[record.id]
  if (record.type === "photo") return PREVIEW_IMAGES.fiber
  if (record.type === "video") return PREVIEW_IMAGES.video
  if (record.type === "plan") return PREVIEW_IMAGES.plan
  return PREVIEW_IMAGES.document
}

function buildUploadHistory(record: BaseEvidenceRecord): EvidenceUploadEvent[] {
  const history: EvidenceUploadEvent[] = [
    {
      id: `${record.id}-upload`,
      action: "Archivo cargado",
      user: record.worker,
      timestamp: record.uploadedAt,
      note: record.fileName,
      ...(record.uploadedByRole ? { role: record.uploadedByRole } : {}),
    },
    {
      id: `${record.id}-queue`,
      action: "Enviado a revisión",
      user: "Sistema",
      timestamp: record.uploadedAt,
      note: "Pendiente de validación por supervisión",
    },
  ]

  record.comments.forEach((comment, index) => {
    history.push({
      id: `${record.id}-comment-${index}`,
      action: "Comentario registrado",
      user: comment.author,
      timestamp: comment.timestamp,
      note: comment.content,
    })
  })

  if (record.status === "approved") {
    history.push({
      id: `${record.id}-approved`,
      action: "Evidencia aprobada",
      user: "Supervisión",
      timestamp: new Date(
        new Date(record.uploadedAt).getTime() + 86400000
      ).toISOString(),
      note: "Validación completada",
    })
  }

  if (record.status === "rejected") {
    const rejectionComment = record.comments.find((c) =>
      c.content.toLowerCase().includes("repetir")
    )
    history.push({
      id: `${record.id}-rejected`,
      action: "Evidencia rechazada",
      user: "Supervisión",
      timestamp: rejectionComment?.timestamp ?? record.uploadedAt,
      note: rejectionComment?.content ?? "Requiere corrección",
    })
  }

  return history.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export function enrichEvidenceRecords(
  records: BaseEvidenceRecord[]
): EvidenceRecord[] {
  return records.map((record) => ({
    ...record,
    evidenceType:
      EVIDENCE_TYPE_MAP[record.id] ??
      (record.type === "plan"
        ? "plan"
        : record.type === "pdf"
          ? "client-document"
          : "progress-photo"),
    previewUrl: resolvePreviewUrl(record),
    uploadHistory: buildUploadHistory(record),
    uploadedByRole: record.uploadedByRole,
  }))
}

export function appendUploadHistoryEvent(
  record: EvidenceRecord,
  event: Omit<EvidenceUploadEvent, "id">
): EvidenceUploadEvent[] {
  return [
    {
      id: `ev-h-${Date.now()}`,
      ...event,
    },
    ...record.uploadHistory,
  ]
}
