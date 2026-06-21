import {
  checkBatchDuplicates,
  checkNameWithoutPhoneDuplicate,
  createBatchDuplicateState,
  findCustomerByExactName,
  findCustomerByExternalCode,
  findCustomerByNameAndPhone,
  normalizeImportRowData,
  registerBatchRow,
} from "@/lib/customers/customer-import/duplicates"
import {
  isValidImportEmail,
  resolveImportStatus,
  resolveImportTechnology,
} from "@/lib/customers/customer-import/normalize"
import type {
  ImportIssue,
  ImportValidationLevel,
  CustomerImportReviewRow,
  CustomerImportRowData,
  CustomerImportSummary,
} from "@/lib/customers/customer-import/types"
import type { Customer } from "@/lib/types/customers"

export type ImportValidationContext = {
  customers: Customer[]
}

function resolveRowStatus(issues: ImportIssue[]): ImportValidationLevel {
  if (issues.some((issue) => issue.level === "error")) {
    return "error"
  }

  if (issues.some((issue) => issue.level === "warning")) {
    return "warning"
  }

  return "valid"
}

function mergeIssues(...groups: ImportIssue[][]): ImportIssue[] {
  return groups.flat()
}

export function validateImportRow(
  rowNumber: number,
  data: CustomerImportRowData,
  context: ImportValidationContext,
  batchIssues: ImportIssue[] = []
): ImportIssue[] {
  const issues: ImportIssue[] = [...batchIssues]

  if (!data.name.trim()) {
    issues.push({
      level: "error",
      field: "name",
      message: "Nombre vacío",
      suggestion: "Complete la columna nombre",
    })
  }

  const externalCode = data.externalCustomerCode.trim()
  if (externalCode) {
    const existing = findCustomerByExternalCode(context.customers, externalCode)
    if (existing) {
      issues.push({
        level: "error",
        field: "externalCustomerCode",
        message: "codigo_externo ya registrado en la base",
        suggestion: "Use un código externo distinto o actualice el cliente existente",
      })
    }
  }

  if (data.phone.trim() && data.name.trim()) {
    const existing = findCustomerByNameAndPhone(
      context.customers,
      data.name,
      data.phone
    )
    if (existing) {
      issues.push({
        level: "error",
        field: "name",
        message: "Cliente ya registrado con el mismo nombre y teléfono",
        suggestion: "Verifique si el cliente ya existe antes de importar",
      })
    }
  }

  if (!data.phone.trim() && data.name.trim()) {
    const existing = findCustomerByExactName(context.customers, data.name)
    if (existing) {
      issues.push({
        level: "warning",
        field: "name",
        message: "Ya existe un cliente con el mismo nombre en la base",
        suggestion: "Verifique si se trata del mismo cliente o de un homónimo",
      })
    }
  }

  if (data.email.trim() && !isValidImportEmail(data.email)) {
    issues.push({
      level: "error",
      field: "email",
      message: "Email inválido",
      suggestion: "Use un formato válido, por ejemplo cliente@email.com",
    })
  }

  const technologyRaw = String(data.technology ?? "").trim()
  if (technologyRaw && !resolveImportTechnology(technologyRaw)) {
    issues.push({
      level: "error",
      field: "technology",
      message: "Tecnología inválida",
      suggestion: "Use Fibra Óptica o Wireless",
    })
  }

  const statusRaw = String(data.status ?? "").trim()
  if (statusRaw && !resolveImportStatus(statusRaw)) {
    issues.push({
      level: "error",
      field: "status",
      message: "Estado inválido",
      suggestion: "Use Activo o Inactivo",
    })
  }

  void rowNumber
  return issues
}

export function applyValidationToRow(
  row: CustomerImportReviewRow,
  context: ImportValidationContext,
  batchIssues: ImportIssue[] = []
): CustomerImportReviewRow {
  const data = normalizeImportRowData(row.data)
  const issues = validateImportRow(row.rowNumber, data, context, batchIssues)
  const status = resolveRowStatus(issues)

  return {
    ...row,
    data,
    issues,
    status,
  }
}

export function buildImportReviewRows(
  parsedRows: { rowNumber: number; data: CustomerImportRowData }[],
  context: ImportValidationContext
): CustomerImportReviewRow[] {
  const batchState = createBatchDuplicateState()

  return parsedRows.map((row) => {
    const batchIssues = mergeIssues(
      checkBatchDuplicates(row.rowNumber, row.data, batchState),
      checkNameWithoutPhoneDuplicate(row.rowNumber, row.data, batchState)
    )

    const validated = applyValidationToRow(
      {
        id: crypto.randomUUID(),
        rowNumber: row.rowNumber,
        selected: true,
        data: row.data,
        issues: [],
        status: "valid",
      },
      context,
      batchIssues
    )

    registerBatchRow(row.rowNumber, validated.data, batchState)
    return validated
  })
}

export function summarizeImportRows(
  rows: CustomerImportReviewRow[]
): CustomerImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    warnings: rows.filter((row) => row.status === "warning").length,
    errors: rows.filter((row) => row.status === "error").length,
  }
}

export function getImportRowObservations(row: CustomerImportReviewRow): string {
  if (row.issues.length === 0) {
    return "OK"
  }

  return row.issues
    .map((issue) => {
      const prefix = issue.level === "error" ? "✗" : "⚠"
      return `${prefix} ${issue.message}`
    })
    .join(" · ")
}

export function getImportStatusLabel(status: ImportValidationLevel): string {
  switch (status) {
    case "valid":
      return "✓ OK"
    case "warning":
      return "⚠ Advertencia"
    case "error":
      return "✗ Error"
  }
}
