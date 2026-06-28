import fs from "node:fs"
import path from "node:path"

import { formatDateOnly } from "@/lib/dates/date-only"
import {
  WEEKLY_REPORT_SITE_URL,
} from "@/lib/reports/automatic/config"
import type { WeeklyAutomaticReport } from "@/lib/reports/automatic/types"
import { jsPDF } from "jspdf"

const PAGE_MARGIN = 16
const LINE_HEIGHT = 6
const CARD_GAP = 4
const BRAND_RGB = { r: 30, g: 77, b: 140 }

function loadLogoDataUrl(): string | null {
  const publicRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "public")
  const candidates = [
    path.join(publicRoot, "images", "logo", "LOGO_BESPOKE.png"),
    path.join(publicRoot, "icons", "icon-512x512.png"),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue
    }

    const buffer = fs.readFileSync(filePath)
    const extension = path.extname(filePath).slice(1).toLowerCase()
    const mime = extension === "png" ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${buffer.toString("base64")}`
  }

  return null
}

function formatGeneratedTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const pad = (entry: number) => String(entry).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getPageBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - PAGE_MARGIN
}

function ensureSpace(doc: jsPDF, y: number, blockHeight: number): number {
  if (y + blockHeight > getPageBottom(doc)) {
    doc.addPage()
    return PAGE_MARGIN + 8
  }

  return y
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(BRAND_RGB.r, BRAND_RGB.g, BRAND_RGB.b)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(title, PAGE_MARGIN, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  return y + 10
}

function writeCoverPage(doc: jsPDF, report: WeeklyAutomaticReport): void {
  const logo = loadLogoDataUrl()
  let y = PAGE_MARGIN + 6

  if (logo) {
    doc.addImage(logo, "PNG", PAGE_MARGIN, y, 42, 14)
    y += 24
  } else {
    y += 8
  }

  doc.setTextColor(BRAND_RGB.r, BRAND_RGB.g, BRAND_RGB.b)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text(report.title, PAGE_MARGIN, y)
  y += 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "normal")
  doc.text(report.subtitle, PAGE_MARGIN, y)
  y += 18

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(11)
  doc.text(`Empresa: ${report.companyName}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT + 2
  doc.text(`Semana informada: ${report.informedWeekLabel}`, PAGE_MARGIN, y)
  y += LINE_HEIGHT + 2
  doc.text(
    `Fecha de generación: ${formatGeneratedTimestamp(report.generatedAt)}`,
    PAGE_MARGIN,
    y
  )
}

function writeKpiCards(
  doc: jsPDF,
  cards: { label: string; value: string }[],
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - PAGE_MARGIN * 2
  const columns = 3
  const cardWidth = (contentWidth - CARD_GAP * (columns - 1)) / columns
  const cardHeight = 18

  let y = startY
  let column = 0
  let rowY = y

  for (const card of cards) {
    const x = PAGE_MARGIN + column * (cardWidth + CARD_GAP)
    rowY = ensureSpace(doc, y, cardHeight + CARD_GAP)

    if (rowY !== y) {
      column = 0
      y = rowY
    }

    const drawY = y
    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, drawY, cardWidth, cardHeight, 2, 2, "FD")

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    doc.text(card.label, x + 3, drawY + 6)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(BRAND_RGB.r, BRAND_RGB.g, BRAND_RGB.b)
    doc.text(card.value, x + 3, drawY + 14)

    column += 1
    if (column >= columns) {
      column = 0
      y += cardHeight + CARD_GAP
    }
  }

  if (column !== 0) {
    y += cardHeight + CARD_GAP
  }

  doc.setTextColor(0, 0, 0)
  return y + 4
}

function writeTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  columnWidths: number[],
  startY: number
): number {
  let y = ensureSpace(doc, startY, LINE_HEIGHT + 4)

  doc.setFillColor(BRAND_RGB.r, BRAND_RGB.g, BRAND_RGB.b)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)

  let x = PAGE_MARGIN
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)
  doc.rect(PAGE_MARGIN, y - 4, tableWidth, LINE_HEIGHT + 2, "F")

  headers.forEach((header, index) => {
    doc.text(header, x + 1, y)
    x += columnWidths[index]
  })

  y += LINE_HEIGHT + 2
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")

  for (const row of rows) {
    y = ensureSpace(doc, y, LINE_HEIGHT + 2)
    x = PAGE_MARGIN
    row.forEach((cell, index) => {
      doc.text(cell, x + 1, y)
      x += columnWidths[index]
    })
    y += LINE_HEIGHT + 1
  }

  return y + 6
}

function writeBulletList(
  doc: jsPDF,
  title: string,
  items: { label: string; value: string }[],
  startY: number
): number {
  let y = writeSectionTitle(doc, title, startY)
  doc.setFontSize(10)

  for (const item of items) {
    y = ensureSpace(doc, y, LINE_HEIGHT + 2)
    doc.text(`• ${item.label}: ${item.value}`, PAGE_MARGIN + 2, y)
    y += LINE_HEIGHT + 1
  }

  return y + 4
}

