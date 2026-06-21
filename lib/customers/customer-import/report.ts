import type { CustomerImportReportRow } from "@/lib/customers/customer-import/types"
import * as XLSX from "xlsx"

export function buildImportReportCsv(reportRows: CustomerImportReportRow[]): Blob {
  const header = ["fila", "resultado", "error", "sugerencia"]
  const lines = [
    header.join(","),
    ...reportRows.map((row) =>
      [row.fila, row.resultado, row.error, row.sugerencia]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ]

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
}

export function buildImportReportWorkbook(
  reportRows: CustomerImportReportRow[]
): Blob {
  const worksheet = XLSX.utils.json_to_sheet(reportRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte")
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

export function downloadImportReport(
  reportRows: CustomerImportReportRow[],
  format: "csv" | "xlsx",
  fileName = "reporte-importacion-clientes"
) {
  const blob =
    format === "csv"
      ? buildImportReportCsv(reportRows)
      : buildImportReportWorkbook(reportRows)
  const extension = format === "csv" ? "csv" : "xlsx"
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${fileName}.${extension}`
  anchor.click()
  URL.revokeObjectURL(url)
}
