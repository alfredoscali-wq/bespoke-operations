import type {
  AutomaticReportHistoryEntryDto,
  WeeklyReportRunStatusDto,
} from "@/lib/reports/automatic/client-types"
import { AUTOMATIC_REPORT_HISTORY_STATUS_LABELS } from "@/lib/reports/automatic/client-types"

export function formatAutomaticReportTimestamp(
  value: string | null | undefined
): string {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const pad = (entry: number) => String(entry).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function resolveAutomaticReportHistoryStatusLabel(
  entry: Pick<AutomaticReportHistoryEntryDto, "status" | "errorMessage">
): string {
  if (entry.errorMessage?.trim()) {
    return entry.errorMessage
  }

  return AUTOMATIC_REPORT_HISTORY_STATUS_LABELS[entry.status] ?? "—"
}

export function resolveAutomaticReportStatusLabel(
  status: WeeklyReportRunStatusDto | null
): string {
  if (!status?.status || status.status === "never_run") {
    return "Sin ejecuciones"
  }

  if (status.message?.trim()) {
    return status.message
  }

  switch (status.status) {
    case "sent":
      return "Enviado correctamente"
    case "generated":
      return "Generado correctamente"
    case "email_failed":
      return "PDF generado — correo no enviado"
    case "error":
      return "Error en la generación"
    default:
      return "—"
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

export function downloadWeeklyReportPdf(input: {
  pdfBase64: string
  fileName: string
}) {
  const blob = base64ToBlob(input.pdfBase64, "application/pdf")
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = input.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createWeeklyReportPreviewUrl(pdfBase64: string): string {
  const blob = base64ToBlob(pdfBase64, "application/pdf")
  return URL.createObjectURL(blob)
}
