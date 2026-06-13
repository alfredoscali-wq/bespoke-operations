import type {
  EvidenceCategoryType,
  EvidenceFileType,
  EvidenceStatus,
} from "@/lib/types/evidence"
import { CREW_NAMES } from "@/lib/crews/constants"

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  "pending-review": "Pendiente de Revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
}

export const EVIDENCE_STATUS_STYLES: Record<EvidenceStatus, string> = {
  "pending-review": "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-red-50 text-red-700 border-red-100",
}

export const EVIDENCE_TYPE_LABELS: Record<EvidenceFileType, string> = {
  photo: "Foto",
  pdf: "PDF",
  plan: "Plano",
  video: "Video",
}

export const EVIDENCE_TYPE_STYLES: Record<EvidenceFileType, string> = {
  photo: "bg-blue-50 text-blue-700 border-blue-100",
  pdf: "bg-red-50 text-red-700 border-red-100",
  plan: "bg-violet-50 text-violet-700 border-violet-100",
  video: "bg-amber-50 text-amber-700 border-amber-100",
}

export const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCategoryType, string> = {
  "initial-photo": "Foto Inicial",
  "progress-photo": "Foto de Avance",
  "final-photo": "Foto Final",
  "otdr-certification": "Certificación OTDR",
  plan: "Plano",
  "client-document": "Documento Cliente",
}

export const EVIDENCE_CATEGORY_STYLES: Record<EvidenceCategoryType, string> = {
  "initial-photo": "bg-sky-50 text-sky-700 border-sky-100",
  "progress-photo": "bg-blue-50 text-blue-700 border-blue-100",
  "final-photo": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "otdr-certification": "bg-orange-50 text-orange-700 border-orange-100",
  plan: "bg-violet-50 text-violet-700 border-violet-100",
  "client-document": "bg-teal-50 text-teal-700 border-teal-100",
}

export const EVIDENCE_CATEGORY_OPTIONS = Object.entries(
  EVIDENCE_CATEGORY_LABELS
).map(([value, label]) => ({
  value: value as EvidenceCategoryType,
  label,
}))

export const PREVIEW_IMAGES = {
  fiber: "https://images.unsplash.com/photo-1558618666-fcd25c85cd82?w=1200&q=80",
  camera: "https://images.unsplash.com/photo-1557597774-9d2736050258?w=1200&q=80",
  pole: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80",
  trench: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80",
  document: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&q=80",
  plan: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80",
  wireless: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
  video: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
} as const

export const EVIDENCE_CREWS = CREW_NAMES

export const EVIDENCE_WORKERS = [
  "J. Ramírez",
  "M. Soto",
  "R. Vega",
  "L. Hernández",
  "Cuadrilla Alpha",
  "Cuadrilla Wireless",
] as const

export const EVIDENCE_FILE_TYPE_OPTIONS = [
  { value: "all" as const, label: "Todos los tipos" },
  { value: "photo" as const, label: "Fotos" },
  { value: "document" as const, label: "Documentos" },
  { value: "pdf" as const, label: "PDF" },
  { value: "plan" as const, label: "Planos" },
  { value: "video" as const, label: "Videos" },
]

export function formatEvidenceDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatEvidenceDateTime(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function isDocumentType(type: EvidenceFileType) {
  return type === "pdf" || type === "plan"
}
