import type { EmployeeIndividualReport } from "@/lib/reports/employee-individual/types"
import { EMPLOYMENT_STATUS_LABELS } from "@/lib/employees/constants"
import * as XLSX from "xlsx"

export const EMPLOYEE_REPORT_XLSX_FILE_NAME = "Reporte por Empleado"

const WORKBOOK_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function autoFitColumns(rows: unknown[][]): XLSX.ColInfo[] {
  const columnCount = Math.max(...rows.map((row) => row.length), 0)

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
      const value = row[columnIndex]
      const length = value == null ? 0 : String(value).length
      return Math.max(max, length)
    }, 10)

    return { wch: Math.min(Math.max(maxLength + 2, 12), 42) }
  })
}

export async function exportEmployeeIndividualReportXlsx(
  report: EmployeeIndividualReport
): Promise<Blob> {
  const workbook = XLSX.utils.book_new()

  const profileRows: unknown[][] = [
    ["Campo", "Valor"],
    ["Empleado", report.profile.displayName],
    ["Cargo", report.profile.jobTitle],
    ["Área", report.profile.areaLabel],
    ["Departamento", report.profile.department],
    ["Supervisor", report.profile.supervisorName ?? "—"],
    [
      "Estado",
      EMPLOYMENT_STATUS_LABELS[report.profile.employmentStatus],
    ],
    ["Fecha de ingreso", report.profile.hireDate ?? "—"],
    ["Período", report.periodLabel],
    ["Desde", report.startDate],
    ["Hasta", report.endDate],
  ]

  const kpiRows: unknown[][] = [
    ["Indicador", "Valor"],
    ...report.kpis.map((item) => [item.label, item.value]),
  ]

  const activityRows: unknown[][] = [
    [
      "Fecha",
      "Cliente",
      "OT / Ref.",
      "Tipo",
      "Estado",
      "Tiempo",
      "Resultado",
      "Supervisor",
    ],
    ...report.activity.map((row) => [
      row.date,
      row.customer,
      row.reference,
      row.type,
      row.status,
      row.durationLabel,
      row.result,
      row.supervisor,
    ]),
  ]

  for (const [name, rows] of [
    ["Perfil", profileRows],
    ["Indicadores", kpiRows],
    ["Actividad", activityRows],
  ] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet["!cols"] = autoFitColumns(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([buffer], { type: WORKBOOK_MIME })
}
