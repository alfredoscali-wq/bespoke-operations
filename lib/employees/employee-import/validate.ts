import {
  normalizeImportRowData,
  resolveImportEmploymentStatus,
  resolveImportSystemAccess,
  resolveImportSystemRole,
} from "@/lib/employees/employee-import/normalize"
import type {
  EmployeeImportIssue,
  EmployeeImportReviewRow,
  EmployeeImportRowData,
  EmployeeImportSummary,
  ImportValidationLevel,
} from "@/lib/employees/employee-import/types"
import type { Employee, NewEmployeeInput } from "@/lib/types/employees"
import type { EmployeeTypeCatalog } from "@/lib/types/employee-types"
import { resolveImportEmployeeTypeFromCatalog } from "@/lib/employees/employee-import/resolve-type"

export type EmployeeImportValidationContext = {
  employees: Employee[]
  employeeTypes: EmployeeTypeCatalog[]
}

function resolveRowStatus(issues: EmployeeImportIssue[]): ImportValidationLevel {
  if (issues.some((issue) => issue.level === "error")) {
    return "error"
  }
  return "valid"
}

function buildEmployeePayload(
  data: EmployeeImportRowData,
  employeeCode: string,
  context: EmployeeImportValidationContext
): NewEmployeeInput | null {
  const resolvedType = resolveImportEmployeeTypeFromCatalog(
    data.employeeType,
    context.employeeTypes
  )
  const employmentStatus = resolveImportEmploymentStatus(data.employmentStatus)
  const systemAccess = resolveImportSystemAccess(data.systemAccess)
  const systemRole = resolveImportSystemRole(data.systemRole)

  if (!resolvedType || !employmentStatus || systemAccess === null || !systemRole) {
    return null
  }

  return {
    employeeCode,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    preferredName: data.preferredName.trim() || undefined,
    nationalId: data.nationalId.trim() || undefined,
    birthDate: data.birthDate.trim() || undefined,
    email: data.email.trim() || undefined,
    phone: data.phone.trim() || undefined,
    jobTitle: data.jobTitle.trim(),
    department: data.department.trim() || undefined,
    employeeTypeId: resolvedType.employeeTypeId,
    employeeType: resolvedType.employeeType,
    employmentStatus,
    hireDate: data.hireDate.trim() || undefined,
    notes: data.notes.trim(),
    systemAccess,
    systemRole,
    mustChangePassword: false,
  }
}

export function validateImportRow(
  rowNumber: number,
  data: EmployeeImportRowData,
  context: EmployeeImportValidationContext,
  usedNationalIds: Set<string>
): EmployeeImportIssue[] {
  const issues: EmployeeImportIssue[] = []
  const normalized = normalizeImportRowData(data)

  if (!normalized.nationalId) {
    issues.push({
      level: "error",
      field: "nationalId",
      message: "DNI obligatorio",
    })
  } else {
    const dniKey = normalized.nationalId.toLowerCase()
    if (usedNationalIds.has(dniKey)) {
      issues.push({
        level: "error",
        field: "nationalId",
        message: "DNI duplicado en el archivo",
      })
    }

    const existing = context.employees.find(
      (employee) =>
        employee.nationalId?.trim().toLowerCase() === dniKey
    )
    if (existing) {
      issues.push({
        level: "error",
        field: "nationalId",
        message: "DNI ya registrado en la base",
      })
    }
  }

  if (!normalized.firstName) {
    issues.push({
      level: "error",
      field: "firstName",
      message: "Nombre obligatorio",
    })
  }

  if (!normalized.lastName) {
    issues.push({
      level: "error",
      field: "lastName",
      message: "Apellido obligatorio",
    })
  }

  if (!normalized.jobTitle) {
    issues.push({
      level: "error",
      field: "jobTitle",
      message: "Cargo obligatorio",
    })
  }

  if (!normalized.employeeType) {
    issues.push({
      level: "error",
      field: "employeeType",
      message: "Tipo Empleado obligatorio",
    })
  } else if (
    !resolveImportEmployeeTypeFromCatalog(
      normalized.employeeType,
      context.employeeTypes
    )
  ) {
    issues.push({
      level: "error",
      field: "employeeType",
      message:
        "Tipo Empleado no encontrado. Use un código válido (operator, supervisor, administrative, manager, other) o el nombre configurado.",
    })
  }

  if (
    normalized.employmentStatus &&
    !resolveImportEmploymentStatus(normalized.employmentStatus)
  ) {
    issues.push({
      level: "error",
      field: "employmentStatus",
      message:
        "Estado Laboral inválido (active, vacation, medical_leave, training, suspended, inactive)",
    })
  }

  if (
    normalized.systemAccess &&
    resolveImportSystemAccess(normalized.systemAccess) === null
  ) {
    issues.push({
      level: "error",
      field: "systemAccess",
      message: "Acceso Sistema inválido (SI o NO)",
    })
  }

  if (normalized.systemRole && !resolveImportSystemRole(normalized.systemRole)) {
    issues.push({
      level: "error",
      field: "systemRole",
      message:
        "Rol Sistema inválido (administrador, supervisor, administrativo, operario)",
    })
  }

  void rowNumber
  return issues
}

