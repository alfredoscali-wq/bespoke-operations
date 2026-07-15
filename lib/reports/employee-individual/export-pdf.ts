import { formatDateOnly } from "@/lib/dates/date-only"
import type { EmployeeIndividualReport } from "@/lib/reports/employee-individual/types"
import { EMPLOYMENT_STATUS_LABELS } from "@/lib/employees/constants"
import { jsPDF } from "jspdf"

export const EMPLOYEE_REPORT_PDF_FILE_NAME = "Reporte por Empleado"

const PAGE_MARGIN = 14

function ensureSpace(doc: jsPDF, y: number, blockHeight: number): number {
  const bottom = doc.internal.pageSize.getHeight() - PAGE_MARGIN
  if (y + blockHeight > bottom) {
    doc.addPage()
    return PAGE_MARGIN + 8
  }
  return y
}

export async function exportEmployeeIndividualReportPdf(
  report: EmployeeIndividualReport
): Promise<Blob> {
  const doc = new jsPDF()
  let y = 18

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Reporte por Empleado", PAGE_MARGIN, y)
  y += 8

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Empleado: ${report.profile.displayName}`, PAGE_MARGIN, y)
  y += 6
  doc.text(
    `Cargo: ${report.profile.jobTitle} · Área: ${report.profile.areaLabel}`,
    PAGE_MARGIN,
    y
  )
  y += 6
  doc.text(
    `Estado: ${EMPLOYMENT_STATUS_LABELS[report.profile.employmentStatus]} · Ingreso: ${
      report.profile.hireDate
        ? formatDateOnly(report.profile.hireDate)
        : "—"
    }`,
    PAGE_MARGIN,
    y
  )
  y += 6
  doc.text(
    `Período: ${report.periodLabel} (${report.startDate} → ${report.endDate})`,
    PAGE_MARGIN,
    y
  )
  y += 10

  doc.setFont("helvetica", "bold")
  doc.text("Indicadores", PAGE_MARGIN, y)
  y += 7
  doc.setFont("helvetica", "normal")

  for (const item of report.kpis) {
    y = ensureSpace(doc, y, 6)
    doc.text(`${item.label}: ${item.value}`, PAGE_MARGIN, y)
    y += 5
  }

  y += 6
  y = ensureSpace(doc, y, 10)
  doc.setFont("helvetica", "bold")
  doc.text("Actividad", PAGE_MARGIN, y)
  y += 7
  doc.setFont("helvetica", "normal")

  for (const row of report.activity.slice(0, 80)) {
    y = ensureSpace(doc, y, 12)
    doc.text(
      `${row.date} · ${row.reference} · ${row.customer}`,
      PAGE_MARGIN,
      y
    )
    y += 5
    doc.text(
      `${row.type} · ${row.status} · ${row.result}`,
      PAGE_MARGIN + 2,
      y
    )
    y += 6
  }

  return doc.output("blob")
}
