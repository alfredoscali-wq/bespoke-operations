/**
 * Client-side export helpers for Actividad de la Jornada.
 * Reuses already-rendered screen data — no recalculation.
 */

import { formatActivityTimelineTime } from "@/lib/activity/activity-timeline-groups"
import type { DayGestion } from "@/lib/activity/day-gestiones"
import { jsPDF } from "jspdf"

export type DayActivityExportKpi = {
  label: string
  value: number
}

export type DayActivityExportPayload = {
  employeeName: string
  periodLabel: string
  periodRangeLabel: string
  productionTitle: string
  statusLabel: string
  startedAt: string
  lastActivityAt: string
  activeTimeLabel: string
  briefNarrative: string
  productionNarrative: string
  kpis: DayActivityExportKpi[]
  gestiones: DayGestion[]
  filterLabel: string
}

const PAGE_MARGIN = 14

function ensureSpace(doc: jsPDF, y: number, blockHeight: number): number {
  const bottom = doc.internal.pageSize.getHeight() - PAGE_MARGIN
  if (y + blockHeight > bottom) {
    doc.addPage()
    return PAGE_MARGIN + 8
  }
  return y
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

export function exportDayActivityExecutivePdf(
  payload: DayActivityExportPayload
): void {
  const doc = new jsPDF()
  let y = 18

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Informe Ejecutivo — Actividad de la Jornada", PAGE_MARGIN, y)
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Empleado: ${payload.employeeName}`, PAGE_MARGIN, y)
  y += 5
  doc.text(`Período: ${payload.periodLabel} (${payload.periodRangeLabel})`, PAGE_MARGIN, y)
  y += 5
  doc.text(`Estado: ${payload.statusLabel}`, PAGE_MARGIN, y)
  y += 5
  doc.text(`Inicio: ${payload.startedAt} · Última actividad: ${payload.lastActivityAt}`, PAGE_MARGIN, y)
  y += 5
  doc.text(`Tiempo activo: ${payload.activeTimeLabel}`, PAGE_MARGIN, y)
  y += 8

  const briefLines = doc.splitTextToSize(payload.briefNarrative, 180)
  y = ensureSpace(doc, y, briefLines.length * 5 + 4)
  doc.setFont("helvetica", "italic")
  doc.text(briefLines, PAGE_MARGIN, y)
  y += briefLines.length * 5 + 6

  doc.setFont("helvetica", "bold")
  doc.text(payload.productionTitle, PAGE_MARGIN, y)
  y += 7
  doc.setFont("helvetica", "normal")
  for (const kpi of payload.kpis) {
    y = ensureSpace(doc, y, 5)
    doc.text(`${kpi.label}: ${kpi.value}`, PAGE_MARGIN, y)
    y += 5
  }

  y += 4
  const prodLines = doc.splitTextToSize(payload.productionNarrative, 180)
  y = ensureSpace(doc, y, prodLines.length * 5 + 6)
  doc.text(prodLines, PAGE_MARGIN, y)
  y += prodLines.length * 5 + 8

  doc.setFont("helvetica", "bold")
  doc.text(
    `Gestiones realizadas${payload.filterLabel ? ` (${payload.filterLabel})` : ""}`,
    PAGE_MARGIN,
    y
  )
  y += 7
  doc.setFont("helvetica", "normal")

  if (payload.gestiones.length === 0) {
    doc.text("Sin gestiones para el filtro aplicado.", PAGE_MARGIN, y)
  } else {
    for (const gestion of payload.gestiones) {
      const time = formatActivityTimelineTime(gestion.startedAt)
      const fieldLine = gestion.fields
        .map((field) => `${field.label}: ${field.value}`)
        .join(" · ")
      const block = doc.splitTextToSize(
        `${time} — ${gestion.title} [${gestion.statusLabel}]${fieldLine ? ` · ${fieldLine}` : ""}`,
        180
      )
      y = ensureSpace(doc, y, block.length * 5 + 3)
      doc.text(block, PAGE_MARGIN, y)
      y += block.length * 5 + 3
    }
  }

  const filename = `informe-ejecutivo-${sanitizeFilename(payload.employeeName)}-${sanitizeFilename(payload.periodLabel)}.pdf`
  downloadBlob(doc.output("blob"), filename)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportDayActivityGestionesCsv(
  gestiones: DayGestion[],
  meta: { employeeName: string; periodLabel: string }
): void {
  const header = [
    "Hora",
    "Título",
    "Estado",
    "Dominio",
    "Campos",
  ]

  const rows = gestiones.map((gestion) => [
    formatActivityTimelineTime(gestion.startedAt),
    gestion.title,
    gestion.statusLabel,
    gestion.domain === "attention" ? "Atención" : "General",
    gestion.fields.map((field) => `${field.label}=${field.value}`).join("; "),
  ])

  const lines = [header, ...rows].map((cols) =>
    cols.map((col) => csvEscape(String(col))).join(",")
  )
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  })
  const filename = `gestiones-${sanitizeFilename(meta.employeeName)}-${sanitizeFilename(meta.periodLabel)}.csv`
  downloadBlob(blob, filename)
}
