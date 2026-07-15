import type { EmployeeReportArea } from "@/lib/reports/employee-individual/areas"
import type { EmployeeReportPeriod } from "@/lib/reports/employee-individual/period"
import type { EmploymentStatus } from "@/lib/types/employees"

export type EmployeeReportProfile = {
  employeeId: string
  displayName: string
  jobTitle: string
  department: string
  area: EmployeeReportArea
  areaLabel: string
  supervisorName: string | null
  employmentStatus: EmploymentStatus
  hireDate: string | null
}

export type EmployeeActivityKind =
  | "ot"
  | "atencion"
  | "venta"
  | "rrhh"
  | "supervision"
  | "other"

export type EmployeeActivityRow = {
  id: string
  date: string
  customer: string
  reference: string
  type: string
  status: string
  durationLabel: string
  result: string
  supervisor: string
  kind: EmployeeActivityKind
  /** KPI keys that include this row when active. */
  kpiKeys: string[]
}

export type EmployeeReportKpi = {
  key: string
  label: string
  value: number | string
  /** Numeric for filtering; string KPIs still use key for list filter when possible. */
  numericValue: number
}

export type EmployeeIndividualReport = {
  profile: EmployeeReportProfile
  period: EmployeeReportPeriod
  periodLabel: string
  startDate: string
  endDate: string
  kpis: EmployeeReportKpi[]
  activity: EmployeeActivityRow[]
}
