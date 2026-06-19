import { isNewInstallationWorkOrder, requiresCustomerLookup } from "@/lib/tasks/work-order"
import type { Customer } from "@/lib/types/customers"
import type { Crew } from "@/lib/types/crews"
import {
  getImportServiceTypeLabel,
  parseImportDate,
  resolveImportServiceType,
  resolveImportTechnology,
} from "@/lib/tasks/work-order-import/normalize"
import type {
  ImportIssue,
  ImportValidationLevel,
  WorkOrderImportReviewRow,
  WorkOrderImportRowData,
  WorkOrderImportSummary,
} from "@/lib/tasks/work-order-import/types"

export type ImportValidationContext = {
  crews: Crew[]
  customers: Customer[]
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findCustomerMatch(
  customers: Customer[],
  name: string,
  phone?: string
): Customer | undefined {
  const normalizedName = normalizeKey(name)
  if (!normalizedName) return undefined

  const exact = customers.find(
    (customer) => normalizeKey(customer.name) === normalizedName
  )
  if (exact) return exact

  if (phone?.trim()) {
    const phoneMatch = customers.find(
      (customer) => customer.phone?.trim() === phone.trim()
    )
    if (phoneMatch) return phoneMatch
  }

  return customers.find((customer) =>
    normalizeKey(customer.name).includes(normalizedName)
  )
}

function findCrewMatch(crews: Crew[], crewName: string): Crew | undefined {
  const normalized = normalizeKey(crewName)
  if (!normalized) return undefined

  return crews.find((crew) => normalizeKey(crew.name) === normalized)
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

export function validateImportRow(
  rowNumber: number,
  data: WorkOrderImportRowData,
  context: ImportValidationContext
): ImportIssue[] {
  const issues: ImportIssue[] = []
  const serviceType =
    data.serviceType || resolveImportServiceType(String(data.serviceType ?? ""))

  if (!serviceType) {
    issues.push({
      level: "error",
      field: "serviceType",
      message: "Tipo de orden inválido",
      suggestion: "Use un tipo operativo válido (ej. Instalación Nueva)",
    })
  }

  if (!data.customerName.trim()) {
    issues.push({
      level: "error",
      field: "customerName",
      message: "Cliente vacío",
      suggestion: "Complete la columna cliente",
    })
  }

  const parsedDate = parseImportDate(data.scheduledDate)
  if (!parsedDate) {
    issues.push({
      level: "error",
      field: "scheduledDate",
      message: "Fecha inválida",
      suggestion: "Use formato DD/MM/AAAA o AAAA-MM-DD",
    })
  }

  if (serviceType && isNewInstallationWorkOrder(serviceType)) {
    if (!data.address.trim()) {
      issues.push({
        level: "error",
        field: "address",
        message: "Dirección obligatoria para instalación nueva",
        suggestion: "Complete la columna dirección",
      })
    }

    if (!resolveImportTechnology(data.technology)) {
      issues.push({
        level: "error",
        field: "technology",
        message: "Tecnología inválida",
        suggestion: "Use Fibra Óptica o Wireless",
      })
    }
  }

  if (serviceType && requiresCustomerLookup(serviceType) && data.customerName.trim()) {
    const customer = findCustomerMatch(
      context.customers,
      data.customerName,
      data.customerPhone
    )

    if (!customer) {
      issues.push({
        level: "error",
        field: "customerName",
        message: "Cliente no encontrado en la base",
        suggestion: "Verifique el nombre o registre al cliente previamente",
      })
    }
  }

  if (data.crewName.trim()) {
    const crew = findCrewMatch(context.crews, data.crewName)
    if (!crew) {
      issues.push({
        level: "warning",
        field: "crewName",
        message: `Cuadrilla ${data.crewName} no encontrada`,
        suggestion: "La orden se creará como Sin cuadrilla",
      })
    }
  }

  if (!data.customerPhone.trim()) {
    issues.push({
      level: "warning",
      field: "customerPhone",
      message: "Teléfono vacío",
      suggestion: "Complete el teléfono si está disponible",
    })
  }

  if (!data.locality.trim() && !isNewInstallationWorkOrder(serviceType)) {
    issues.push({
      level: "warning",
      field: "locality",
      message: "Localidad vacía",
      suggestion: "Complete la localidad si está disponible",
    })
  }

  if (!data.customerEmail.trim()) {
    issues.push({
      level: "warning",
      field: "customerEmail",
      message: "Email vacío",
      suggestion: "Complete el email si está disponible",
    })
  }

  void rowNumber
  return issues
}

export function applyValidationToRow(
  row: WorkOrderImportReviewRow,
  context: ImportValidationContext
): WorkOrderImportReviewRow {
  const parsedDate = parseImportDate(row.data.scheduledDate)
  const serviceType =
    row.data.serviceType ||
    resolveImportServiceType(String(row.data.serviceType ?? ""))
  const crew = row.data.crewName.trim()
    ? findCrewMatch(context.crews, row.data.crewName)
    : undefined
  const customer =
    serviceType &&
    requiresCustomerLookup(serviceType) &&
    row.data.customerName.trim()
      ? findCustomerMatch(
          context.customers,
          row.data.customerName,
          row.data.customerPhone
        )
      : undefined

  const data: WorkOrderImportRowData = {
    ...row.data,
    serviceType: serviceType || "",
    scheduledDate: parsedDate ?? row.data.scheduledDate,
    technology: resolveImportTechnology(row.data.technology) || row.data.technology,
    currentTechnology:
      resolveImportTechnology(row.data.currentTechnology) ||
      row.data.currentTechnology,
    newTechnology:
      resolveImportTechnology(row.data.newTechnology) || row.data.newTechnology,
    crewId: crew?.id ?? "",
    customerId: customer?.id ?? "",
  }

  const issues = validateImportRow(row.rowNumber, data, context)
  const status = resolveRowStatus(issues)

  return {
    ...row,
    data,
    issues,
    status,
  }
}

export function buildImportReviewRows(
  parsedRows: { rowNumber: number; data: WorkOrderImportRowData }[],
  context: ImportValidationContext
): WorkOrderImportReviewRow[] {
  return parsedRows.map((row) =>
    applyValidationToRow(
      {
        id: crypto.randomUUID(),
        rowNumber: row.rowNumber,
        selected: true,
        data: row.data,
        issues: [],
        status: "valid",
      },
      context
    )
  )
}

export function summarizeImportRows(
  rows: WorkOrderImportReviewRow[]
): WorkOrderImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    warnings: rows.filter((row) => row.status === "warning").length,
    errors: rows.filter((row) => row.status === "error").length,
  }
}

export function getImportRowObservations(row: WorkOrderImportReviewRow): string {
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

export function getImportServiceTypeDisplay(
  data: WorkOrderImportRowData
): string {
  return getImportServiceTypeLabel(data.serviceType) || "(vacío)"
}
