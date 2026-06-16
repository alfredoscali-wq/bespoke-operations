import type { EmploymentStatus } from "@/lib/types/employees"
import type { EmployeeType } from "@/lib/types/employees"

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

export function formatEmployeeDate(date?: string | null) {
  if (!date) return "—"

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatEmployeeDateTime(date?: string | null) {
  if (!date) return "—"

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
