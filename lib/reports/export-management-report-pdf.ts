import { formatDateOnly } from "@/lib/dates/date-only"
import type { ManagementReport } from "@/lib/reports/management-report"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { jsPDF } from "jspdf"

export const MANAGEMENT_REPORT_PDF_FILE_NAME = "Reporte Gerencial"

const PAGE_MARGIN = 14
const LINE_HEIGHT = 7

function formatGeneratedDate(referenceDate = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")

  return `${pad(referenceDate.getDate())}/${pad(referenceDate.getMonth() + 1)}/${referenceDate.getFullYear()}`
}

function resolveTaskServiceTypeLabel(task: Task): string {
  const serviceType = task.serviceType?.trim()
  if (!serviceType) {
    return "—"
  }

  return (
    WORK_ORDER_SERVICE_TYPE_LABELS[serviceType as WorkOrderServiceType] ??
    serviceType
  )
}

function resolveTaskCustomerName(task: Task): string {
  return task.customerName?.trim() || task.title?.trim() || "—"
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
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

function writeDocumentHeader(doc: jsPDF, referenceDate: Date): void {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Reporte Gerencial", PAGE_MARGIN, 18)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Generado: ${formatGeneratedDate(referenceDate)}`, PAGE_MARGIN, 26)
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text(title, PAGE_MARGIN, y)
  doc.setFont("helvetica", "normal")
  return y + 10
}

function writeTableHeader(
  doc: jsPDF,
  y: number,
  headers: string[],
  columns: number[]
): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)

  headers.forEach((header, index) => {
    doc.text(header, columns[index], y)
  })

  doc.setFont("helvetica", "normal")
  return y + LINE_HEIGHT
}

export async function exportManagementReportPdf(
  report: ManagementReport,
  referenceDate = new Date()
): Promise<Blob> {
  const doc = new jsPDF()
  writeDocumentHeader(doc, referenceDate)

  let y = writeSectionTitle(doc, "Resumen Ejecutivo", 38)
  doc.setFontSize(11)

  const summaryRows: [string, string | number][] = [
    ["Órdenes Programadas", report.summary.scheduledOrders],
    ["Órdenes Completadas", report.summary.completedOrders],
    ["Cumplimiento %", report.summary.completionRate],
    ["Obras Activas", report.summary.activeProjects],
    ["Obras Vencidas", report.summary.overdueProjects],
    ["Obras en Riesgo", report.summary.riskProjects],
  ]

  for (const [label, value] of summaryRows) {
    y = ensureSpace(doc, y, LINE_HEIGHT)
    doc.text(`${label}: ${value}`, PAGE_MARGIN, y)
    y += LINE_HEIGHT
  }

  doc.addPage()
  y = writeSectionTitle(doc, "Productividad por Cuadrilla", PAGE_MARGIN + 6)
  const crewColumns = [PAGE_MARGIN, 88, 122, 156]
  y = writeTableHeader(
    doc,
    y,
    ["Cuadrilla", "Programadas", "Completadas", "Cumplimiento %"],
    crewColumns
  )

  if (report.crews.length === 0) {
    doc.text("Sin datos", PAGE_MARGIN, y)
  } else {
    for (const row of report.crews) {
      y = ensureSpace(doc, y, LINE_HEIGHT)
      doc.text(truncateText(row.crewName, 34), crewColumns[0], y)
      doc.text(String(row.programmed), crewColumns[1], y)
      doc.text(String(row.completed), crewColumns[2], y)
      doc.text(`${row.compliance}%`, crewColumns[3], y)
      y += LINE_HEIGHT
    }
  }

  doc.addPage()
  y = writeSectionTitle(doc, "Órdenes por Tipo", PAGE_MARGIN + 6)
  const typeColumns = [PAGE_MARGIN, 92, 150]
  y = writeTableHeader(
    doc,
    y,
    ["Tipo", "Etiqueta", "Cantidad"],
    typeColumns
  )

  if (report.ordersByType.length === 0) {
    doc.text("Sin datos", PAGE_MARGIN, y)
  } else {
    for (const row of report.ordersByType) {
      y = ensureSpace(doc, y, LINE_HEIGHT)
      doc.text(truncateText(row.serviceType, 18), typeColumns[0], y)
      doc.text(truncateText(row.label, 28), typeColumns[1], y)
      doc.text(String(row.count), typeColumns[2], y)
      y += LINE_HEIGHT
    }
  }

  doc.addPage()
  y = writeSectionTitle(doc, "Localidades", PAGE_MARGIN + 6)
  const localityColumns = [PAGE_MARGIN, 130]
  y = writeTableHeader(doc, y, ["Localidad", "Órdenes"], localityColumns)

  if (report.localities.length === 0) {
    doc.text("Sin datos", PAGE_MARGIN, y)
  } else {
    for (const row of report.localities) {
      y = ensureSpace(doc, y, LINE_HEIGHT)
      doc.text(truncateText(row.locality, 48), localityColumns[0], y)
      doc.text(String(row.count), localityColumns[1], y)
      y += LINE_HEIGHT
    }
  }

  doc.addPage()
  y = writeSectionTitle(doc, "Pendientes más Antiguas", PAGE_MARGIN + 6)
  const pendingColumns = [PAGE_MARGIN, 34, 78, 112, 142, 172]
  y = writeTableHeader(
    doc,
    y,
    ["Código", "Cliente", "Tipo", "Localidad", "Fecha", "Estado"],
    pendingColumns
  )

  if (report.oldestPendingOrders.length === 0) {
    doc.text("Sin datos", PAGE_MARGIN, y)
  } else {
    for (const task of report.oldestPendingOrders) {
      y = ensureSpace(doc, y, LINE_HEIGHT)
      doc.text(truncateText(task.code, 10), pendingColumns[0], y)
      doc.text(truncateText(resolveTaskCustomerName(task), 16), pendingColumns[1], y)
      doc.text(truncateText(resolveTaskServiceTypeLabel(task), 14), pendingColumns[2], y)
      doc.text(truncateText(task.locality?.trim() || "—", 12), pendingColumns[3], y)
      doc.text(formatDateOnly(task.dueDate), pendingColumns[4], y)
      doc.text(truncateText(TASK_STATUS_LABELS[task.status], 12), pendingColumns[5], y)
      y += LINE_HEIGHT
    }
  }

  return doc.output("blob")
}
