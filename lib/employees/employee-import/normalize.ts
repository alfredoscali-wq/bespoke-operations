import { parseImportDate } from "@/lib/tasks/work-order-import/normalize"
import type {
  EmployeeType,
  EmploymentStatus,
  SystemRole,
} from "@/lib/types/employees"
import type { EmployeeImportRowData } from "@/lib/employees/employee-import/types"

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const EMPLOYEE_TYPE_VALUES: EmployeeType[] = [
  "operario",
  "supervisor",
  "administrativo",
  "gerente",
  "otro",
]

const EMPLOYMENT_STATUS_VALUES: EmploymentStatus[] = [
  "active",
  "vacation",
  "medical_leave",
  "training",
  "suspended",
  "inactive",
]

const SYSTEM_ROLE_VALUES: SystemRole[] = [
  "administrador",
  "supervisor",
  "administrativo",
  "operario",
]

const EMPLOYEE_TYPE_LOOKUP = new Map<string, EmployeeType>(
  EMPLOYEE_TYPE_VALUES.map((value) => [value, value])
)

const EMPLOYMENT_STATUS_LOOKUP = new Map<string, EmploymentStatus>(
  EMPLOYMENT_STATUS_VALUES.map((value) => [value, value])
)

const SYSTEM_ROLE_LOOKUP = new Map<string, SystemRole>(
  SYSTEM_ROLE_VALUES.map((value) => [value, value])
)

const SYSTEM_ACCESS_LOOKUP = new Map<string, boolean>([
  ["si", true],
  ["sí", true],
  ["yes", true],
  ["true", true],
  ["1", true],
  ["no", false],
  ["false", false],
  ["0", false],
])

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return parseImportDate(value) ?? ""
  }
  return String(value).trim()
}

export function cellToOptionalDate(value: unknown): string | undefined {
  const parsed = parseImportDate(value)
  return parsed ?? undefined
}

export function resolveImportEmployeeType(value: unknown): EmployeeType | null {
  const raw = cellToString(value)
  if (!raw) return null

  const normalized = normalizeText(raw)
  return EMPLOYEE_TYPE_LOOKUP.get(normalized) ?? null
}

export function resolveImportEmploymentStatus(
  value: unknown
): EmploymentStatus | null {
  const raw = cellToString(value)
  if (!raw) return "active"

  const normalized = normalizeText(raw)
  return EMPLOYMENT_STATUS_LOOKUP.get(normalized) ?? null
}

export function resolveImportSystemAccess(value: unknown): boolean | null {
  const raw = cellToString(value)
  if (!raw) return false

  const normalized = normalizeText(raw)
  const resolved = SYSTEM_ACCESS_LOOKUP.get(normalized)
  return resolved === undefined ? null : resolved
}

export function resolveImportSystemRole(value: unknown): SystemRole | null {
  const raw = cellToString(value)
  if (!raw) return "operario"

  const normalized = normalizeText(raw)
  return SYSTEM_ROLE_LOOKUP.get(normalized) ?? null
}

export function normalizeImportRowData(
  data: EmployeeImportRowData
): EmployeeImportRowData {
  return {
    nationalId: data.nationalId.trim(),
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    preferredName: data.preferredName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    jobTitle: data.jobTitle.trim(),
    department: data.department.trim(),
    employeeType: data.employeeType.trim(),
    employmentStatus: data.employmentStatus.trim(),
    hireDate: data.hireDate.trim(),
    birthDate: data.birthDate.trim(),
    systemAccess: data.systemAccess.trim(),
    systemRole: data.systemRole.trim(),
    notes: data.notes.trim(),
  }
}

export function formatSystemAccessDisplay(value: boolean): string {
  return value ? "SI" : "NO"
}
