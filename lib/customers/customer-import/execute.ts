import type {
  CustomerImportExecutionResult,
  CustomerImportReportRow,
  CustomerImportReviewRow,
} from "@/lib/customers/customer-import/types"
import type { Customer, NewCustomerInput } from "@/lib/types/customers"

type CustomerMutationResult = {
  success: boolean
  message?: string
  customer?: Customer
}

function buildReportRow(
  row: CustomerImportReviewRow,
  resultado: string,
  error = "",
  sugerencia = ""
): CustomerImportReportRow {
  return {
    fila: row.rowNumber,
    resultado,
    error,
    sugerencia,
  }
}

function importRowToPayload(row: CustomerImportReviewRow): NewCustomerInput {
  const { data } = row

  return {
    name: data.name.trim(),
    externalCustomerCode: data.externalCustomerCode.trim() || undefined,
    phone: data.phone.trim() || undefined,
    email: data.email.trim() || undefined,
    address: data.address.trim() || undefined,
    locality: data.locality.trim() || undefined,
    technology: data.technology || undefined,
    status: data.status || "activo",
  }
}

export async function executeCustomerImport(input: {
  rows: CustomerImportReviewRow[]
  customers: Customer[]
  createCustomer: (payload: NewCustomerInput) => Promise<CustomerMutationResult>
}): Promise<CustomerImportExecutionResult> {
  const { rows, createCustomer } = input
  let customers = [...input.customers]

  const reportRows: CustomerImportReportRow[] = []
  let imported = 0
  let importedWithWarnings = 0
  let excluded = 0
  let failed = 0

  for (const row of rows) {
    if (!row.selected) {
      excluded += 1
      reportRows.push(
        buildReportRow(row, "Excluida", "", "Fila desmarcada por el usuario")
      )
      continue
    }

    if (row.status === "error") {
      excluded += 1
      const primaryIssue = row.issues.find((issue) => issue.level === "error")
      reportRows.push(
        buildReportRow(
          row,
          "Excluida",
          primaryIssue?.message ?? "Error de validación",
          primaryIssue?.suggestion ?? ""
        )
      )
      continue
    }

    try {
      const customerResult = await createCustomer(importRowToPayload(row))

      if (!customerResult.success || !customerResult.customer) {
        failed += 1
        reportRows.push(
          buildReportRow(
            row,
            "Error",
            customerResult.message ?? "No se pudo crear el cliente",
            "Revise los datos e intente nuevamente"
          )
        )
        continue
      }

      customers = [...customers, customerResult.customer]
      imported += 1

      if (row.status === "warning") {
        importedWithWarnings += 1
        reportRows.push(
          buildReportRow(
            row,
            "Importada con advertencias",
            row.issues.map((issue) => issue.message).join(" · "),
            "Revisar datos del cliente luego de la importación"
          )
        )
      } else {
        reportRows.push(buildReportRow(row, "Importada", "", ""))
      }
    } catch (error) {
      failed += 1
      reportRows.push(
        buildReportRow(
          row,
          "Error",
          error instanceof Error ? error.message : "Error inesperado",
          "Corrija la fila e intente nuevamente"
        )
      )
    }
  }

  void customers

  return {
    analyzed: rows.length,
    imported,
    importedWithWarnings,
    excluded,
    failed,
    reportRows,
  }
}
