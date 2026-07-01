import { formatDateOnly } from "@/lib/dates/date-only"
import type { ManagementReport } from "@/lib/reports/management-report"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import * as XLSX from "xlsx"

export const MANAGEMENT_REPORT_XLSX_FILE_NAME = "Reporte Gerencial"

const WORKBOOK_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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

function resolveTaskDisplayName(task: Task): string {
  return task.customerName?.trim() || task.title?.trim() || "—"
}

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

function appendSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  rows: unknown[][]
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = autoFitColumns(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
}

export async function exportManagementReportXlsx(
  report: ManagementReport
): Promise<Blob> {
  const workbook = XLSX.utils.book_new()
  const { summary } = report

  appendSheet(workbook, "Resumen", [
    ["Métrica", "Valor"],
    ["Órdenes Programadas", summary.scheduledOrders],
    ["Órdenes Completadas", summary.completedOrders],
    ["Cumplimiento %", summary.completionRate],
    ["Obras Activas", summary.activeProjects],
    ["Obras Vencidas", summary.overdueProjects],
    ["Obras en Riesgo", summary.riskProjects],
  ])

  appendSheet(workbook, "Cuadrillas", [
    [
      "Cuadrilla ID",
      "Cuadrilla",
      "Programadas",
      "Completadas",
      "Canceladas",
      "Cumplimiento %",
    ],
    ...report.crews.map((row) => [
      row.crewId,
      row.crewName,
      row.programmed,
      row.completed,
      row.cancelled,
      row.compliance,
    ]),
  ])

  appendSheet(workbook, "Órdenes por Tipo", [
    ["Tipo", "Etiqueta", "Cantidad"],
    ...report.ordersByType.map((row) => [row.serviceType, row.label, row.count]),
  ])

  appendSheet(workbook, "Localidades", [
    ["Localidad", "Órdenes"],
    ...report.localities.map((row) => [row.locality, row.count]),
  ])

  appendSheet(workbook, "Pendientes", [
    ["Ruta", "Código", "Nombre", "Tipo", "Localidad", "Fecha", "Estado"],
    ...report.oldestPendingOrders.map((task) => [
      resolveTaskRouteOrder(task) ?? "—",
      task.code,
      resolveTaskDisplayName(task),
      resolveTaskServiceTypeLabel(task),
      task.locality?.trim() || "—",
      formatDateOnly(task.dueDate),
      TASK_STATUS_LABELS[task.status],
    ]),
  ])

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

  return new Blob([buffer], { type: WORKBOOK_MIME })
}
