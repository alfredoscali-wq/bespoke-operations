import { EMPLOYEE_IMPORT_TEMPLATE_HEADERS } from "@/lib/employees/employee-import/columns"
import * as XLSX from "xlsx"

export type EmployeeImportTemplateOptions = {
  fileName?: string
}

export function downloadEmployeeImportTemplate(
  options: EmployeeImportTemplateOptions = {}
) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...EMPLOYEE_IMPORT_TEMPLATE_HEADERS],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "empleados")

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${options.fileName ?? "plantilla-importacion-rrhh"}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}
