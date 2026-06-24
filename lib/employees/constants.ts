import { formatDateOnly, formatDateOnlyDateTime } from "@/lib/dates/date-only"
import type {
  EmployeeProvisionStatus,
  EmployeeType,
  EmploymentStatus,
  SystemRole,
} from "@/lib/types/employees"

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Activo",
  vacation: "Vacaciones",
  medical_leave: "Licencia Médica",
  training: "Capacitación",
  suspended: "Suspendido",
  inactive: "Inactivo",
}

export const EMPLOYMENT_STATUS_STYLES: Record<EmploymentStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  vacation: "bg-sky-50 text-sky-700 border-sky-100",
  medical_leave: "bg-amber-50 text-amber-700 border-amber-100",
  training: "bg-violet-50 text-violet-700 border-violet-100",
  suspended: "bg-orange-50 text-orange-700 border-orange-100",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
}

export const EMPLOYMENT_STATUS_OPTIONS = Object.entries(
  EMPLOYMENT_STATUS_LABELS
).map(([value, label]) => ({
  value: value as EmploymentStatus,
  label,
}))

export const EMPLOYEE_DEPARTMENT_OPTIONS = [
  "Operaciones de campo",
  "Supervisión",
  "Administración",
  "Recursos Humanos",
] as const

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  operario: "Operario",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  gerente: "Gerente",
  otro: "Otro",
}

export const EMPLOYEE_TYPE_STYLES: Record<EmployeeType, string> = {
  operario: "bg-blue-50 text-blue-700 border-blue-100",
  supervisor: "bg-indigo-50 text-indigo-700 border-indigo-100",
  administrativo: "bg-slate-100 text-slate-700 border-slate-200",
  gerente: "bg-violet-50 text-violet-700 border-violet-100",
  otro: "bg-neutral-100 text-neutral-600 border-neutral-200",
}

export const EMPLOYEE_TYPE_OPTIONS = Object.entries(EMPLOYEE_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as EmployeeType,
    label,
  })
)

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  operario: "Operario",
}

export const SYSTEM_ROLE_STYLES: Record<SystemRole, string> = {
  administrador: "bg-violet-50 text-violet-700 border-violet-100",
  supervisor: "bg-indigo-50 text-indigo-700 border-indigo-100",
  administrativo: "bg-slate-100 text-slate-700 border-slate-200",
  operario: "bg-blue-50 text-blue-700 border-blue-100",
}

export const SYSTEM_ROLE_OPTIONS: SystemRole[] = [
  "administrador",
  "supervisor",
  "administrativo",
  "operario",
]

export const SYSTEM_ROLE_FILTER_OPTIONS = SYSTEM_ROLE_OPTIONS.map((value) => ({
  value,
  label: SYSTEM_ROLE_LABELS[value],
}))

export const SYSTEM_ACCESS_FILTER_OPTIONS = [
  { value: "all" as const, label: "Todos" },
  { value: "with" as const, label: "Con acceso" },
  { value: "without" as const, label: "Sin acceso" },
]

export const PROVISION_STATUS_LABELS: Record<EmployeeProvisionStatus, string> = {
  no_system_access: "Sin acceso al sistema",
  pending_provision: "Pendiente de provisión",
  provisioned: "Usuario provisionado",
  inconsistent: "Estado inconsistente",
}

export const PROVISION_STATUS_STYLES: Record<EmployeeProvisionStatus, string> = {
  no_system_access: "border-slate-200 bg-slate-100 text-slate-600",
  pending_provision: "border-amber-200 bg-amber-50 text-amber-800",
  provisioned: "border-emerald-100 bg-emerald-50 text-emerald-700",
  inconsistent: "border-rose-200 bg-rose-50 text-rose-700",
}

export function formatEmployeeDate(date?: string | null) {
  return formatDateOnly(date)
}

export function formatEmployeeDateTime(date?: string | null) {
  return formatDateOnlyDateTime(date)
}