function writeFooter(doc: jsPDF, report: WeeklyAutomaticReport): void {
  const pageCount = doc.getNumberOfPages()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const bottom = doc.internal.pageSize.getHeight() - 8
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      "Generado automáticamente por Bespoke Operations",
      PAGE_MARGIN,
      bottom
    )
    doc.text(WEEKLY_REPORT_SITE_URL, PAGE_MARGIN, bottom + 4)
    doc.text(
      `Emisión: ${formatGeneratedTimestamp(report.generatedAt)}`,
      doc.internal.pageSize.getWidth() - PAGE_MARGIN - 50,
      bottom + 4
    )
    doc.text(
      `Página ${page} / ${pageCount}`,
      doc.internal.pageSize.getWidth() - PAGE_MARGIN - 18,
      bottom
    )
  }
}

function formatHours(value: number | null): string {
  if (value == null) {
    return "—"
  }

  return `${value} h`
}

export function buildWeeklyReportPdf(report: WeeklyAutomaticReport): Uint8Array {
  const doc = new jsPDF()
  writeCoverPage(doc, report)

  doc.addPage()
  let y = PAGE_MARGIN + 4
  y = writeSectionTitle(doc, "1. Resumen Ejecutivo", y)

  y = writeKpiCards(doc, [
    { label: "Clientes activos", value: String(report.summary.activeCustomers) },
    {
      label: "Clientes inactivos",
      value: String(report.summary.inactiveCustomers),
    },
    { label: "Obras activas", value: String(report.summary.activeProjects) },
    { label: "Órdenes de trabajo creadas", value: String(report.summary.tasksCreated) },
    { label: "Órdenes de trabajo finalizadas", value: String(report.summary.tasksCompleted) },
    { label: "Órdenes de trabajo pendientes", value: String(report.summary.tasksPending) },
    { label: "Órdenes de trabajo vencidas", value: String(report.summary.tasksOverdue) },
    {
      label: "Cumplimiento semanal",
      value: `${report.summary.weeklyCompliancePercent}%`,
    },
    {
      label: "Tiempo promedio resolución",
      value: formatHours(report.summary.averageResolutionHours),
    },
  ], y)

  y = ensureSpace(doc, y, 40)
  y = writeSectionTitle(doc, "2. Rendimiento por Cuadrilla", y)

  const crewRows = report.crewPerformance.map((row) => [
    row.crewName,
    row.supervisor,
    String(row.assigned),
    String(row.completed),
    String(row.pending),
    String(row.overdue),
    `${row.compliancePercent}%`,
    formatHours(row.averageResolutionHours),
  ])

  y = writeTable(
    doc,
    [
      "Cuadrilla",
      "Supervisor",
      "Asign.",
      "Final.",
      "Pend.",
      "Venc.",
      "Cumpl.",
      "T. prom.",
    ],
    crewRows.length > 0
      ? crewRows
      : [["—", "—", "0", "0", "0", "0", "0%", "—"]],
    [34, 28, 14, 14, 14, 14, 16, 16],
    y
  )

  y = ensureSpace(doc, y, 40)
  y = writeBulletList(
    doc,
    "3. Producción",
    [
      {
        label: "Instalaciones nuevas",
        value: String(report.production.instalacionNueva),
      },
      {
        label: "Cambios de domicilio",
        value: String(report.production.cambioDomicilio),
      },
      {
        label: "Cambios de tecnología",
        value: String(report.production.cambioTecnologia),
      },
      {
        label: "Servicios técnicos",
        value: String(report.production.serviceTecnico),
      },
      { label: "Reconexiones", value: String(report.production.reconexion) },
      { label: "Bajas", value: String(report.production.baja) },
    ],
    y
  )

  y = ensureSpace(doc, y, 40)
  y = writeBulletList(
    doc,
    "4. Alertas",
    [
      { label: "Órdenes de trabajo vencidas", value: String(report.alerts.overdueTasks) },
      {
        label: "Órdenes de trabajo pendientes de cierre",
        value: String(report.alerts.pendingApprovalTasks),
      },
      {
        label: "Incidencias abiertas",
        value: String(report.alerts.openIncidents),
      },
      {
        label: "Operarios ausentes",
        value: String(report.alerts.absentOperarios),
      },
      {
        label: "Obras detenidas",
        value: String(report.alerts.stoppedProjects),
      },
    ],
    y
  )

  y = ensureSpace(doc, y, 30)
  y = writeSectionTitle(doc, "5. Resumen Automático", y)
  doc.setFontSize(10)
  const narrativeLines = doc.splitTextToSize(
    report.narrativeSummary,
    doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2
  )

  for (const line of narrativeLines) {
    y = ensureSpace(doc, y, LINE_HEIGHT + 2)
    doc.text(line, PAGE_MARGIN, y)
    y += LINE_HEIGHT + 1
  }

  writeFooter(doc, report)

  return new Uint8Array(doc.output("arraybuffer"))
}

export function buildWeeklyReportPdfFileName(report: WeeklyAutomaticReport): string {
  const week = String(report.weekNumber).padStart(2, "0")
  const stamp = formatDateOnly(report.informedWeek.endDate).replace(/\//g, "-")
  return `Bespoke-Weekly-Report-Semana-${week}-${stamp}.pdf`
}