export function applyValidationToRow(
  row: EmployeeImportReviewRow,
  context: EmployeeImportValidationContext,
  usedNationalIds: Set<string>,
  employeeCode: string
): EmployeeImportReviewRow {
  const data = normalizeImportRowData(row.data)
  const issues = validateImportRow(row.rowNumber, data, context, usedNationalIds)
  const status = resolveRowStatus(issues)
  const payload =
    status === "valid"
      ? buildEmployeePayload(data, employeeCode, context) ?? undefined
      : undefined

  if (status === "valid" && data.nationalId.trim()) {
    usedNationalIds.add(data.nationalId.trim().toLowerCase())
  }

  return {
    ...row,
    data,
    issues,
    status,
    payload,
  }
}

export function buildNextEmployeeCode(existingCodes: string[]): string {
  let max = 0

  for (const code of existingCodes) {
    const match = code.match(/-(\d+)$/)
    if (!match) continue
    max = Math.max(max, Number.parseInt(match[1], 10))
  }

  return `EMP-${String(max + 1).padStart(4, "0")}`
}

export function buildImportReviewRows(
  parsedRows: { rowNumber: number; data: EmployeeImportRowData }[],
  context: EmployeeImportValidationContext
): EmployeeImportReviewRow[] {
  const usedNationalIds = new Set<string>()
  const existingCodes = context.employees.map((employee) => employee.employeeCode)
  const assignedCodes = [...existingCodes]

  return parsedRows.map((row) => {
    const employeeCode = buildNextEmployeeCode(assignedCodes)
    assignedCodes.push(employeeCode)

    return applyValidationToRow(
      {
        id: crypto.randomUUID(),
        rowNumber: row.rowNumber,
        data: row.data,
        issues: [],
        status: "valid",
      },
      context,
      usedNationalIds,
      employeeCode
    )
  })
}

export function summarizeImportRows(
  rows: EmployeeImportReviewRow[]
): EmployeeImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    errors: rows.filter((row) => row.status === "error").length,
  }
}

export function getImportRowObservations(row: EmployeeImportReviewRow): string {
  if (row.issues.length === 0) {
    return "OK"
  }

  return row.issues.map((issue) => `✗ ${issue.message}`).join(" · ")
}

export function getImportStatusLabel(status: ImportValidationLevel): string {
  return status === "valid" ? "✓ Válido" : "✗ Error"
}

export function getPreviewAccessLabel(row: EmployeeImportReviewRow): string {
  if (row.status === "error") {
    return row.data.systemAccess.trim() || "—"
  }

  const resolved = resolveImportSystemAccess(row.data.systemAccess)
  if (resolved === null) return row.data.systemAccess.trim() || "—"
  return resolved ? "SI" : "NO"
}

export function getPreviewRoleLabel(row: EmployeeImportReviewRow): string {
  const resolved = resolveImportSystemRole(row.data.systemRole)
  return resolved ?? (row.data.systemRole.trim() || "operario")
}

export function getPreviewEmployeeTypeLabel(
  row: EmployeeImportReviewRow,
  employeeTypes: EmployeeTypeCatalog[]
): string {
  const resolved = resolveImportEmployeeTypeFromCatalog(
    row.data.employeeType,
    employeeTypes
  )
  return resolved?.displayName ?? (row.data.employeeType.trim() || "—")
}
